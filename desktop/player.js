/* Ossi TV — browser build.
   Implements the parts of Samsung's webapis.avplay used by the app on top of an HTML <video>:
   HLS (.m3u8) via hls.js, MPEG-TS live via mpegts.js, mp4/mkv/webm directly. */
(function () {
'use strict';
if (window.OssiNative) return;

var V = document.createElement('video');
V.id = 'bvid'; V.setAttribute('playsinline', ''); V.preload = 'auto';
function mount() { if (!V.parentNode && document.body) document.body.insertBefore(V, document.body.firstChild); }
document.addEventListener('DOMContentLoaded', mount);

var hls = null, mts = null;
var P = { state: 'NONE', l: {}, prep: null, url: '', rect: null };
function call(fn, a, b) { if (typeof fn === 'function') { try { fn(a, b); } catch (e) {} } }
function detach() {
  if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
  if (mts) { try { mts.destroy(); } catch (e) {} mts = null; }
  try { V.pause(); V.removeAttribute('src'); V.load(); } catch (e) {}
  V.style.visibility = 'hidden';
}
function stageRect() {
  var st = document.getElementById('stage');
  if (!st) return { left: 0, top: 0, s: 1 };
  var r = st.getBoundingClientRect();
  return { left: r.left, top: r.top, s: r.width / ((window.O && O.stageW) || 1920) || 1 };
}
function applyRect() {
  if (!P.rect) return;
  var r = stageRect(), x = P.rect;
  V.style.left = (r.left + x[0] * r.s) + 'px'; V.style.top = (r.top + x[1] * r.s) + 'px';
  V.style.width = (x[2] * r.s) + 'px'; V.style.height = (x[3] * r.s) + 'px';
}
window.addEventListener('resize', function () { setTimeout(applyRect, 0); });

function fail(msg) {
  if (P.prep) { var e = P.prep.err; P.prep = null; call(e, msg); }
  else if (P.state !== 'NONE') call(P.l.onerror, msg);
}
function load() {
  var u = P.url, low = u.toLowerCase();
  mount();
  if (/\.m3u8(\?|$)/.test(low)) {
    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, backBufferLength: 30 });
      hls.on(Hls.Events.ERROR, function (ev, d) { if (d && d.fatal) fail('HLS ' + (d.details || d.type)); });
      hls.on(Hls.Events.MANIFEST_PARSED, function () { call(P.l.onevent, 'TRACKS_CHANGED', ''); });
      hls.loadSource(u); hls.attachMedia(V);
    } else if (V.canPlayType('application/vnd.apple.mpegurl')) V.src = u;
    else fail('HLS not supported in this browser');
  } else if (/\/live\//.test(low) || /\.ts(\?|$)/.test(low)) {
    if (window.mpegts && mpegts.isSupported()) {
      mts = mpegts.createPlayer({ type: 'mpegts', isLive: /\/live\//.test(low), url: u },
        { enableWorker: true, lazyLoad: false, liveBufferLatencyChasing: true, autoCleanupSourceBuffer: true });
      mts.on(mpegts.Events.ERROR, function (type, detail) { fail('TS ' + type + ' ' + (detail || '')); });
      mts.attachMediaElement(V); mts.load();
    } else fail('MPEG-TS not supported in this browser');
  } else {
    V.src = u;
  }
}
V.addEventListener('loadedmetadata', function () {
  if (P.prep) { var ok = P.prep.ok; P.prep = null; if (P.state === 'IDLE') P.state = 'READY'; call(ok); }
});
V.addEventListener('playing', function () { V.style.visibility = 'visible'; call(P.l.onbufferingcomplete); });
V.addEventListener('waiting', function () { call(P.l.onbufferingstart); });
V.addEventListener('timeupdate', function () { if (!V.paused) call(P.l.oncurrentplaytime, V.currentTime * 1000); });
V.addEventListener('ended', function () { call(P.l.onstreamcompleted); });
V.addEventListener('resize', function () { call(P.l.onevent, 'VIDEO_SIZE', V.videoWidth + 'x' + V.videoHeight); });
V.addEventListener('error', function () {
  if (hls || mts) return;   /* the libraries report their own errors */
  var e = V.error; fail('MEDIA ' + (e ? e.code + ' ' + (e.message || '') : ''));
});

