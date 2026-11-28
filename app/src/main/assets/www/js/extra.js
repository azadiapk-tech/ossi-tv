/* Sleep timer, in-app updates (Android build) and first-run playlist setup. */
(function () {
'use strict';
var O = window.O, t = O.t, M = O.modal, $ = O.$, esc = O.esc, K = O.K;
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

/* ================= the app's own search keyboard (TV remotes) =================
   Fire TV has no Arabic system keyboard, so on TVs the search boxes use this one: Arabic + German, moved with the arrows. */
var OSK = O.osk = {};
var KB = { el: null, inp: null, lang: 'ar', r: 1, c: 0 };
/* rows are written in screen order (left -> right), like the Arabic keyboard on Samsung / Android phones: ض at the left. */
function rv(a) { return a.slice().reverse(); }
var LAY = {
  ar: [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '+'],
       ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج'],
       ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
       ['ذ', 'ء', 'ؤ', 'ر', 'ى', 'ة', 'و', 'ز', 'ظ', 'د', 'ئ'],
       ['أ', 'إ', 'آ', 'لا', '-', '.', ':', '!', '؟', '،', '&']],
  de: [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'ß'],
       ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
       ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
       ['y', 'x', 'c', 'v', 'b', 'n', 'm', '-', '.', '&', ':']]
};
var BOT = [{ a: 'lang' }, { a: 'space' }, { a: 'bs' }, { a: 'clear' }, { a: 'done' }];
function kRows() { return LAY[KB.lang].map(function (r) { return r.map(function (ch) { return { t: ch }; }); }).concat([BOT]); }
function kLabel(k) {
  if (k.t) return k.t;
  return { lang: KB.lang === 'ar' ? 'Deutsch' : 'عربي', space: t('oskSpace'), bs: '⌫', clear: t('oskClear'), done: t('oskDone') }[k.a];
}
function kDraw() {
  var R = kRows(), dir = 'ltr';
  var h = '<div class="osk-txt" dir="auto">' + esc(KB.inp.value) + '<i class="osk-caret"></i></div>';
  R.forEach(function (row, ri) {
    h += '<div class="osk-row' + (ri === R.length - 1 ? ' bot' : '') + '" dir="' + dir + '">';
    row.forEach(function (k, ci) {
      h += '<b class="ky' + (k.a ? ' a-' + k.a : '') + (ri === KB.r && ci === KB.c ? ' focus' : '') + '" data-r="' + ri + '" data-c="' + ci + '">' + esc(kLabel(k)) + '</b>';
    });
    h += '</div>';
  });
  KB.el.innerHTML = h;
}
function kType(v) {
  var inp = KB.inp; if (!inp) return;
  inp.value = v;
  try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) { var ev = document.createEvent('Event'); ev.initEvent('input', true, true); inp.dispatchEvent(ev); }
  kDraw();
}
function kPress(k) {
  var v = KB.inp.value;
  if (k.t) kType(v + k.t);
  else if (k.a === 'space') kType(v + ' ');
  else if (k.a === 'bs') kType(v.slice(0, -1));
  else if (k.a === 'clear') kType('');
  else if (k.a === 'lang') { KB.lang = KB.lang === 'ar' ? 'de' : 'ar'; O.cfg.set('oskLang', KB.lang); KB.r = kRows().length - 1; kDraw(); }
  else if (k.a === 'done') OSK.close();
}
/* TV: search boxes are read-only, so the system keyboard can never pop up over the app's own one */
setInterval(function () {
  if (O.isTouch()) return;
  var l = document.querySelectorAll('input.srch:not([readonly])');
  for (var i = 0; i < l.length; i++) { l[i].setAttribute('readonly', 'readonly'); l[i].setAttribute('inputmode', 'none'); }
}, 1000);
OSK.isOpen = function () { return !!KB.inp; };
OSK.open = function (inp) {
  if (!inp) return;
  if (!KB.el) {
    KB.el = document.createElement('div'); KB.el.id = 'osk'; $('stage').appendChild(KB.el);
    KB.el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.ky'); if (!b || !KB.inp) return;
      KB.r = +b.getAttribute('data-r'); KB.c = +b.getAttribute('data-c'); kPress(kRows()[KB.r][KB.c]);
    });
  }
  KB.inp = inp; KB.lang = O.cfg.get('oskLang', 'ar'); KB.r = 1; KB.c = 0;   /* start on ض / q */
  inp.classList.add('osk-on');
  KB.el.classList.remove('hidden'); kDraw();
};
OSK.close = function () {
  if (!KB.inp) return;
  KB.inp.classList.remove('osk-on'); KB.inp = null;
  if (KB.el) { KB.el.classList.add('hidden'); KB.el.innerHTML = ''; }
};
OSK.onKey = function (e, k) {
  var R = kRows(), row = R[KB.r];
  if (k === K.LEFT) KB.c = O.clamp(KB.c - 1, 0, row.length - 1);
  else if (k === K.RIGHT) KB.c = O.clamp(KB.c + 1, 0, row.length - 1);
  else if (k === K.UP || k === K.DOWN) {
    var nr = O.clamp(KB.r + (k === K.UP ? -1 : 1), 0, R.length - 1);
    if (nr !== KB.r) { var f = row.length > 1 ? KB.c / (row.length - 1) : 0; KB.r = nr; KB.c = Math.round(f * (R[nr].length - 1)); }
  }
  else if (k === K.ENTER) { kPress(row[KB.c]); e.preventDefault(); return; }
  else if (k === K.BACK || k === K.ESC) OSK.close();
  else if (k === K.BS) kType(KB.inp.value.slice(0, -1));
  else if (k >= 48 && k <= 57) kType(KB.inp.value + (k - 48));
  else { e.preventDefault(); return; }
  if (KB.inp) kDraw();
  e.preventDefault();
};
/* search boxes: TV -> the app keyboard, phone / PC -> the normal keyboard */
O.searchKb = function (inp) {
  if (!inp) return;
  if (O.isTouch()) { inp.removeAttribute('readonly'); inp.focus(); return; }
  OSK.open(inp);
};


