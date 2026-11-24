/* Android host shim.
   Implements the parts of Samsung's webapis.avplay / avplaystore / tizen APIs that the app uses,
   on top of the native ExoPlayer bridge (window.OssiNative). The video is drawn by native views
   BEHIND the transparent WebView, exactly like AVPlay on Tizen, so the rest of the app is unchanged. */
(function () {
'use strict';
var B = window.OssiNative;
if (!B) return;                         /* opened in a normal browser: do nothing */

var players = {}, nextId = 1;

function stageRect() {
  var st = document.getElementById('stage');
  if (!st) return { left: 0, top: 0, s: 1 };
  var r = st.getBoundingClientRect();
  return { left: r.left, top: r.top, s: r.width / (window.O && O.stageW || 1920) || 1 };
}
/* 1920x1080 stage coordinates -> physical pixels of the WebView */
function toScreen(x, y, w, h) {
  var r = stageRect(), d = window.devicePixelRatio || 1;
  return [Math.round((r.left + x * r.s) * d), Math.round((r.top + y * r.s) * d),
          Math.max(1, Math.round(w * r.s * d)), Math.max(1, Math.round(h * r.s * d))];
}

function AVPlay(id) { this.id = id; this.state = 'NONE'; this.l = {}; this.prep = null; this.dur = 0; this.time = 0; this.rect = null; }
var P = AVPlay.prototype;
P.open = function (url) { this.video = null; this.prep = null; this.dur = 0; this.time = 0; this.state = 'IDLE'; B.open(this.id, String(url)); };
P.setListener = function (l) { this.l = l || {}; };
P.setDisplayRect = function (x, y, w, h) { this.rect = [x, y, w, h]; this._rect(); };
P._rect = function () { var r = this.rect, s = toScreen(r[0], r[1], r[2], r[3]); B.setRect(this.id, s[0], s[1], s[2], s[3]); };
P.setDisplayMethod = function () {};
P.setBufferingParam = function () {};
P.setStreamingProperty = function () {};
P.setSpeed = function () {};
P.prepareAsync = function (ok, err) { this.prep = { ok: ok, err: err }; B.prepare(this.id); };
P.prepare = function () { B.prepare(this.id); };
P.play = function () { if (this.state === 'NONE') return; this.state = 'PLAYING'; B.play(this.id); };
P.pause = function () { if (this.state === 'NONE') return; this.state = 'PAUSED'; B.pause(this.id); };
P.stop = function () { this.state = 'IDLE'; B.stop(this.id); };
P.close = function () { this.state = 'NONE'; this.prep = null; B.close(this.id); };
P.seekTo = function (ms, ok) { this.time = ms; B.seekTo(this.id, ms); if (typeof ok === 'function') setTimeout(ok, 0); };
P.jumpForward = function (ms, ok) { this.seekTo(this.time + ms, ok); };
P.jumpBackward = function (ms, ok) { this.seekTo(Math.max(0, this.time - ms), ok); };
P.getState = function () { return this.state; };
P.getDuration = function () { return this.dur; };
P.getCurrentTime = function () { return this.time; };
P.getCurrentStreamInfo = function () {
  var v = this.video; if (!v) return [];
  return [{ index: 0, type: 'VIDEO', extra_info: JSON.stringify({ Width: v.w, Height: v.h, framerate: v.fps }) }];
};

/* audio / subtitle tracks (Android only): cb({audio:[...], text:[...], textOn}) */
P.setAspect = function (m) { this.aspect = m; B.setAspect(this.id, m); };
P.getTracks = function (cb) { this.tracksCb = cb; B.tracks(this.id); };
P.selectTrack = function (kind, g, t) { B.selectTrack(this.id, kind, g, t); };

function make() { var p = new AVPlay(nextId++); players[p.id] = p; return p; }
function call(fn, a, b) { if (typeof fn === 'function') { try { fn(a, b); } catch (e) {} } }

/* events from native: id, type, number, text */
window.__ossiEvt = function (id, type, n, txt) {
  var p = players[id]; if (!p || p.state === 'NONE') return;
  var l = p.l || {};
  if (type === 'ready') {
    p.dur = n || 0;
    if (p.prep) { var ok = p.prep.ok; p.prep = null; if (p.state === 'IDLE') p.state = 'READY'; call(ok); }
    else call(l.onbufferingcomplete);
  } else if (type === 'buffering') call(l.onbufferingstart);
  else if (type === 'buffered') call(l.onbufferingcomplete);
  else if (type === 'time') { p.time = n; call(l.oncurrentplaytime, n); }
  else if (type === 'dur') p.dur = n || 0;
  else if (type === 'ended') call(l.onstreamcompleted);
  else if (type === 'vsize') { var a = String(txt).split('x'); p.video = { w: +a[0], h: +a[1], fps: +a[2] || 0 }; call(l.onevent, 'VIDEO_SIZE', txt); }
  else if (type === 'tracks') { var cb = p.tracksCb; p.tracksCb = null; if (cb) { try { cb(JSON.parse(txt)); } catch (e) { cb(null); } } }
  else if (type === 'trackschanged') call(l.onevent, 'TRACKS_CHANGED', '');
  else if (type === 'toast') { if (window.O && O.toast) O.toast(txt); }
  else if (type === 'error') {
    if (p.prep) { var er = p.prep.err; p.prep = null; call(er, txt); }
    else { call(l.onerror, txt); call(l.onerrormsg, 'PLAYER_ERROR', txt); }
  }
};

var main = make();
window.webapis = window.webapis || {};
webapis.avplay = main;
webapis.avplaystore = { getPlayer: function () { return make(); } };
webapis.productinfo = { getModel: function () { return 'Android'; }, getFirmware: function () { return B.version(); } };

window.tizen = window.tizen || {
  application: { getCurrentApplication: function () { return { exit: function () { B.exit(); }, hide: function () { B.exit(); } }; } },
  tvinputdevice: { registerKey: function () {}, unregisterKey: function () {}, getSupportedKeys: function () { return []; } }
};

/* key events from native (remote buttons that the WebView does not map by itself) */
function fire(type, code) {
  var e;
  try { e = new KeyboardEvent(type, { bubbles: true, cancelable: true }); }
  catch (x) { e = document.createEvent('Event'); e.initEvent(type, true, true); }
  try { Object.defineProperty(e, 'keyCode', { get: function () { return code; } }); } catch (x) {}
  try { Object.defineProperty(e, 'which', { get: function () { return code; } }); } catch (x) {}
  (document.activeElement || document.body || document).dispatchEvent(e);
}
window.__ossiKey = fire;

/* keep the 1920x1080 stage centred and the video windows in place after any resize */
function layout() {
  Object.keys(players).forEach(function (k) { var p = players[k]; if (p.rect && p.state !== 'NONE') p._rect(); });
}
window.addEventListener('resize', function () { setTimeout(layout, 0); });
window.addEventListener('load', function () { setTimeout(layout, 0); });

/* touch devices (phones/tablets): the web app switches to touch controls */
if (!B.isTv()) document.documentElement.className += ' touch';

/* the Samsung <object type="application/avplayer"> is not needed here: hide its "plugin" placeholder */
(function () { var st = document.createElement('style'); st.textContent = '#av-player{visibility:hidden!important}';
  (document.head || document.documentElement).appendChild(st); })();
})();
