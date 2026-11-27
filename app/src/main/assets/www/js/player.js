/* AVPlay manager. One shared player used for the small preview window, fullscreen live and VOD.
   The video plane sits BEHIND the web layer: html/body are transparent and the <object> must exist. */
(function () {
'use strict';
var O = window.O;
var Pl = O.player = {
  st: 'idle',          /* idle | loading | playing | paused | error */
  kind: null,          /* live | vod */
  item: null, vod: null, rect: { x: 0, y: 0, w: 1920, h: 1080 },
  time: 0, dur: 0, errs: [], fmt: ''
};
var obj = null, tok = 0, attempt = 0, fmts = [], started = false, failedTok = 0, wd = 0, recon = 0, seekT = 0, cycles = 0;
var lastMove = 0, lastPos = -1;   /* stall watch */
var subs = [];

Pl.on = function (fn) { subs.push(fn); };
function emit(ev, a) { subs.forEach(function (f) { try { f(ev, a); } catch (e) {} }); }
function setSt(s, msg) { Pl.st = s; Pl.stMsg = msg || ''; if (s === 'playing' || s === 'paused') lastMove = Date.now(); emit('state', msg); }
function ok() { return !!(window.webapis && webapis.avplay); }

function ensureObj() {
  if (obj) return;
  obj = document.createElement('object');
  obj.id = 'av-player'; obj.type = 'application/avplayer'; obj.className = 'av-object';
  var st = O.$('stage'); st.insertBefore(obj, st.firstChild);
  applyRect();
}
function applyRect() {
  var r = Pl.rect;
  if (obj) { obj.style.left = r.x + 'px'; obj.style.top = r.y + 'px'; obj.style.width = r.w + 'px'; obj.style.height = r.h + 'px'; }
  if (ok()) { try { webapis.avplay.setDisplayRect(r.x, r.y, r.w, r.h); } catch (e) {} }
}
Pl.setRect = function (r) { Pl.rect = r; applyRect(); };

function stopAv() {
  if (!ok()) return;
  var av = webapis.avplay, s = 'NONE';
  try { s = av.getState(); } catch (e) {}
  try { if (s === 'PLAYING' || s === 'PAUSED' || s === 'READY') av.stop(); } catch (e) {}
  try { if (s !== 'NONE') av.close(); } catch (e) {}
}
function fmtOrder() {
  var order = ['m3u8', 'ts'], ui = O.data.info, al = ui && ui.allowed_output_formats;
  if (Array.isArray(al) && al.length) { var f = order.filter(function (x) { return al.indexOf(x) > -1; }); if (f.length) order = f; }
  var pref = O.cfg.get('fmt', null), p = order.indexOf(pref);
  if (p > 0) { order.splice(p, 1); order.unshift(pref); }
  return order;
}

Pl.playLive = function (ch, rect) {
  Pl.kind = 'live'; Pl.item = ch; Pl.vod = null; Pl.time = 0; Pl.dur = 0;
  if (rect) Pl.rect = rect;
  fmts = fmtOrder(); recon = 0; cycles = 0; Pl.errs = [];
  start(0);
};
/* opts: {url, startMs, item} */
Pl.playVod = function (opts, rect) {
  Pl.kind = 'vod'; Pl.vod = opts; Pl.item = opts.item; Pl.time = opts.startMs || 0; Pl.dur = 0;
  if (rect) Pl.rect = rect;
  fmts = ['direct']; recon = 0; cycles = 0; Pl.errs = [];
  start(0);
};
Pl.retry = function () {
  recon = 0; cycles = 0; Pl.errs = [];
  fmts = Pl.kind === 'live' ? fmtOrder() : ['direct'];
  start(0);
};

function urlFor(fmt) {
  if (Pl.kind === 'live') return O.api.stream('live', Pl.item.id, fmt);
  return Pl.vod.url;
}

function start(n) {
  clearTimeout(wd);
  var t = ++tok;
  attempt = n; started = false;
  if (n >= fmts.length) {
    /* a live channel that does not start at all: try the whole round again a few times (short outages) */
    if (Pl.kind === 'live' && cycles < 4) { cycles++; setSt('loading', 'reconnect'); setTimeout(function () { if (t === tok) start(0); }, 2000 * cycles); return; }
    fatal(O.t('playFail')); return;
  }
  setSt('loading');
  if (!ok()) { Pl.errs.push('webapis.avplay missing'); fatal(O.t('noAvplay')); return; }
  ensureObj();
  var fmt = fmts[n], av = webapis.avplay;
  Pl.fmt = fmt;
  try {
    stopAv();
    av.open(urlFor(fmt));
    av.setListener({
      onbufferingstart: function () { if (t === tok && started) { Pl.st = 'loading'; emit('state', 'buffering'); } },
      onbufferingprogress: function (p) { if (t === tok && !started) emit('progress', p); },
      onbufferingcomplete: function () { if (t === tok) began(fmt); },
      oncurrentplaytime: function (ms) {
        if (t !== tok) return;
        if (ms !== lastPos) { lastPos = ms; lastMove = Date.now(); }
        Pl.time = ms; if (!started) began(fmt); emit('time', ms);
      },
      onstreamcompleted: function () { if (t === tok) { if (Pl.kind === 'live') reconnect(); else { setSt('idle'); emit('ended'); } } },
      onerror: function (e) { fail(t, fmt, String(e)); },
      onerrormsg: function (e, m) { fail(t, fmt, String(e) + (m ? ' ' + m : '')); },
      onevent: function (type) { if (t === tok && type === 'VIDEO_SIZE') emit('vsize', Pl.res()); }, ondrmevent: function () {}, onsubtitlechange: function () {}
    });
    applyRect();
    applyAspect();
    if (Pl.kind === 'live') {
      try { av.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', 3); } catch (e) {}
      try { av.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', 5); } catch (e) {}
    }
    av.prepareAsync(function () {
      if (t !== tok) return;
      try {
        applyRect();
        try { Pl.dur = av.getDuration() || 0; } catch (e) {}
        var go = function () { try { av.play(); } catch (e) { fail(t, fmt, 'play: ' + e); } };
        if (Pl.kind === 'vod' && Pl.vod.startMs > 0) av.seekTo(Pl.vod.startMs, go, go); else go();
      } catch (e) { fail(t, fmt, 'start: ' + e); }
    }, function (err) { fail(t, fmt, 'prepare: ' + err); });
  } catch (e) { fail(t, fmt, String(e && e.message || e)); }
  wd = setTimeout(function () { if (t === tok && !started) fail(t, fmt, 'timeout'); }, Pl.kind === 'live' ? 15000 : 40000);
}
function began(fmt) {
  clearTimeout(wd);
  if (started) { if (Pl.st !== 'paused') setSt('playing'); return; }
  started = true; recon = 0; cycles = 0; lastMove = Date.now(); lastPos = -1;
  if (Pl.kind === 'live') O.cfg.set('fmt', fmt);
  try { Pl.dur = webapis.avplay.getDuration() || Pl.dur; } catch (e) {}
  setSt('playing');
  emit('started');
}
function fail(t, fmt, msg) {
  if (t !== tok || failedTok === t) return;
  failedTok = t; clearTimeout(wd);
  Pl.errs.push(fmt + ': ' + msg);
  if (started) { if (Pl.kind === 'live') reconnect(); else fatal(O.t('playFail')); return; }
  setTimeout(function () { if (t === tok) { stopAv(); start(attempt + 1); } }, 0);
}
/* automatic reconnect: the stream dropped or the internet was gone for a moment.
   Live keeps trying for ~5 minutes (1, 2, 3, 5, 5, 5 ... s); a movie / episode continues where it stopped. */
function reconnect() {
  var t = tok, max = Pl.kind === 'live' ? 60 : 12;
  if (recon >= max) { stopAv(); fatal(O.t('streamLost')); return; }
  recon++; setSt('loading', 'reconnect');
  if (Pl.kind === 'vod' && Pl.vod && Pl.time > 0) Pl.vod.startMs = Pl.time;
  stopAv();
  setTimeout(function () { if (t === tok) start(attempt); }, Math.min(5000, [1000, 2000, 3000][recon - 1] || 5000));
}
/* a stream that silently freezes (no error, picture stuck) is restarted too */
setInterval(function () {
  if (!started || !lastMove || (Pl.st !== 'playing' && Pl.st !== 'loading')) return;
  if (Date.now() - lastMove > (Pl.kind === 'live' ? 12000 : 25000)) { lastMove = Date.now(); Pl.errs.push('stalled'); started = false; reconnect(); }
}, 2000);
function fatal(msg) { setSt('error', msg); }

Pl.stop = function () {
  tok++; clearTimeout(wd); clearTimeout(seekT); started = false; lastMove = 0;
  stopAv(); Pl.item = null; Pl.time = 0; setSt('idle');
};
Pl.pause = function () { if (Pl.kind !== 'vod' || !ok()) return; try { webapis.avplay.pause(); setSt('paused'); } catch (e) {} };
Pl.resume = function () { if (!ok()) return; try { webapis.avplay.play(); setSt('playing'); } catch (e) {} };
Pl.toggle = function () { if (Pl.st === 'paused') Pl.resume(); else if (Pl.st === 'playing') Pl.pause(); };
/* accumulate quick presses, seek once */
var seekTarget = null;
Pl.seekBy = function (ms) {
  if (Pl.kind !== 'vod') return Pl.time;
  var base = seekTarget == null ? Pl.time : seekTarget;
  seekTarget = O.clamp(base + ms, 0, Math.max(0, (Pl.dur || 0) - 3000));
  clearTimeout(seekT);
  var tgt = seekTarget;
  seekT = setTimeout(function () {
    seekTarget = null;
    try { webapis.avplay.seekTo(tgt, function () {}, function () {}); Pl.time = tgt; } catch (e) {}
  }, 450);
  return seekTarget;
};
/* picture size mode: fit | zoom | fill | 16:9 | 4:3 (saved) */
Pl.ASPECTS = ['fit', 'zoom', 'fill', '16:9', '4:3'];
function applyAspect() {
  if (!ok()) return;
  var m = O.cfg.get('aspect', 'fit'), av = webapis.avplay;
  if (typeof av.setAspect === 'function') { try { av.setAspect(m); } catch (e) {} return; }
  try { av.setDisplayMethod(m === 'fit' || m === '16:9' || m === '4:3' ? 'PLAYER_DISPLAY_MODE_LETTER_BOX' : 'PLAYER_DISPLAY_MODE_FULL_SCREEN'); } catch (e) {}
}
Pl.aspect = function () { return O.cfg.get('aspect', 'fit'); };
Pl.setAspectMode = function (m) { O.cfg.set('aspect', m); applyAspect(); };
Pl.cycleAspect = function () {
  var a = Pl.ASPECTS, m = a[(a.indexOf(Pl.aspect()) + 1) % a.length];
  O.cfg.set('aspect', m); applyAspect(); return m;
};
Pl.seekTo = function (ms) {
  if (Pl.kind !== 'vod') return Pl.time;
  seekTarget = O.clamp(ms, 0, Math.max(0, (Pl.dur || 0) - 3000));
  clearTimeout(seekT);
  var tgt = seekTarget;
  seekT = setTimeout(function () {
    seekTarget = null;
    try { webapis.avplay.seekTo(tgt, function () {}, function () {}); Pl.time = tgt; } catch (e) {}
  }, 250);
  return tgt;
};
/* current video resolution {w,h,fps} or null */
Pl.res = function () {
  if (!ok()) return null;
  try {
    var a = webapis.avplay.getCurrentStreamInfo() || [];
    for (var i = 0; i < a.length; i++) if (a[i].type === 'VIDEO') {
      var x = JSON.parse(a[i].extra_info || '{}'), w = +x.Width || 0, h = +x.Height || 0;
      if (w && h) return { w: w, h: h, fps: Math.round(+x.framerate || 0) };
    }
  } catch (e) {}
  return null;
};
/* audio / subtitle tracks (Android build) */
Pl.canTracks = function () { return ok() && typeof webapis.avplay.getTracks === 'function'; };
Pl.getTracks = function (cb) { if (Pl.canTracks()) webapis.avplay.getTracks(cb); else cb(null); };
Pl.selectTrack = function (kind, g, t) { if (Pl.canTracks()) webapis.avplay.selectTrack(kind, g, t); };
Pl.errText = function () { return Pl.errs.join(' | '); };
})();
