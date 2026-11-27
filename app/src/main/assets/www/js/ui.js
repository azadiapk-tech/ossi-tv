/* Shared UI: key codes, toast, number entry, modal dialogs, fullscreen player overlays. */
(function () {
'use strict';
var O = window.O, $ = O.$, esc = O.esc;

O.K = { BACK: 10009, ESC: 27, BS: 8, ENTER: 13, LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, PGUP: 33, PGDN: 34,
        CHUP: 427, CHDN: 428, STOP: 413, PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, FF: 417, RW: 412, INFO: 457,
        RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406, EXIT: 10182, MENU: 18 };
var K = O.K;

/* ---------- toast ---------- */
var toastT = 0;
O.toast = function (s) {
  var t = $('toast'); t.textContent = s; t.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, 3200);
};

/* ---------- number entry (channel numbers) ---------- */
var numBuf = '', numT = 0;
O.numKey = function (d, cb) {
  numBuf = (numBuf + d).slice(-4);
  var b = $('numBadge'); b.textContent = numBuf; b.classList.remove('hidden');
  clearTimeout(numT);
  numT = setTimeout(function () { var n = parseInt(numBuf, 10); numBuf = ''; b.classList.add('hidden'); cb(n); }, 1400);
};

/* ---------- modal ---------- */
O.isTouch = function () { return document.documentElement.className.indexOf('touch') > -1; };
var M = O.modal = {};
var stack = [], cur = null, root = null;
var PINK = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'b', 0, 'ok'];
function pinPress(k) {
  if (k === 'b') { cur.buf = cur.buf.slice(0, -1); render(); return; }
  if (k === 'ok') { if (cur.buf.length === 4) { var cb0 = cur.onDone, p0 = cur.buf; M.close(); setTimeout(function () { cb0(p0); }, 0); } return; }
  cur.buf += k; render();
  if (cur.buf.length === 4) { var cb = cur.onDone, p = cur.buf; M.close(); setTimeout(function () { cb(p); }, 0); }
}
function rootEl() { return root || (root = $('modal')); }
function render() {
  var r = rootEl();
  if (!cur) { r.classList.add('hidden'); r.innerHTML = ''; return; }
  r.classList.remove('hidden');
  r.classList.toggle('light', !!cur.light);   /* light backdrop: the picture stays visible behind the menu */
  if (cur.build) cur.rows = cur.build();
  var h = '<div class="mbox"><h2 dir="auto">' + esc(cur.title) + '</h2>';
  if (cur.msg) h += '<div class="mmsg">' + esc(cur.msg) + '</div>';
  if (cur.type === 'pin') {
    h += '<div class="pindots">';
    for (var d = 0; d < 4; d++) h += '<i class="' + (d < cur.buf.length ? 'on' : '') + '"></i>';
    h += '</div>';
    /* number pad (phone: tap, TV remote: arrows + OK) — Fire TV remotes have no number keys */
    h += '<div class="pinpad">';
    PINK.forEach(function (k, i) {
      h += '<b data-d="' + k + '"' + (!O.isTouch() && i === (cur.pk || 0) ? ' class="focus"' : '') + '>' + (k === 'b' ? '⌫' : k === 'ok' ? 'OK' : k) + '</b>';
    });
    h += '</div>';
  }
  if (cur.rows) {
    h += '<div class="mrows">';
    cur.rows.forEach(function (row, i) {
      h += '<div class="mr' + (row.dis ? ' dis' : '') + '" data-i="' + i + '"><span class="ml" dir="auto">' + esc(row.label) + '</span>';
      if (row.input) h += '<input data-k="' + esc(row.key) + '" type="' + (row.type || 'text') + '" value="' + esc(row.value || '') + '">';
      else if (row.value != null && row.value !== '') h += '<span class="mv" dir="auto">' + esc(row.value) + '</span>';
      h += '</div>';
    });
    h += '</div>';
  }
  if (cur.foot) h += '<div class="mfoot">' + esc(cur.foot) + '</div>';
  r.innerHTML = h + '</div>';
  paint();
}
function paint() {
  if (!cur || !cur.rows) return;
  var box = rootEl().querySelector('.mrows'); if (!box) return;
  var els = box.querySelectorAll('.mr');
  for (var i = 0; i < els.length; i++) els[i].classList.toggle('focus', i === cur.idx);
  var el = els[cur.idx];
  if (el) {
    var t = el.offsetTop, b = t + el.offsetHeight;
    if (t < box.scrollTop) box.scrollTop = t; else if (b > box.scrollTop + box.clientHeight) box.scrollTop = b - box.clientHeight;
  }
}
function act(i) {
  var row = cur && cur.rows && cur.rows[i];
  if (!row || row.dis) return;
  if (row.input) { var inp = rootEl().querySelectorAll('.mr')[i].querySelector('input'); if (inp) inp.focus(); return; }
  if (row.onOk) row.onOk(row, i);
}
M.isOpen = function () { return !!cur; };
M.open = function (cfg) { cfg.idx = cfg.idx || 0; stack.push(cfg); cur = cfg; render(); return cfg; };
M.close = function () { stack.pop(); cur = stack[stack.length - 1] || null; render(); };
M.closeAll = function () { stack = []; cur = null; render(); };
M.refresh = function () { render(); };
M.setMsg = function (m) { if (cur) { cur.msg = m; render(); } };
/* build: function returning rows [{label,value,onOk,dis}] — re-run on refresh() */
M.list = function (title, build, opts) {
  opts = opts || {};
  return M.open({ title: title, msg: opts.msg, build: build, idx: opts.idx || 0, onBack: opts.onBack, foot: opts.foot, light: opts.light });
};
M.confirm = function (title, msg, yes, no, defNo) {
  M.open({
    title: title, msg: msg, idx: defNo ? 1 : 0,
    rows: [
      { label: O.t('yes'), onOk: function () { M.close(); if (yes) yes(); } },
      { label: O.t('no'), onOk: function () { M.close(); if (no) no(); } }
    ]
  });
};
M.message = function (title, msg, done) {
  M.open({ title: title, msg: msg, rows: [{ label: 'OK', onOk: function () { M.close(); if (done) done(); } }] });
};
M.pin = function (title, cb) {
  M.open({ type: 'pin', title: title, buf: '', onDone: cb, foot: O.t('pinHint') });
};
M.form = function (title, fields, onSave) {
  var rows = fields.map(function (f) { return { label: f.label, input: true, key: f.key, value: f.value, type: f.type }; });
  rows.push({ label: O.t('save'), onOk: function () {
    var out = {}, ins = rootEl().querySelectorAll('input');
    for (var i = 0; i < ins.length; i++) out[ins[i].getAttribute('data-k')] = ins[i].value;
    onSave(out);
  } });
  rows.push({ label: O.t('cancel'), onOk: function () { M.close(); } });
  return M.open({ title: title, rows: rows, foot: O.t('formHint') });
};
M.onKey = function (e, k) {
  if (!cur) return false;
  if (cur.type === 'pin') {
    var dg = (k >= 48 && k <= 57) ? k - 48 : (k >= 96 && k <= 105 ? k - 96 : -1), pk = cur.pk || 0;
    if (dg > -1) pinPress(dg);
    else if (k === K.LEFT || k === K.RIGHT) { cur.pk = Math.floor(pk / 3) * 3 + (pk % 3 + (k === K.RIGHT ? 1 : 2)) % 3; render(); }
    else if (k === K.UP || k === K.DOWN) { cur.pk = (pk + (k === K.DOWN ? 3 : 9)) % 12; render(); }
    else if (k === K.ENTER) pinPress(PINK[pk]);
    else if (k === K.BS) pinPress('b');
    else if (k === K.BACK || k === K.ESC) M.close();
    e.preventDefault(); return true;
  }
  if (k === K.UP || k === K.DOWN) {
    var n = cur.rows.length, i = cur.idx, d = k === K.UP ? -1 : 1, g = 0;
    do { i += d; g++; } while (i >= 0 && i < n && cur.rows[i].dis && g < n);
    if (i >= 0 && i < n) { cur.idx = i; paint(); if (cur.rows[i].onFocus) cur.rows[i].onFocus(cur.rows[i], i); }
  } else if (k === K.ENTER) act(cur.idx);
  else if (k === K.BACK || k === K.ESC || k === K.EXIT) { if (cur.onBack) cur.onBack(); else M.close(); }
  e.preventDefault(); return true;
};
document.addEventListener('click', function (e) {
  if (cur && e.target === rootEl()) { if (cur.onBack) cur.onBack(); else M.close(); return; }
  if (cur && cur.type === 'pin') {
    var pd = e.target.closest && e.target.closest('[data-d]');
    if (pd) { var v = pd.getAttribute('data-d'); pinPress(v === 'b' || v === 'ok' ? v : parseInt(v, 10)); }
    return;
  }
  if (!cur || !cur.rows) return;
  var t = e.target;
  while (t && t.getAttribute && t.getAttribute('data-i') === null) t = t.parentNode;
  if (t && t.getAttribute && rootEl().contains(t)) { cur.idx = parseInt(t.getAttribute('data-i'), 10); paint(); act(cur.idx); }
});

