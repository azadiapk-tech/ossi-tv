/* Sleep timer, in-app updates (Android build) and first-run playlist setup. */
(function () {
'use strict';
var O = window.O, t = O.t, M = O.modal;
var NAT = window.OssiNative || null;
var DESK = window.OssiDesk || null;   /* Windows app */

/* ================= sleep timer ================= */
var SL = O.sleep = { end: 0, mins: 0 };
var slT = 0, warned = false;
SL.OPTIONS = [0, 15, 30, 45, 60, 90, 120];
SL.left = function () { return SL.end ? Math.max(0, SL.end - Date.now()) : 0; };
SL.set = function (mins) {
  clearInterval(slT); warned = false;
  SL.mins = mins; SL.end = mins ? Date.now() + mins * 60000 : 0;
  if (mins) slT = setInterval(tick, 5000);
  O.toast(mins ? t('sleepSet').replace('%', mins) : t('sleepOff'));
};
function tick() {
  var l = SL.left();
  if (!SL.end) { clearInterval(slT); return; }
  if (l <= 60000 && !warned) {
    warned = true;
    M.open({ title: t('tSleep'), msg: t('sleepWarn'), rows: [
      { label: t('sleepMore'), onOk: function () { M.close(); SL.set(15); } },
      { label: t('sleepCancel'), onOk: function () { M.close(); SL.set(0); } },
      { label: t('close'), onOk: function () { M.close(); } }
    ] });
  }
  if (l <= 0) {
    clearInterval(slT); SL.end = 0;
    try { O.player.stop(); } catch (e) {}
    try { tizen.application.getCurrentApplication().exit(); } catch (e) { try { window.close(); } catch (e2) {} }
  }
}
SL.menu = function () {
  M.list(t('tSleep'), function () {
    var rows = SL.OPTIONS.map(function (m) {
      return { label: m ? m + ' ' + t('minutes') : t('off'), value: (SL.mins === m && (m === 0 || SL.end)) ? '✓' : '', onOk: function () { SL.set(m); M.close(); } };
    });
    if (SL.end) rows.unshift({ label: t('sleepLeft') + ': ' + Math.ceil(SL.left() / 60000) + ' ' + t('minutes'), dis: true });
    return rows;
  }, { idx: SL.end ? 1 : 0 });
};

/* ================= in-app update (GitHub releases) ================= */
var U = O.upd = { busy: false };
var REPO = (window.OSSI_CONFIG && OSSI_CONFIG.updateRepo) || '';
U.available = function () { return !!((NAT && NAT.versionCode && REPO) || (DESK && DESK.check)); };
U.check = function (manual) {
  if (!U.available()) { if (manual) O.toast(t('updNA')); return; }
  if (!manual) {
    var last = O.cfg.get('updChecked', 0);
    if (Date.now() - last < 6 * 3600000) return;
  }
  O.cfg.set('updChecked', Date.now());
  if (manual) O.toast(t('updChecking'));
  if (DESK) { DESK.check(!!manual); return; }   /* Windows: answers come back through __ossiUpd */
  O.getJSON('https://api.github.com/repos/' + REPO + '/releases/latest', function (r) {
    var code = parseInt(String(r && r.tag_name || '').replace(/\D/g, ''), 10) || 0, mine = NAT.versionCode();
    var asset = null;
    (r.assets || []).forEach(function (a) { if (/\.apk$/i.test(a.name)) asset = a; });
    if (!asset || code <= mine) { if (manual) O.toast(t('updNone')); return; }
    var notes = String(r.body || '').split('\n')[0].slice(0, 160);
    M.open({ title: t('updTitle'), msg: (r.name || '') + (notes ? '\n' + notes : ''), rows: [
      { label: t('updNow'), onOk: function () { M.close(); U.download(asset.browser_download_url); } },
      { label: t('later'), onOk: function () { M.close(); } }
    ] });
  }, function () { if (manual) O.toast(t('updFail')); }, 0);
};
U.download = function (url) {
  if (U.busy) return;
  U.busy = true;
  U.dlg = M.open({ title: t('updTitle'), msg: t('updDownloading') + ' 0%', rows: [{ label: t('hide'), onOk: function () { M.close(); } }] });
  NAT.downloadUpdate(url);
};
window.__ossiUpd = function (kind, n, txt) {
  if (kind === 'avail') {                       /* Windows: a newer version exists (txt = version) */
    M.open({ title: t('updTitle'), msg: 'Ossi TV ' + (txt || ''), rows: [
      { label: t('updNow'), onOk: function () { M.close(); U.busy = true;
          U.dlg = M.open({ title: t('updTitle'), msg: t('updDownloading') + ' 0%', rows: [{ label: t('hide'), onOk: function () { M.close(); } }] });
          DESK.download(); } },
      { label: t('later'), onOk: function () { M.close(); } }
    ] });
  } else if (kind === 'none') {
    O.toast(t('updNone'));
  } else if (kind === 'prog') {
    if (U.dlg && M.isOpen()) M.setMsg(t('updDownloading') + ' ' + (n >= 0 ? n + '%' : '…'));
  } else if (kind === 'perm') {
    U.busy = false; if (M.isOpen()) M.close();
    M.open({ title: t('updTitle'), msg: t('updPerm'), rows: [
      { label: t('updInstall'), onOk: function () { M.close(); NAT.installUpdate(); } },
      { label: t('later'), onOk: function () { M.close(); } }
    ] });
  } else if (kind === 'inst') {
    U.busy = false; if (M.isOpen()) M.close();
  } else if (kind === 'err') {
    U.busy = false; if (M.isOpen()) M.close();
    O.toast(t('updFail') + (txt ? ' (' + txt + ')' : ''));
  }
};

/* ================= login screen (server is fixed: username + password only) ================= */
O.needsSetup = function () { var p = O.pl || {}; return !p.user || !p.pass || !p.host || p.host === 'http://'; };
var LG = O.login = {}, lroot = null, lbuilt = false, fi = 0, busy = false;
var LI = {
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.2" fill="none" stroke="#9fb4ff" stroke-width="2"/><path d="M4 20.5c1.2-4 4.3-6 8-6s6.8 2 8 6" fill="none" stroke="#9fb4ff" stroke-width="2" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" fill="none" stroke="#9fb4ff" stroke-width="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="#9fb4ff" stroke-width="2"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="#c7d2fe" stroke-width="1.9"/><circle cx="12" cy="12" r="3" fill="#c7d2fe"/></svg>'
};
function lq(id) { return document.getElementById(id); }
function lbuild() {
  lroot = lq('login');
  lroot.innerHTML =
    '<div class="lg-wrap">' +
      '<div class="lg-logo"><img src="img/logo.png" alt="Ossi TV"></div>' +
      '<div class="lg-card">' +
        '<h1 dir="auto">' + O.esc(t('loginTitle')) + '</h1><p class="lg-sub" dir="auto">' + O.esc(t('loginSub')) + '</p>' +
        '<label class="lg-f" data-f="0"><span class="lg-ic">' + LI.user + '</span><input id="lgUser" type="text" enterkeyhint="next" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="' + O.esc(t('plUser')) + '"></label>' +
        '<label class="lg-f" data-f="1"><span class="lg-ic">' + LI.lock + '</span><input id="lgPass" type="password" enterkeyhint="go" autocomplete="current-password" placeholder="' + O.esc(t('plPass')) + '"><b class="lg-eye" id="lgEye">' + LI.eye + '</b></label>' +
        '<div class="lg-err" id="lgErr" dir="auto"></div>' +
        '<div class="lg-btn" data-f="2" id="lgGo">' + O.esc(t('loginBtn')) + '</div>' +
      '</div>' +
    '</div>';
  lq('lgGo').addEventListener('click', submit);
  lq('lgEye').addEventListener('click', function (e) { e.preventDefault(); var p = lq('lgPass'); p.type = p.type === 'password' ? 'text' : 'password'; });
  lq('lgUser').addEventListener('focus', function () { fi = 0; lpaint(); });
  lq('lgPass').addEventListener('focus', function () { fi = 1; lpaint(); });
  function fieldKey(next) {
    return function (e) {
      if ((e.keyCode || e.which) !== 13) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.isTrusted) { if (O.kb) O.kb(); return; }   /* remote OK: open the keyboard */
      next();
    };
  }
  lq('lgUser').addEventListener('keydown', fieldKey(function () { lq('lgPass').focus(); fi = 1; lpaint(); }), true);
  lq('lgPass').addEventListener('keydown', fieldKey(function () { lq('lgPass').blur(); if (NAT && NAT.hideKeyboard) NAT.hideKeyboard(); fi = 2; lpaint(); submit(); }), true);
  lbuilt = true;
}
function lpaint() {
  var els = lroot.querySelectorAll('[data-f]');
  for (var i = 0; i < els.length; i++) els[i].classList.toggle('focus', i === fi);
}
function lerr(msg) { var e = lq('lgErr'); e.textContent = msg || ''; e.classList.toggle('on', !!msg); }
function submit() {
  if (busy) return;
  var u = lq('lgUser').value.replace(/\s+/g, ''), p = lq('lgPass').value.replace(/\s+/g, '');
  if (!u || !p) { lerr(t('fillAll')); return; }
  var host = O.fixedHost() || (O.pl && O.pl.host) || '';
  busy = true; lerr(''); lq('lgGo').classList.add('busy'); lq('lgGo').textContent = t('loginWait');
  function done() { busy = false; lq('lgGo').classList.remove('busy'); lq('lgGo').textContent = t('loginBtn'); }
  function okLogin(d) {
    done();
    var ui = d && d.user_info;
    if (!ui || +ui.auth !== 1) { lerr(t('loginBad')); return; }
    var st = String(ui.status || '').toLowerCase();
    if (st && st !== 'active') { lerr(st === 'expired' ? t('subExpired') : t('loginBad') + ' (' + ui.status + ')'); return; }
    var l = O.plList();
    l.forEach(function (x) { if (x.id === O.pl.id) { x.host = host; x.user = u; x.pass = p; if (!x.name || x.name === 'Ossi') x.name = u; } });
    O.plSave(l);
    O.app.switchPlaylist(O.pl.id);
  }
  O.getJSON(host + '/player_api.php?username=' + O.enc(u) + '&password=' + O.enc(p), okLogin, function (why) {
    done();
    why = String(why || '');
    /* the server answered, but not with a login reply (e.g. HTTP 403): show what it said */
    lerr(/^HTTP/.test(why) ? t('loginSrv') + ' ' + why : t('loginNet'));
  }, 1);
}
LG.show = function () {
  if (!lbuilt) lbuild();
  lroot.classList.remove('hidden'); fi = 0; lpaint(); lerr('');
  lq('lgUser').value = (O.pl && O.pl.user) || ''; lq('lgPass').value = ''; lq('lgPass').type = 'password';
};
LG.hide = function () { if (lroot) lroot.classList.add('hidden'); };
LG.relang = function () { lbuilt = false; };
LG.onKey = function (e, k) {
  var K = O.K, used = true;
  if (k === K.UP) { if (fi > 0) fi--; lpaint(); }
  else if (k === K.DOWN) { if (fi < 2) fi++; lpaint(); }
  else if (k === K.ENTER) { if (fi === 2) submit(); else lq(fi === 0 ? 'lgUser' : 'lgPass').focus(); }
  else if (k === K.BACK || k === K.ESC || k === K.EXIT) O.app.confirmExit();
  else used = false;
  if (used) e.preventDefault();
  return used;
};
/* sign out: forget user/password of the active account and show the login screen */
O.logout = function () {
  var l = O.plList();
  l.forEach(function (x) { if (x.id === O.pl.id) { x.user = ''; x.pass = ''; } });
  O.plSave(l);
  try { O.player.stop(); } catch (e) {}
  O.plSetActive(O.pl.id); O.data.reset();
  O.app.go('login');
};
})();