var av = {
  open: function (url) { detach(); P.url = String(url); P.state = 'IDLE'; P.prep = null; },
  setListener: function (l) { P.l = l || {}; },
  setDisplayRect: function (x, y, w, h) { P.rect = [x, y, w, h]; applyRect(); },
  setDisplayMethod: function () {}, setBufferingParam: function () {}, setStreamingProperty: function () {}, setSpeed: function () {},
  prepareAsync: function (ok, err) { P.prep = { ok: ok, err: err }; load(); },
  prepare: function () { load(); },
  play: function () { if (P.state === 'NONE') return; P.state = 'PLAYING'; var p = V.play(); if (p && p.catch) p.catch(function () {}); },
  pause: function () { if (P.state === 'NONE') return; P.state = 'PAUSED'; V.pause(); },
  stop: function () { P.state = 'IDLE'; detach(); },
  close: function () { P.state = 'NONE'; P.prep = null; detach(); },
  seekTo: function (ms, ok) { try { V.currentTime = ms / 1000; } catch (e) {} if (typeof ok === 'function') setTimeout(ok, 0); },
  jumpForward: function (ms, ok) { av.seekTo(V.currentTime * 1000 + ms, ok); },
  jumpBackward: function (ms, ok) { av.seekTo(Math.max(0, V.currentTime * 1000 - ms), ok); },
  getState: function () { return P.state; },
  getDuration: function () { var d = V.duration; return isFinite(d) ? d * 1000 : 0; },
  getCurrentTime: function () { return V.currentTime * 1000; },
  getCurrentStreamInfo: function () {
    return V.videoWidth ? [{ index: 0, type: 'VIDEO', extra_info: JSON.stringify({ Width: V.videoWidth, Height: V.videoHeight }) }] : [];
  },
  setAspect: function (m) { V.style.objectFit = m === 'zoom' ? 'cover' : m === 'fill' ? 'fill' : 'contain'; },
  /* audio / subtitle tracks: HLS via hls.js, other files via the browser's own track lists */
  getTracks: function (cb) {
    var audio = [], text = [], textOn = false, i;
    if (hls) {
      (hls.audioTracks || []).forEach(function (t, i) { audio.push({ g: 0, t: i, label: t.name || '', lang: t.lang || '', name: '', ch: 0, sel: i === hls.audioTrack }); });
      (hls.subtitleTracks || []).forEach(function (t, i) { text.push({ g: 0, t: i, label: t.name || '', lang: t.lang || '', name: '', ch: 0, sel: i === hls.subtitleTrack }); });
      textOn = hls.subtitleTrack >= 0;
    } else {
      var at = V.audioTracks;
      if (at) for (i = 0; i < at.length; i++) audio.push({ g: 0, t: i, label: at[i].label || '', lang: at[i].language || '', name: '', ch: 0, sel: at[i].enabled });
      var tt = V.textTracks;
      for (i = 0; i < tt.length; i++) {
        if (tt[i].kind !== 'subtitles' && tt[i].kind !== 'captions') continue;
        text.push({ g: 0, t: i, label: tt[i].label || '', lang: tt[i].language || '', name: '', ch: 0, sel: tt[i].mode === 'showing' });
        if (tt[i].mode === 'showing') textOn = true;
      }
    }
    setTimeout(function () { cb({ audio: audio, text: text, textOn: textOn }); }, 0);
  },
  selectTrack: function (kind, g, t) {
    var i;
    if (hls) {
      if (kind === 'audio') hls.audioTrack = t;
      else { hls.subtitleDisplay = t >= 0; hls.subtitleTrack = t; }
      return;
    }
    if (kind === 'audio' && V.audioTracks) { for (i = 0; i < V.audioTracks.length; i++) V.audioTracks[i].enabled = i === t; return; }
    var tt = V.textTracks;
    for (i = 0; i < tt.length; i++) tt[i].mode = i === t ? 'showing' : 'disabled';
  }
};

window.webapis = window.webapis || {};
webapis.avplay = av;
webapis.productinfo = { getModel: function () { return 'Browser'; }, getFirmware: function () { return navigator.userAgent; } };
window.tizen = window.tizen || {
  application: { getCurrentApplication: function () { return { exit: function () { try { window.close(); } catch (e) {} }, hide: function () {} }; } },
  tvinputdevice: { registerKey: function () {}, unregisterKey: function () {}, getSupportedKeys: function () { return []; } }
};
/* mouse + keyboard: use the touch layout (back buttons, on-screen player controls), keys still work */
document.documentElement.className += ' touch web';
})();