/* ================= digital clock (top left; switched on in the player's ☰ options, remembered) ================= */
var CK = O.clock = {}, ckEl = null;
function p2(n) { return (n < 10 ? '0' : '') + n; }
CK.on = function () { return !!O.cfg.get('clock', false); };
CK.toggle = function () { O.cfg.set('clock', !CK.on()); CK.tick(); };
CK.tick = function () {
  if (!ckEl) { ckEl = document.createElement('div'); ckEl.id = 'clock'; ckEl.className = 'hidden'; var st = $('stage'); if (!st) return; st.appendChild(ckEl); }
  var cur = O.app && O.app.cur ? O.app.cur() : '', inPl = !!(O.pui && O.pui.active);
  var show = CK.on() && (inPl || /^(live|movies|series|detail|matches)$/.test(cur));
  ckEl.classList.toggle('hidden', !show);
  ckEl.classList.toggle('inpl', inPl);
  if (!show) return;
  var d = new Date(), tx = p2(d.getHours()) + ':' + p2(d.getMinutes()); if (ckEl.textContent !== tx) ckEl.textContent = tx;
  /* in the player: top right corner; in the lists: right next to the home button(s) */
  if (inPl) { ckEl.style.left = ((O.stageW || 1920) - ckEl.offsetWidth - 40) + 'px'; return; }
  var root = $({ live: 'live', movies: 'vodm', series: 'vods', detail: 'detail', matches: 'matches' }[cur]), x = 0;
  if (root) [].forEach.call(root.querySelectorAll('.hbtn'), function (b) { if (b.offsetParent !== null && (!x || b.offsetLeft < x)) x = b.offsetLeft; });
  ckEl.style.left = Math.max(300, (x || 1790) - ckEl.offsetWidth - 24) + 'px';
};
setInterval(CK.tick, 1000);

})();