/* ---------- fullscreen player overlays ---------- */
var Pui = O.pui = { active: false, kind: null, h: null };
var NAT = window.OssiNative || window.OssiVB || null, briSet = false, NU = null;   /* OssiVB: Windows volume/brightness */
var infoT = 0, barT = 0, vodTitle = '', vodSub = '', seekShow = null;
function ctl(on) {
  var c = $('pCtl'); if (!c) return;
  var was = c.classList.contains('show');
  c.classList.toggle('show', on);
  if (on && !was) slRefresh();
}
/* ----- on-screen volume (right) and brightness (left) bars ----- */
var SLV = { vol: 0.5, bri: 0.5 };
function slOk() { return !!(NAT && NAT.getVolume && NAT.getBrightness); }
function slDraw(k, v) {
  var el = $('pCtl') && $('pCtl').querySelector('[data-sl="' + k + '"]'); if (!el) return;
  el.querySelector('.sl-tr i').style.height = Math.round(v * 100) + '%';
  el.querySelector('.sl-v').textContent = Math.round(v * 100) + '%';
}
function slRefresh() {
  if (!slOk()) return;
  SLV.vol = NAT.getVolume(); SLV.bri = NAT.getBrightness();
  slDraw('vol', SLV.vol); slDraw('bri', SLV.bri);
}
function keepUi() { if (Pui.kind === 'live') showInfo(); else showBar(); }
function slSet(k, v) {
  v = O.clamp(v, 0, 1); SLV[k] = v;
  if (k === 'vol') NAT.setVolume(v); else { NAT.setBrightness(Math.max(0.02, v)); briSet = true; }
  slDraw(k, v); keepUi();
}
function showInfo(keep) {
  var el = $('pInfo'); el.classList.add('show'); ctl(true); clearTimeout(infoT);
  if (!keep) infoT = setTimeout(function () { el.classList.remove('show'); ctl(false); }, 8000);
}
function showBar(keep) {
  var el = $('pVod'); el.classList.add('show'); ctl(true); clearTimeout(barT);
  if (!keep && O.player.st !== 'paused') barT = setTimeout(function () { el.classList.remove('show'); ctl(false); }, 4500);
}
function hideUi() {
  clearTimeout(infoT); clearTimeout(barT);
  $('pInfo').classList.remove('show'); $('pVod').classList.remove('show'); ctl(false);
}
var SV = {
  back: '<svg viewBox="0 0 24 24"><path d="M15.5 4.5 8 12l7.5 7.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rw: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><text x="12.3" y="16.6" font-size="6.4" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial">10</text></svg>',
  ff: '<svg viewBox="0 0 24 24"><path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><text x="11.7" y="16.6" font-size="6.4" font-weight="700" fill="#fff" text-anchor="middle" font-family="Arial">10</text></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="#fff"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="#fff"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="#fff"/></svg>',
  audio: '<svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="#fff" stroke-width="1.9"/><rect x="3" y="13" width="4.5" height="7" rx="1.6" fill="#fff"/><rect x="16.5" y="13" width="4.5" height="7" rx="1.6" fill="#fff"/></svg>',
  subs: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke="#fff" stroke-width="1.9"/><path d="M6.5 11.5h4M12.5 11.5h5M6.5 15h7M15.5 15h2" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  aspect: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="#fff" stroke-width="1.9"/><path d="M6 9.5V8h2.5M18 9.5V8h-2.5M6 14.5V16h2.5M18 14.5V16h-2.5" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pip: '<svg viewBox="0 0 24 24"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5" fill="none" stroke="#fff" stroke-width="1.9"/><rect x="11.5" y="11" width="7.5" height="6" rx="1.2" fill="#fff"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="none" stroke="#fff" stroke-width="1.9" stroke-linejoin="round"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="#fff"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  bri: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" fill="#fff"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
function buildCtl() {
  var pl = $('player'); if ($('pTouch')) return;
  var tl = document.createElement('div'); tl.id = 'pTouch'; pl.insertBefore(tl, pl.firstChild);
  var c = document.createElement('div'); c.id = 'pCtl';
  c.innerHTML =
    '<div class="pc-tl"><b class="pcb" data-a="back">' + SV.back + '</b>' +
    (NAT && NAT.canPip && NAT.canPip() ? '<b class="pcb" data-a="pip">' + SV.pip + '</b>' : '') +
    '<b class="pcb" data-a="sleep">' + SV.moon + '</b></div>' +
    (slOk() ? ['bri', 'vol'].map(function (k) {
      return '<div class="pc-sl ' + k + '" data-sl="' + k + '"><span class="sl-ic">' + (k === 'vol' ? SV.vol : SV.bri) + '</span>' +
        '<b class="sl-b" data-sa="up">+</b><div class="sl-tr"><i></i></div><b class="sl-b" data-sa="dn">−</b><span class="sl-v"></span></div>';
    }).join('') : '') +
    '<div class="pc-gest" id="pcGest"><div class="pg-ic"></div><div class="pg-bar"><b></b></div><span></span></div>' +
    '<div class="pc-tr"><b class="pcb vodonly" data-a="audio">' + SV.audio + '<i>' + esc(O.t('audioTrack')) + '</i></b><b class="pcb vodonly" data-a="subs">' + SV.subs + '<i>' + esc(O.t('subsTrack')) + '</i></b>' +
    '<b class="pcb" data-a="aspect">' + SV.aspect + '<i id="pcAsp"></i></b></div>' +
    '<div class="pc-mid vodonly"><b class="pcb big" data-a="rw">' + SV.rw + '</b><b class="pcb huge" data-a="pp" id="pcPP">' + SV.pause + '</b><b class="pcb big" data-a="ff">' + SV.ff + '</b></div>' +
    '<div class="pc-mid liveonly"><b class="pcb big" data-a="chdn">' + SV.down + '</b><b class="pcb huge" data-a="list">' + SV.list + '</b><b class="pcb big" data-a="chup">' + SV.up + '</b></div>' +
    '<div class="pc-flash" id="pcFlash"></div>';
  pl.appendChild(c);
  c.addEventListener('click', function (e) {
    var sb = e.target.closest && e.target.closest('[data-sa]');
    if (sb) {
      e.stopPropagation();
      var k = sb.parentNode.getAttribute('data-sl'), step = k === 'vol' ? 1 / 15 : 0.1;
      slSet(k, SLV[k] + (sb.getAttribute('data-sa') === 'up' ? step : -step)); return;
    }
    var b = e.target.closest && e.target.closest('[data-a]'); if (!b) return;
    e.stopPropagation(); ctlAction(b.getAttribute('data-a'));
  });
  /* swipe up/down: right half = volume, left half = brightness; pinch = zoom / fit */
  var gs = null;
  function dist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy) || 1; }
  function gestInd(kind, v) {
    SLV[kind] = v;
    if ($('pCtl').classList.contains('show') && slOk()) { slDraw(kind, v); keepUi(); return; }
    var g = $('pcGest'); if (!g) return;
    g.querySelector('.pg-ic').innerHTML = kind === 'vol' ? SV.vol : SV.bri;
    g.querySelector('b').style.height = Math.round(v * 100) + '%';
    g.querySelector('span').textContent = Math.round(v * 100) + '%';
    g.className = 'pc-gest on ' + kind; clearTimeout(g._t); g._t = setTimeout(function () { g.className = 'pc-gest'; }, 800);
  }
  tl.addEventListener('touchstart', function (e) {
    if (!NAT || !Pui.active) { gs = null; return; }
    if (e.touches.length === 2) { gs = { pinch: true, d0: dist(e.touches) }; return; }
    var t0 = e.touches[0]; gs = { x: t0.clientX, y: t0.clientY, mode: null };
  }, { passive: true });
  tl.addEventListener('touchmove', function (e) {
    if (!gs) return;
    if (e.touches.length === 2) {
      if (!gs.pinch) gs = { pinch: true, d0: dist(e.touches) };
      e.preventDefault();
      var r = dist(e.touches) / gs.d0;
      if (!gs.done && (r > 1.18 || r < 0.85)) { gs.done = true; setAspect(r > 1 ? 'zoom' : 'fit'); }
      return;
    }
    if (gs.pinch) return;
    var t0 = e.touches[0], dx = t0.clientX - gs.x, dy = t0.clientY - gs.y;
    if (!gs.mode) {
      if (Math.abs(dy) > 18 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        gs.mode = gs.x > (window.innerWidth || 1) / 2 ? 'vol' : 'bri';
        gs.v0 = gs.mode === 'vol' ? NAT.getVolume() : NAT.getBrightness(); gs.y = t0.clientY;
      } else return;
    }
    e.preventDefault();
    var v = O.clamp(gs.v0 - (t0.clientY - gs.y) / ((window.innerHeight || 400) * 0.6), 0, 1);
    if (gs.mode === 'vol') NAT.setVolume(v); else { NAT.setBrightness(v); briSet = true; }
    gestInd(gs.mode, v);
  }, { passive: false });
  tl.addEventListener('touchend', function (e) { if (!e.touches.length) gs = null; });
  /* mouse wheel over the picture = volume (Windows) */
  pl.addEventListener('wheel', function (e) {
    if (!Pui.active || !slOk()) return;
    e.preventDefault();
    var v = O.clamp(NAT.getVolume() + (e.deltaY < 0 ? 0.05 : -0.05), 0, 1);
    NAT.setVolume(v); gestInd('vol', v);
  }, { passive: false });
  /* drag on a bar */
  function slTouch(e) {
    var tr = e.target.closest && e.target.closest('.sl-tr'); if (!tr) return;
    e.preventDefault(); e.stopPropagation();
    var r = tr.getBoundingClientRect(), y = e.touches[0].clientY;
    slSet(tr.parentNode.getAttribute('data-sl'), 1 - (y - r.top) / (r.height || 1));
  }
  c.addEventListener('touchstart', slTouch, { passive: false });
  c.addEventListener('touchmove', slTouch, { passive: false });
  var tapT = 0, lastTap = 0;
  tl.addEventListener('click', function (e) {
    if (!Pui.active) return;
    var now = Date.now(), x = e.clientX / (window.innerWidth || 1);
    if (Pui.kind === 'vod' && now - lastTap < 320 && (x < 0.4 || x > 0.6)) {
      clearTimeout(tapT); lastTap = now; ctlAction(x < 0.5 ? 'rw' : 'ff', true); return;
    }
    lastTap = now; clearTimeout(tapT);
    tapT = setTimeout(function () {
      var vis = $('pCtl').classList.contains('show');
      if (vis) hideUi(); else if (Pui.kind === 'live') showInfo(); else showBar();
    }, Pui.kind === 'vod' ? 260 : 0);
  });
  /* seek by tapping / dragging on the progress bar */
  function seekAt(clientX) {
    var tr = $('pVod').querySelector('.pv-track'); if (!tr) return;
    var r = tr.getBoundingClientRect(), f = O.clamp((clientX - r.left) / (r.width || 1), 0, 1), Pl = O.player;
    if (Pl.dur > 0) { Pui.updTime(Pl.seekTo(f * Pl.dur)); showBar(); }
  }
  $('pVod').addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.pv-hit')) seekAt(e.clientX); });
  $('pVod').addEventListener('touchmove', function (e) {
    if (e.target.closest && e.target.closest('.pv-hit')) { e.preventDefault(); seekAt(e.touches[0].clientX); }
  }, { passive: false });
}
function flash(txt) {
  var f = $('pcFlash'); if (!f) return;
  f.textContent = txt; f.className = 'pc-flash on' + (txt.charAt(0) === '-' ? ' l' : ' r');
  clearTimeout(f._t); f._t = setTimeout(function () { f.className = 'pc-flash'; }, 550);
}
function ctlAction(a, fromTap) {
  var Pl = O.player, h = Pui.h || {};
  if (a === 'back') { if (h.back) h.back(); return; }
  if (a === 'pp') { if (Pl.st === 'error') Pl.retry(); else Pl.toggle(); Pui.updTime(Pl.time); showBar(); return; }
  if (a === 'rw' || a === 'ff') { Pui.updTime(Pl.seekBy(a === 'rw' ? -10000 : 10000)); flash(a === 'rw' ? '-10' : '+10'); if (!fromTap) showBar(); return; }
  if (a === 'audio' || a === 'subs') { Pui.tracks(a === 'audio' ? 'audio' : 'text'); return; }
  if (a === 'list') { hideUi(); if (h.ok) h.ok(); return; }
  if (a === 'aspect') { cycleAspect(); return; }
  if (a === 'pip') { hideUi(); if (NAT) NAT.enterPip(); return; }
  if (a === 'sleep') { O.sleep.menu(); return; }
  if (a === 'chup' || a === 'chdn') { if (h.zap) h.zap(a === 'chup' ? 1 : -1); return; }
}
function setAspect(m) {
  O.player.setAspectMode(m);
  var l = $('pcAsp'); if (l) l.textContent = aspLabel();
  O.toast(O.t('aspect') + ': ' + aspLabel());
}
function dimLabel() { var n = O.cfg.get('dim', 0); return n ? O.t('dimLvl') + ' ' + n : O.t('off'); }
/* a black layer over the video: level 1..5 = 10, 30, 50, 70, 90 % darker */
function applyDim() {
  var el = $('pDim');
  if (!el) { el = document.createElement('div'); el.id = 'pDim'; var pl = $('player'); if (!pl) return; pl.insertBefore(el, pl.firstChild); }
  var n = O.cfg.get('dim', 0);
  el.style.opacity = n ? [0, .1, .3, .5, .7, .9][n] : 0;
}
O.applyDim = applyDim;
function aspLabel() { return O.t('asp_' + O.player.aspect()); }
function previewAspect(m) {
  O.player.setAspectMode(m);
  var l = $('pcAsp'); if (l) l.textContent = aspLabel();
  M.refresh();                                   /* moves the ✓ */
}
function cycleAspect() {
  O.player.cycleAspect();
  var l = $('pcAsp'); if (l) l.textContent = aspLabel();
  O.toast(O.t('aspect') + ': ' + aspLabel());
  if (Pui.kind === 'live') showInfo(); else showBar();
}
Pui.touch = function (on) { var tl = $('pTouch'), c = $('pCtl'); if (tl) tl.style.display = on ? '' : 'none'; if (c) c.style.display = on ? '' : 'none'; };
function trackName(x, i) {
  var n = x.name || x.label || (x.lang && x.lang !== 'und' ? x.lang.toUpperCase() : '') || (O.t('track') + ' ' + (i + 1));
  if (x.label && x.name && x.label.toLowerCase() !== x.name.toLowerCase()) n += ' – ' + x.label;
  if (x.ch) n += x.ch >= 6 ? ' • 5.1' : (x.ch === 2 ? ' • Stereo' : (x.ch === 1 ? ' • Mono' : ''));
  return n;
}
/* ☰ in the player: one menu for everything that has no button on simple remotes */
Pui.menu = function () {
  var h = Pui.h || {}, rows = [], Pl = O.player;
  if (Pui.kind === 'live') {
    if (h.archive && (!h.hasArchive || h.hasArchive())) rows.push({ label: O.t('archive'), onOk: function () { M.close(); h.archive(); } });
  } else {
    rows.push({ label: O.t('audioTrack'), onOk: function () { M.close(); Pui.tracks('audio'); } });
    rows.push({ label: O.t('subsTrack'), onOk: function () { M.close(); Pui.tracks('text'); } });
  }
  if (h.fav) rows.push({ label: O.t(h.isFav && h.isFav() ? 'mFavDel' : 'mFavAdd'), onOk: function () { M.close(); h.fav(); } });
  rows.push({ label: O.t('aspect'), value: aspLabel(), onOk: function () {
    /* moving the focus shows the size at once; OK or BACK keeps it */
    M.list(O.t('aspect'), function () {
      return Pl.ASPECTS.map(function (m) {
        return { label: O.t('asp_' + m), value: Pl.aspect() === m ? '✓' : '',
          onFocus: function () { previewAspect(m); },
          onOk: function () { M.closeAll(); setAspect(m); } };
      });
    }, { idx: Math.max(0, Pl.ASPECTS.indexOf(Pl.aspect())), light: true, onBack: function () { M.closeAll(); setAspect(Pl.aspect()); } });
  } });
  /* picture dimming: off + 5 levels (10 % ... 90 % darker); focus previews, OK / BACK keeps it */
  rows.push({ label: O.t('dimOpt'), value: dimLabel(), onOk: function () {
    var keep = O.cfg.get('dim', 0);
    M.list(O.t('dimOpt'), function () {
      return [0, 1, 2, 3, 4, 5].map(function (n) {
        return { label: n ? O.t('dimLvl') + ' ' + n : O.t('off'), value: O.cfg.get('dim', 0) === n ? '✓' : '',
          onFocus: function () { O.cfg.set('dim', n); applyDim(); M.refresh(); },
          onOk: function () { O.cfg.set('dim', n); applyDim(); M.closeAll(); } };
      });
    }, { idx: keep, light: true, onBack: function () { M.closeAll(); } });
  } });
  rows.push({ label: O.t('clockOpt'), value: O.t(O.clock.on() ? 'on' : 'off'), onOk: function (row) { O.clock.toggle(); row.value = O.t(O.clock.on() ? 'on' : 'off'); M.refresh(); } });
  rows.push({ label: O.t('tSleep'), value: O.sleep && O.sleep.end ? Math.ceil(O.sleep.left() / 60000) + ' ' + O.t('minutes') : '', onOk: function () { O.sleep.menu(); } });
  M.list(O.t('options'), function () { return rows; }, { light: true });
};
/* kind: 'audio' | 'text' */
Pui.tracks = function (kind) {
  var Pl = O.player;
  if (!Pl.canTracks()) { O.toast(O.t('tracksNA')); return; }
  Pl.getTracks(function (r) {
    if (!r) { O.toast(O.t('tracksNA')); return; }
    var list = kind === 'audio' ? r.audio : r.text;
    if (!list.length) { O.toast(O.t(kind === 'audio' ? 'noAudio' : 'noSubs')); return; }
    M.list(O.t(kind === 'audio' ? 'audioTrack' : 'subsTrack'), function () {
      var rows = [];
      if (kind === 'text') rows.push({ label: O.t('subsOff'), value: r.textOn ? '' : '✓', onOk: function () { Pl.selectTrack('text', -1, -1); M.close(); O.toast(O.t('subsOff')); } });
      list.forEach(function (x, i) {
        rows.push({ label: trackName(x, i), value: x.sel ? '✓' : '', onOk: function () { Pl.selectTrack(kind, x.g, x.t); M.close(); O.toast(trackName(x, i)); } });
      });
      return rows;
    }, { idx: 0 });
  });
};
Pui.enter = function (kind, handlers) {
  setTimeout(applyDim, 0); setTimeout(function () { if (O.clock) O.clock.tick(); }, 0);
  Pui.active = true; Pui.kind = kind; Pui.h = handlers || {};
  buildCtl(); Pui.touch(true);
  if (NAT && NAT.setPip) NAT.setPip(true);
  if ($('pcAsp')) $('pcAsp').textContent = aspLabel();
  $('player').classList.remove('hidden');
  $('player').classList.toggle('k-live', kind === 'live'); $('player').classList.toggle('k-vod', kind === 'vod');
  $('pInfo').classList.toggle('hidden', kind !== 'live');
  $('pVod').classList.toggle('hidden', kind !== 'vod');
  $('pErr').classList.add('hidden'); $('pSpin').classList.add('hidden');
  Pui.refresh();
};
Pui.exit = function () {
  setTimeout(function () { if (O.clock) O.clock.tick(); }, 0);
  Pui.cancelNext();
  if (NAT && NAT.setPip) NAT.setPip(false);
  if (NAT && briSet) { NAT.setBrightness(-1); briSet = false; }
  Pui.active = false; clearTimeout(infoT); clearTimeout(barT);
  $('player').classList.add('hidden'); $('pInfo').classList.remove('show'); $('pVod').classList.remove('show'); ctl(false);
  $('pErr').classList.add('hidden'); $('pSpin').classList.add('hidden');
};
Pui.setLive = function (ch, num, catName) {
  $('pInfo').innerHTML = '<div class="pn1"><span class="big">' + num + '</span><h2 dir="auto">' + esc(ch.name) + '</h2></div>' +
    '<div class="sub"><span class="live-pill">● LIVE</span><span class="res" id="pRes"></span><span dir="auto">' + esc(catName || '') + '</span></div>' +
    '<div class="pepg" id="pEpg" data-id="' + esc(ch.id) + '"></div>' +
    '<div class="rt1">' + O.fmtClock(new Date()) + '</div>';
  updRes(); showInfo();
  var cid = String(ch.id);
  O.data.epg(ch.id, function (n) { var el = $('pEpg'); if (el && el.getAttribute('data-id') === cid) el.innerHTML = O.epgHtml(n); });
};
O.epgHtml = function (n, full) {
  if (!n || (!n.cur && !n.nxt)) return '';
  var h = '', c = n.cur, x = n.nxt;
  if (c) h += '<div class="e-now"><span class="e-t">' + O.fmtHM(c.s) + ' – ' + O.fmtHM(c.e) + '</span><span class="e-n" dir="auto">' + esc(c.title) + '</span></div>' +
    '<div class="e-bar"><i style="width:' + O.epgPct(c).toFixed(1) + '%"></i></div>' + (full && c.desc ? '<div class="e-d" dir="auto">' + esc(c.desc) + '</div>' : '');
  if (x) h += '<div class="e-next"><span class="e-t">' + O.fmtHM(x.s) + '</span><span dir="auto">' + esc(O.t('nextProg')) + ': ' + esc(x.title) + '</span></div>';
  return h;
};
function updRes() {
  var el = $('pRes'); if (!el) return;
  var r = O.resLabel(O.player.res()); el.textContent = r; el.style.display = r ? '' : 'none';
}
Pui.setVod = function (title, sub) {
  vodTitle = title; vodSub = sub || '';
  $('pVod').innerHTML = '<h2 dir="auto">' + esc(title) + '</h2><div class="sub" dir="auto">' + esc(vodSub) + '</div><div class="ico" id="pvIco">▶</div>' +
    '<div class="pv-track"><div class="pv-fill" id="pvFill"></div><div class="pv-knob" id="pvKnob"></div></div><div class="pv-hit"></div>' +
    '<div class="pv-keys"><span><i class="kd g"></i>' + esc(O.t('audioTrack')) + '</span><span><i class="kd y"></i>' + esc(O.t('subsTrack')) + '</span><span><i class="kd b"></i>' + esc(O.t('aspect')) + '</span><span>◀ ▶ 10s</span></div>' +
    '<div class="pv-t" id="pvL" style="left:90px">0:00</div><div class="pv-t" id="pvR" style="right:90px">0:00</div>';
  Pui.updTime(O.player.time); showBar();
};
Pui.updTime = function (ms) {
  var d = O.player.dur || 0, f = $('pvFill'); if (!f) return;
  var p = d > 0 ? O.clamp(ms / d, 0, 1) * 100 : 0;
  f.style.width = p + '%'; $('pvKnob').style.left = p + '%';
  $('pvL').textContent = O.fmtDur(ms); $('pvR').textContent = O.fmtDur(d);
  var ic = $('pvIco'); if (ic) ic.textContent = O.player.st === 'paused' ? '⏸' : '▶';
  var pp = $('pcPP'); if (pp) pp.innerHTML = O.player.st === 'paused' ? SV.play : SV.pause;
};
Pui.refresh = function () {
  if (!Pui.active) return;
  var Pl = O.player, sp = $('pSpin'), er = $('pErr');
  var loading = Pl.st === 'loading';
  sp.classList.toggle('hidden', !loading);
  if (loading) $('pSpinT').textContent = O.t(Pl.stMsg === 'reconnect' ? 'reconnecting' : 'preparing');
  if (Pl.st === 'error') {
    er.innerHTML = esc(O.t('playFail')) + '<br>' + esc(O.t('retryHint')) + (Pl.errs.length ? '<small>' + esc(Pl.errText()) + '</small>' : '');
    er.classList.remove('hidden'); if (Pui.kind === 'live') showInfo(true); else showBar(true);
  } else er.classList.add('hidden');
  if (Pl.st === 'playing' && Pui.kind === 'live') showInfo();
  if (Pui.kind === 'vod') { Pui.updTime(Pl.time); if (Pl.st === 'paused') showBar(true); }
};
O.player.on(function (ev, a) {
  if (ev === 'state' || ev === 'started') Pui.refresh();
  else if (ev === 'progress' && Pui.active) $('pSpinT').textContent = O.t('preparing') + ' ' + a + '%';
  else if (ev === 'time' && Pui.active && Pui.kind === 'vod' && $('pVod').classList.contains('show')) Pui.updTime(a);
  else if (ev === 'vsize' && Pui.active && Pui.kind === 'live') updRes();
});
Pui.onKey = function (e, k) {
  var Pl = O.player, h = Pui.h, used = true;
  if (NU) {
    if (k === K.ENTER) nuAct('go'); else if (k === K.BACK || k === K.ESC || k === K.STOP) nuAct('x');
    e.preventDefault(); return true;
  }
  if (k === K.MENU) { Pui.menu(); e.preventDefault(); return true; }
  if (Pui.kind === 'live') {
    if (k === K.BACK || k === K.ESC || k === K.STOP || k === K.EXIT) h.back();
    else if (k === K.UP || k === K.CHUP) h.zap(1);
    else if (k === K.DOWN || k === K.CHDN) h.zap(-1);
    else if (k === K.ENTER) { if (Pl.st === 'error') Pl.retry(); else h.ok(); }
    else if (k === K.INFO || k === K.LEFT || k === K.RIGHT) showInfo();
    else if (k === K.BLUE) cycleAspect();
    else used = false;
  } else {
    if (k === K.BACK || k === K.ESC || k === K.STOP || k === K.EXIT) h.back();
    else if (k === K.ENTER || k === K.PLAY || k === K.PAUSE || k === K.PLAYPAUSE) {
      if (Pl.st === 'error') Pl.retry(); else { Pl.toggle(); Pui.updTime(Pl.time); showBar(); }
    }
    else if (k === K.LEFT || k === K.RW) { Pui.updTime(Pl.seekBy(k === K.RW ? -30000 : -10000)); showBar(); }
    else if (k === K.RIGHT || k === K.FF) { Pui.updTime(Pl.seekBy(k === K.FF ? 30000 : 10000)); showBar(); }
    else if (k === K.GREEN) Pui.tracks('audio');
    else if (k === K.YELLOW) Pui.tracks('text');
    else if (k === K.BLUE) cycleAspect();
    else if (k === K.UP || k === K.DOWN || k === K.INFO) showBar();
    else used = false;
  }
  if (used) e.preventDefault();
  return used;
};
/* ----- "next episode in 10s" ----- */
Pui.nextUp = function (o) {
  Pui.cancelNext(); hideUi();
  var pl = $('player'), el = $('pNext');
  if (!el) {
    el = document.createElement('div'); el.id = 'pNext'; pl.appendChild(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-nu]'); if (!b || !NU) return;
      e.stopPropagation(); nuAct(b.getAttribute('data-nu'));
    });
  }
  NU = o; NU.sec = o.sec || 10;
  el.innerHTML = '<div class="nu-l">' + esc(O.t('nextEp')) + '</div><div class="nu-t" dir="auto">' + esc(o.title) + '</div><div class="nu-s" dir="auto">' + esc(o.sub || '') + '</div>' +
    '<div class="nu-b"><b class="nu-go on" data-nu="go"><i id="nuC">' + NU.sec + '</i>' + esc(O.t('playNow')) + '</b><b data-nu="x">' + esc(O.t('cancel')) + '</b></div>';
  el.className = 'show';
  NU.tm = setInterval(function () {
    if (!NU) return;
    NU.sec--; var c = $('nuC'); if (c) c.textContent = Math.max(0, NU.sec);
    if (NU.sec <= 0) nuAct('go');
  }, 1000);
};
function nuAct(a) { var o = NU; Pui.cancelNext(); if (!o) return; if (a === 'go') o.go(); else o.cancel(); }
Pui.cancelNext = function () { if (NU) clearInterval(NU.tm); NU = null; var el = $('pNext'); if (el) el.className = ''; };
window.__ossiPip = function (on) {
  document.documentElement.classList.toggle('pip', !!on);
  if (on) hideUi();
};
Pui.showInfo = showInfo;
Pui.spin = function (on) { $('pSpin').classList.toggle('hidden', !on); if (on) $('pSpinT').textContent = O.t('preparing'); };
})();
