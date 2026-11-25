/* App router, global key handling, boot. */
(function () {
'use strict';
var O = window.O, $ = O.$, K = O.K, t = O.t, D = O.data, Pl = O.player;
var scr, parent = { live: 'home', movies: 'home', series: 'home', settings: 'home', detail: 'series', multi: 'settings' };
var cur = null;

O.app = {
  go: function (name, arg) {
    if (cur && scr[cur] && scr[cur].hide) scr[cur].hide();
    cur = name; scr[name].show(arg);
  },
  back: function () { O.app.go(parent[cur] || 'home'); },
  setParent: function (k, v) { parent[k] = v; },
  cur: function () { return cur; },
  confirmExit: function () {
    O.modal.confirm(t('exitTitle'), t('exitMsg'), function () {
      try { tizen.application.getCurrentApplication().exit(); } catch (e) { try { window.close(); } catch (e2) {} }
    }, null, true);
  },
  reload: function () {
    Pl.stop(); D.reset();
    ['live', 'movies', 'series'].forEach(function (k) { if (scr[k].refreshData) scr[k].refreshData(); });
    D.loadInfo(null, null);
    var c = cur; if (c) O.app.go(c === 'detail' ? (parent.detail || 'home') : c);
  },
  relang: function () {
    Object.keys(scr).forEach(function (k) { if (scr[k].relang) scr[k].relang(); });
    document.documentElement.lang = O.lang();
    var c = cur; O.app.go(c === 'detail' ? (parent.detail || 'home') : c);
  },
  switchPlaylist: function (id) {
    Pl.stop(); O.plSetActive(id); D.reset();
    ['live', 'movies', 'series'].forEach(function (k) { if (scr[k].refreshData) scr[k].refreshData(); });
    D.loadInfo(null, null);
    O.app.go('home'); O.toast(t('playlist') + ': ' + O.pl.name);
  }
};

/* ---------- keys ---------- */
var NAT = window.OssiNative || null, kbLast = 0;
/* TV remotes: open the on-screen keyboard only when the user presses OK on a text field (never automatically) */
O.kb = function () {
  if (!NAT || !NAT.showKeyboard || Date.now() - kbLast < 1500) return;
  kbLast = Date.now(); NAT.showKeyboard();
};
var redT = 0, redFired = false, redHeld = false, okT = 0, okSafe = 0, okHeld = false, okLong = false;
function digitOf(k) { return (k >= 48 && k <= 57) ? k - 48 : (k >= 96 && k <= 105 ? k - 96 : -1); }

function onKey(e) {
  var k = e.keyCode || e.which;
  var ae = document.activeElement;
  if (ae && ae.tagName === 'INPUT') {
    /* remote OK on a text field (synthetic key, not the keyboard's own Enter) = open the on-screen keyboard */
    if (k === K.ENTER && !e.isTrusted && NAT) { O.kb(); e.preventDefault(); return; }
    if (k === K.ENTER || k === K.BACK || k === K.ESC) { ae.blur(); e.preventDefault(); return; }
    if (k === K.UP || k === K.DOWN) ae.blur(); else return;
  }
  if (O.modal.isOpen()) { if (k !== K.MENU) O.modal.onKey(e, k); else e.preventDefault(); return; }

  /* OK held (~0.65s) in lists = start re-ordering; a short press acts on key release */
  if (k === K.ENTER && !e.fromRelease) {
    if (okHeld) { e.preventDefault(); return; }
    var sc = scr[cur];
    if (!O.pui.active && !O.live.overlayOpen() && sc && sc.canLongOk && sc.canLongOk()) {
      okHeld = true; okLong = false; e.preventDefault();
      clearTimeout(okT);
      okT = setTimeout(function () { okLong = true; if (sc.onLongOk) sc.onLongOk(); }, 650);
      clearTimeout(okSafe); okSafe = setTimeout(function () { okHeld = false; }, 4000);
      return;
    }
  }

  if (k === K.RED) {
    if (cur !== 'live' || O.pui.active || O.live.overlayOpen()) return;
    e.preventDefault();
    if (redHeld) return; redHeld = true; redFired = false;
    if (O.live.editing()) { redFired = true; O.live.onRed('save'); return; }
    redT = setTimeout(function () { redFired = true; O.live.onRed('long'); }, 800);
    return;
  }
  var d = digitOf(k);
  if (d > -1) {
    if (O.pui.active && O.pui.kind === 'live' || cur === 'live') { O.numKey(d, O.live.gotoNumber); e.preventDefault(); }
    return;
  }
  if (O.live.overlayOpen()) { O.live.onKey(e, k); return; }
  if (O.pui.active) { O.pui.onKey(e, k); return; }
  if (cur && scr[cur].onKey) scr[cur].onKey(e, k);
  /* OK that moved the focus into a text field (search boxes, login) = open the keyboard once */
  if (k === K.ENTER && !e.isTrusted && document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement !== ae) O.kb();
}
function onKeyUp(e) {
  var k = e.keyCode || e.which;
  if (k === K.RED) { clearTimeout(redT); redHeld = false; }
  if (k === K.ENTER && okHeld) {
    okHeld = false; clearTimeout(okT); clearTimeout(okSafe);
    if (!okLong) onKey({ keyCode: K.ENTER, which: K.ENTER, fromRelease: true, preventDefault: function () {} });
  }
}
function registerKeys() {
  try {
    ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'ChannelUp', 'ChannelDown', 'MediaPlay', 'MediaPause',
     'MediaPlayPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'Info', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
      .forEach(function (n) { try { tizen.tvinputdevice.registerKey(n); } catch (e) {} });
  } catch (e) {}
}
/* The stage is 1080 high; its width follows the screen shape (1920 on 16:9 TVs, wider on long phones). */
function fit() {
  var iw = window.innerWidth || 1920, ih = window.innerHeight || 1080;
  var W = Math.round(Math.min(2600, Math.max(1920, 1080 * iw / ih)));
  O.stageW = W; O.stageX = W - 1920;
  var ds = document.documentElement.style;
  ds.setProperty('--W', W + 'px'); ds.setProperty('--X', O.stageX + 'px'); ds.setProperty('--X2', Math.round(O.stageX / 2) + 'px');
  /* live screen on wide screens: ~30% of the extra width to the channel list, the rest to the preview */
  O.stageXC = Math.round(O.stageX * 0.3); O.stageXP = O.stageX - O.stageXC;
  ds.setProperty('--XC', O.stageXC + 'px'); ds.setProperty('--XP', O.stageXP + 'px');
  var s = Math.min(iw / W, ih / 1080), st = $('stage');
  st.style.transform = s === 1 ? 'none' : 'scale(' + s + ')';
  st.style.left = Math.max(0, Math.round((iw - W * s) / 2)) + 'px';
  st.style.top = Math.max(0, Math.round((ih - 1080 * s) / 2)) + 'px';
}
function hideSplash() {
  var sp = $('splash'); if (!sp) return;
  setTimeout(function () { sp.className = 'out'; setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 700); }, 1300);
}

function boot() {
  scr = { login: O.login, home: O.home, live: O.live, movies: O.movies, series: O.series, detail: O.detail, settings: O.settings, multi: O.multi };
  O.plInit(); fit(); registerKeys();
  document.documentElement.lang = O.lang();
  /* a fresh start always loads fresh data; the account info is retried if the first try fails */
  D.loadInfo(null, function () { setTimeout(function () { if (!D.info) D.loadInfo(null, null); }, 5000); });
  O.app.go(O.needsSetup() ? 'login' : 'home');
  hideSplash();
  setTimeout(function () { if (!O.needsSetup() && O.upd) O.upd.check(false); }, 1500);
}
/* ---------- coming back to the app after a while: refresh the subscription data once ----------
   (phones and the Fire TV keep the app alive in the background, so "opening" it is often just a return) */
var hiddenAt = 0, lastAuto = 0;
O.app.autoRefresh = function (awayMs) {
  if (!scr || O.needsSetup() || awayMs < 5 * 60000 || Date.now() - lastAuto < 60000) return;
  lastAuto = Date.now();
  var busy = (O.pui && O.pui.active) || (Pl.st && Pl.st !== 'idle') || cur === 'detail' || cur === 'login' || (O.modal && O.modal.isOpen && O.modal.isOpen());
  if (busy) { D.loadInfo(null, null); return; }      /* never interrupt what is on screen: only the account info */
  O.app.reload(); O.toast(t('updated'));
};
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (hiddenAt) { var away = Date.now() - hiddenAt; hiddenAt = 0; O.app.autoRefresh(away); }
});
window.__ossiResume = function (awayMs) { O.app.autoRefresh(+awayMs || 0); };   /* sent by the Android app */

document.addEventListener('keydown', onKey);
O.app.key = function (code) { onKey({ keyCode: code, which: code, preventDefault: function () {} }); };
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('[data-back]');
  if (b) { e.stopPropagation(); O.app.key(O.K.BACK); }
}, true);
document.addEventListener('keyup', onKeyUp);
window.addEventListener('resize', fit);
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { Pl.stop(); }
  else if (cur === 'live' || cur === 'multi') { O.app.go(cur); }
});
window.addEventListener('load', boot);
})();
