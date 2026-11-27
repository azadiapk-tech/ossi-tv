/* Settings (10 tiles) + Multi-screen. */
(function () {
'use strict';
var O = window.O, $ = O.$, esc = O.esc, t = O.t, K = O.K, D = O.data, Pl = O.player, M = O.modal;

function svg(inner) { return '<svg viewBox="0 0 64 64">' + inner + '</svg>'; }
var ICONS = {
  par: svg('<circle cx="17" cy="14" r="7" fill="#ff4b55"/><path d="M8 27h18v22h-5v11h-8V49H8z" fill="#ff4b55"/><circle cx="47" cy="14" r="7" fill="#ff4b55"/><path d="M38 27h18v22h-5v11h-8V49h-5z" fill="#ff4b55"/><circle cx="32" cy="32" r="5.5" fill="#ff4b55"/><path d="M25 41h14v14h-4v6h-6v-6h-4z" fill="#ff4b55"/>'),
  pls: svg('<circle cx="32" cy="32" r="27" fill="#3b82f6"/><path d="M19 33l9 9 17-19" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  upd: svg('<path d="M10 26v28h44V26" stroke="#5ef0a8" stroke-width="5" fill="none" stroke-linejoin="round"/><path d="M32 8v32M21 29l11 11 11-11" stroke="#5ef0a8" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  time: svg('<circle cx="32" cy="32" r="28" fill="#ffa63d"/><path d="M32 16v17l11 8" stroke="#1d1d2b" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  lang: svg('<circle cx="32" cy="32" r="26" fill="none" stroke="#d63cf0" stroke-width="5"/><ellipse cx="32" cy="32" rx="11" ry="26" fill="none" stroke="#d63cf0" stroke-width="4"/><path d="M6 32h52M10 18h44M10 46h44" stroke="#d63cf0" stroke-width="4" fill="none"/>'),
  cache: svg('<path d="M26 6h12v22H26z" fill="#5ef0d0"/><path d="M14 30h36l4 26H10z" fill="none" stroke="#5ef0d0" stroke-width="5" stroke-linejoin="round"/><path d="M22 40v10M32 40v10M42 40v10" stroke="#5ef0d0" stroke-width="5" stroke-linecap="round"/>'),
  speed: svg('<path d="M8 46a24 24 0 1148 0" fill="none" stroke="#ffd23f" stroke-width="6" stroke-linecap="round"/><path d="M32 44l12-16" stroke="#ffd23f" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="44" r="4" fill="#ffd23f"/>'),
  multi: svg('<rect x="6" y="6" width="23" height="23" rx="5" fill="#18e6ff"/><rect x="35" y="6" width="23" height="23" rx="5" fill="#18e6ff"/><rect x="6" y="35" width="23" height="23" rx="5" fill="#18e6ff"/><rect x="35" y="35" width="23" height="23" rx="5" fill="#18e6ff"/>'),
  prev: svg('<rect x="6" y="10" width="52" height="38" rx="6" fill="none" stroke="#9f8cff" stroke-width="5"/><path d="M27 20v18l15-9z" fill="#9f8cff"/><path d="M20 56h24" stroke="#9f8cff" stroke-width="5" stroke-linecap="round"/>'),
  sleep: svg('<path d="M48 40A22 22 0 0 1 22 12a22 22 0 1 0 26 28z" fill="#a78bfa"/><path d="M44 10h8l-8 9h8" stroke="#a78bfa" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  appupd: svg('<circle cx="32" cy="32" r="26" fill="none" stroke="#22d3ee" stroke-width="5"/><path d="M32 18v24M22 32l10 10 10-10" stroke="#22d3ee" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'),
  about: svg('<circle cx="32" cy="32" r="27" fill="none" stroke="#8fb2ff" stroke-width="5"/><circle cx="32" cy="19" r="3.5" fill="#8fb2ff"/><path d="M32 29v18" stroke="#8fb2ff" stroke-width="6" stroke-linecap="round"/>')
};
var TILES = [
  ['par', 'tParental'], ['pls', 'tPlaylists'], ['upd', 'tUpdate'], ['time', 'tTime'], ['lang', 'tLang'],
  ['cache', 'tCache'], ['speed', 'tSpeed'], ['prev', 'tPreview'], ['sleep', 'tSleep'], ['appupd', 'tAppUpd'], ['about', 'tAbout']
];
var Set = O.settings = {}, root, built = false, idx = 0;

function build() {
  root = $('settings');
  var h = '<div class="hdr"></div>' + O.brandBack(t('settings')) + '<div class="hbtn" data-go="home" style="left:1790px;margin-left:var(--X,0px)">' + O.ic.home + '</div>' +
    '<div class="st-title" dir="auto">' + esc(t('settings')) + '</div><div class="st-grid">';
  TILES.forEach(function (x, i) {
    h += '<div class="stile" data-i="' + i + '">' + ICONS[x[0]] + '<span dir="auto">' + esc(t(x[1])) + '</span></div>';
  });
  root.innerHTML = h + '</div>';
  root.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-go]');
    if (g) { O.app.go(g.getAttribute('data-go')); return; }
    var c = e.target.closest && e.target.closest('.stile');
    if (c) { idx = parseInt(c.getAttribute('data-i'), 10); paint(); run(TILES[idx][0]); }
  });
  built = true;
}
function paint() {
  var els = root.querySelectorAll('.stile');
  for (var i = 0; i < els.length; i++) els[i].classList.toggle('focus', i === idx);
  var pv = null; TILES.forEach(function (x, i) { if (x[0] === 'prev') pv = els[i]; });
  if (pv) pv.querySelector('span').textContent = t('tPreview') + ': ' + (O.cfg.get('preview', true) ? t('on') : t('off'));
}
Set.show = function () { if (!built) build(); root.classList.remove('hidden'); paint(); };
Set.hide = function () { if (root) root.classList.add('hidden'); };
Set.relang = function () { built = false; };
Set.onKey = function (e, k) {
  var used = true, n = TILES.length, cols = 5;
  if (k === K.BACK || k === K.ESC) O.app.back();
  else if (k === K.LEFT) { if (idx % cols) idx--; paint(); }
  else if (k === K.RIGHT) { if (idx % cols < cols - 1 && idx < n - 1) idx++; paint(); }
  else if (k === K.UP) { if (idx >= cols) idx -= cols; paint(); }
  else if (k === K.DOWN) { if (idx + cols < n) idx += cols; paint(); }
  else if (k === K.ENTER) run(TILES[idx][0]);
  else used = false;
  if (used) e.preventDefault();
  return used;
};
function run(k) {
  ({ par: parental, pls: playlists, upd: update, time: timeFmt, lang: language, cache: clearCache,
     speed: speedTest, multi: function () { O.app.go('multi'); }, prev: togglePreview, about: about,
     sleep: function () { O.sleep.menu(); }, appupd: function () { O.upd.check(true); } })[k]();
}

/* ---------- parental control ---------- */
function askPin(title, ok) {
  M.pin(title, function (pin) { if (O.par.check(pin)) ok(); else O.toast(t('wrongPin')); });
}
function parental() {
  if (O.par.get().pin) askPin(t('enterPin'), parMenu); else parMenu();
}
function setPin(after) {
  M.pin(t('newPin'), function (a) {
    M.pin(t('repeatPin'), function (b) {
      if (a !== b) { O.toast(t('pinMismatch')); return; }
      var p = O.par.get(); p.pin = a; p.on = true; O.par.save(p); O.toast(t('pinSaved'));
      if (M.isOpen()) M.refresh();
      if (after) after();
    });
  });
}
function parMenu() {
  M.list(t('tParental'), function () {
    var p = O.par.get();
    return [
      { label: t('parOn'), value: p.on && p.pin ? t('on') : t('off'), onOk: function () {
        var q = O.par.get();
        if (!q.pin) { setPin(); return; }
        q.on = !q.on; O.par.save(q); M.refresh();
      } },
      { label: p.pin ? t('changePin') : t('setPin'), onOk: function () { setPin(); } },
      { label: t('lockedCats'), onOk: lockMenu },
      { label: t('autoLock'), value: p.auto ? t('on') : t('off'), onOk: function () { var q = O.par.get(); q.auto = !q.auto; O.par.save(q); M.refresh(); } },
      { label: t('close'), onOk: M.close }
    ];
  });
}
function lockMenu() {
  M.list(t('lockedCats'), function () {
    return [
      { label: t('live'), onOk: function () { lockType('live'); } },
      { label: t('movies'), onOk: function () { lockType('movie'); } },
      { label: t('series'), onOk: function () { lockType('series'); } },
      { label: t('close'), onOk: M.close }
    ];
  });
}
function lockType(type) {
  D.getCats(type, function (cats) {
    M.list(t({ live: 'live', movie: 'movies', series: 'series' }[type]), function () {
      var p = O.par.get(); p.locks = p.locks || {}; var L = p.locks[type] || [];
      var rows = cats.map(function (c) {
        var on = L.indexOf(c.id) > -1;
        return { label: c.name, value: on ? '🔒' : '', onOk: function () {
          var q = O.par.get(); q.locks = q.locks || {}; var l = q.locks[type] || [], i = l.indexOf(c.id);
          if (i > -1) l.splice(i, 1); else l.push(c.id);
          q.locks[type] = l; O.par.save(q); M.refresh();
        } };
      });
      rows.push({ label: t('close'), onOk: M.close });
      return rows;
    });
  }, function () { O.toast(t('loadFail')); });
}

/* ---------- playlists ---------- */
function playlists() {
  M.list(t('tPlaylists'), function () {
    var rows = O.plList().map(function (p) {
      return { label: (p.id === O.pl.id ? '✓ ' : '') + p.name, value: O.fixedHost() ? p.user : p.host.replace(/^https?:\/\//, ''), onOk: function () { plMenu(p); } };
    });
    rows.push({ label: '＋ ' + t('addPl'), onOk: function () { plForm(null); } });
    rows.push({ label: t('logout'), onOk: function () { M.confirm(t('logout'), t('logoutMsg'), function () { M.closeAll(); O.logout(); }, null, true); } });
    rows.push({ label: t('close'), onOk: M.close });
    return rows;
  });
}
function plMenu(p) {
  M.list(p.name, function () {
    var rows = [
      { label: t('activate'), onOk: function () { M.closeAll(); O.app.switchPlaylist(p.id); } },
      { label: t('edit'), onOk: function () { plForm(p); } }
    ];
    if (O.plList().length > 1) rows.push({ label: t('delete'), onOk: function () {
      M.confirm(t('delete'), p.name + ' ?', function () {
        var l = O.plList().filter(function (x) { return x.id !== p.id; });
        O.plSave(l); O.store.pdAll(p.id);
        M.close();
        if (p.id === O.pl.id) { M.closeAll(); O.app.switchPlaylist(l[0].id); } else M.refresh();
      }, null, true);
    } });
    rows.push({ label: t('close'), onOk: M.close });
    return rows;
  });
}
function plForm(p) {
  var fh = O.fixedHost(), fields = [{ key: 'name', label: t('plName'), value: p ? p.name : '' }];
  if (!fh) fields.push({ key: 'host', label: t('plHost'), value: p ? p.host : 'http://' });
  fields.push({ key: 'user', label: t('plUser'), value: p ? p.user : '' }, { key: 'pass', label: t('plPass'), value: p ? p.pass : '' });
  M.form(p ? t('edit') : t('addPl'), fields, function (v) {
    var name = v.name.replace(/^\s+|\s+$/g, '') || v.user, host = fh || v.host.replace(/^\s+|\s+$/g, '');
    if (!name || !host || host === 'http://' || !v.user || !v.pass) { O.toast(t('fillAll')); return; }
    var l = O.plList();
    if (p) {
      l.forEach(function (x) { if (x.id === p.id) { x.name = name; x.host = O.normHost(host); x.user = v.user.replace(/\s+/g, ''); x.pass = v.pass.replace(/\s+/g, ''); } });
      O.plSave(l); M.close(); M.close();
      if (p.id === O.pl.id) O.app.switchPlaylist(p.id); else M.refresh();
    } else {
      l.push({ id: 'p' + Date.now(), name: name, host: O.normHost(host), user: v.user.replace(/\s+/g, ''), pass: v.pass.replace(/\s+/g, '') });
      O.plSave(l); M.close(); M.refresh(); O.toast(t('saved'));
    }
  });
}

/* ---------- update / time / language / cache ---------- */
function update() {
  M.confirm(t('tUpdate'), t('updateMsg'), function () { O.app.reload(); O.toast(t('updated')); });
}
function timeFmt() {
  M.list(t('tTime'), function () {
    var cur = O.cfg.get('time', '24');
    return [
      { label: '24 ' + t('hours') + '   (' + O.fmtClock24(new Date()) + ')', value: cur === '24' ? '✓' : '', onOk: function () { O.cfg.set('time', '24'); M.refresh(); } },
      { label: '12 ' + t('hours') + '   (' + O.fmtClock12(new Date()) + ')', value: cur === '12' ? '✓' : '', onOk: function () { O.cfg.set('time', '12'); M.refresh(); } },
      { label: t('close'), onOk: M.close }
    ];
  });
}
O.fmtClock24 = function (d) { var h = d.getHours(), m = d.getMinutes(); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
O.fmtClock12 = function (d) { var h = d.getHours(), m = d.getMinutes(); return (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h >= 12 ? 'PM' : 'AM'); };
function language() {
  M.list(t('tLang'), function () {
    var cur = O.lang();
    var rows = O.langs.map(function (l) { return { label: l.name, value: cur === l.id ? '✓' : '', onOk: function () { O.cfg.set('lang', l.id); M.closeAll(); O.app.relang(); } }; });
    rows.push({ label: t('close'), onOk: M.close });
    return rows;
  });
}
function clearCache() {
  M.confirm(t('tCache'), t('cacheMsg'), function () {
    O.store.pdPrefix('recent.'); O.store.pdPrefix('pos.'); O.store.pdPrefix('lastEp.'); O.store.pdPrefix('last.');
    O.app.reload(); O.toast(t('cacheDone'));
  });
}
function togglePreview() {
  O.cfg.set('preview', !O.cfg.get('preview', true)); paint();
  O.toast(t('tPreview') + ': ' + (O.cfg.get('preview', true) ? t('on') : t('off')));
}
function about() {
  var ui = D.info || {}, pl = O.pl, lines = [];
  var NAT = window.OssiNative, DESK = window.OssiDesk;
  lines.push('Ossi TV  ' + (NAT && NAT.version ? 'v' + NAT.version() : DESK && DESK.version ? 'v' + DESK.version + ' (Windows)' : 'v' + O.VERSION));
  lines.push(t('playlist') + ': ' + pl.name + '  (' + pl.host.replace(/^https?:\/\//, '') + ')');
  if (ui.status) lines.push(t('status') + ': ' + ui.status);
  var exp = parseInt(ui.exp_date, 10);
  lines.push(t('expires') + ': ' + (exp > 0 ? new Date(exp * 1000).toISOString().slice(0, 10) : '∞'));
  if (ui.max_connections) lines.push(t('connections') + ': ' + (ui.active_cons || 0) + ' / ' + ui.max_connections);
  M.message(t('tAbout'), lines.join('\n'));
}

/* ---------- speed test ----------
   Measures the internet line: 4 parallel downloads from Cloudflare's speed test server for 10 s
   (natively on Android / Fire TV, with fetch streams on Windows) + the latency to the IPTV server.
   The old test downloaded a TV channel, which only arrives at the channel's own bit rate (~10-25 Mbit/s). */
function speedTest() {
  var NAT = window.OssiNative, done = false, ping = null, tmr = 0, ctrls = [];
  var cfg = M.open({ title: t('tSpeed'), msg: t('testing'), rows: [{ label: t('close'), onOk: function () { stop(); M.close(); } }] });
  function stop() {
    done = true; clearInterval(tmr); window.__ossiSpeed = null;
    if (NAT && NAT.speedStop) { try { NAT.speedStop(); } catch (e) {} }
    ctrls.forEach(function (c) { try { c.abort(); } catch (e) {} });
  }
  cfg.onBack = function () { stop(); M.close(); };
  function verdict(m) { return m >= 25 ? t('spd4k') : m >= 8 ? t('spdHd') : m >= 3 ? t('spdSd') : t('spdLow'); }
  function show(mbps, fin) {
    var txt = t('netSpeed') + ': ' + mbps.toFixed(1) + ' Mbit/s' + (fin ? '' : ' …');
    if (ping != null) txt += '\n' + t('srvPing') + ': ' + ping + ' ms';
    if (fin) txt += '\n' + verdict(mbps);
    M.setMsg(txt);
  }
  var t0 = Date.now();
  O.getJSON(O.api.url('', ''), function () { ping = Date.now() - t0; }, function () {}, 0);
  window.__ossiSpeed = function (mbps, fin, any) {
    if (done) return;
    if (fin) { if (!any) { stop(); M.setMsg(t('testFail')); return; } stop(); show(+mbps || 0, true); }
    else if (mbps > 0) show(+mbps, false);
  };
  if (NAT && NAT.speedTest) { NAT.speedTest(10); return; }
  if (!window.fetch || !window.ReadableStream || !window.AbortController) { stop(); M.setMsg(t('testFail')); return; }
  var total = 0, startAt = 0, startBytes = 0, end = Date.now() + 10000;
  function worker() {
    if (done || Date.now() >= end) return;
    var ac = new AbortController(); ctrls.push(ac);
    fetch('https://speed.cloudflare.com/__down?bytes=100000000', { signal: ac.signal, cache: 'no-store' }).then(function (r) {
      var rd = r.body.getReader();
      function pump() {
        return rd.read().then(function (x) {
          if (x.done || done || Date.now() >= end) { try { ac.abort(); } catch (e) {} worker(); return; }
          total += x.value.length; return pump();
        });
      }
      return pump();
    }).catch(function () { if (!done && Date.now() < end) setTimeout(worker, 300); });
  }
  for (var k = 0; k < 4; k++) worker();
  tmr = setInterval(function () {
    var now = Date.now(), fin = now >= end;
    if (!startAt) { if (total > 0) { startAt = now; startBytes = total; } else if (fin) window.__ossiSpeed(0, 1, 0); return; }
    var mbps = (total - startBytes) * 8 / ((now - startAt) / 1000) / 1e6;
    if (window.__ossiSpeed) window.__ossiSpeed(mbps, fin ? 1 : 0, 1);
  }, 500);
}

/* ================= multi-screen ================= */
var Mu = O.multi = {};
var mu = { root: null, n: 4, slots: [null, null, null, null], pl: [], focus: 0, built: false, errs: [] };
function rects() {
  if (mu.n === 2) return [{ x: 50, y: 270, w: 880, h: 495 }, { x: 990, y: 270, w: 880, h: 495 }];
  var dx = Math.round((O.stageX || 0) / 2);
  return [{ x: 220 + dx, y: 130, w: 720, h: 405 }, { x: 980 + dx, y: 130, w: 720, h: 405 }, { x: 220 + dx, y: 590, w: 720, h: 405 }, { x: 980 + dx, y: 590, w: 720, h: 405 }];
}
function muDraw() {
  var r = rects(), h = '<div class="st-title" style="top:30px;left:56px;font-size:34px" dir="auto">' + esc(t('tMulti')) + '</div>';
  for (var i = 0; i < mu.n; i++) {
    var ch = mu.slots[i], c = r[i], bad = mu.errs[i];
    h += '<div class="mu-cell' + (i === mu.focus ? ' focus' : '') + '" style="left:' + c.x + 'px;top:' + c.y + 'px;width:' + c.w + 'px;height:' + c.h + 'px;' + (ch && !bad ? 'background:transparent;color:transparent' : '') + '">' +
      (ch ? (bad ? esc(t('slotFail')) : '') : '＋ ' + esc(t('pickCh'))) + '</div>' +
      '<div style="position:absolute;left:' + c.x + 'px;top:' + (c.y + c.h + 6) + 'px;width:' + c.w + 'px;font-size:23px;color:#c3d1ee;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" dir="auto">' + (ch ? esc(ch.name) : '') + '</div>';
  }
  h += '<div class="hints"><span><i class="kd w"></i>OK</span><span><i class="kd y"></i>' + esc(t('mLayout')) + '</span><span><i class="kd g"></i>' + esc(t('mReload')) + '</span></div>';
  mu.root.innerHTML = h;
}
function stopSlots() {
  Pl.stop();
  mu.pl.forEach(function (p) { if (!p) return; try { p.stop(); } catch (e) {} try { p.close(); } catch (e) {} });
}
function startSlots() {
  stopSlots(); mu.errs = [];
  var fmt = O.cfg.get('fmt', 'ts') || 'ts', r = rects();
  for (var i = 0; i < mu.n; i++) (function (i) {
    var ch = mu.slots[i]; if (!ch) return;
    if (i === 0) { Pl.playLive(ch, r[0]); return; }
    try {
      var p = mu.pl[i] || (mu.pl[i] = webapis.avplaystore.getPlayer());
      p.open(O.api.stream('live', ch.id, fmt));
      p.setListener({ onerror: function () { mu.errs[i] = 1; muDraw(); }, onbufferingstart: function () {}, onbufferingprogress: function () {}, onbufferingcomplete: function () {}, oncurrentplaytime: function () {}, onevent: function () {}, onstreamcompleted: function () {} });
      p.setDisplayRect(r[i].x, r[i].y, r[i].w, r[i].h);
      p.prepareAsync(function () { try { p.play(); } catch (e) { mu.errs[i] = 1; muDraw(); } }, function () { mu.errs[i] = 1; muDraw(); });
    } catch (e) { mu.errs[i] = 1; }
  })(i);
  muDraw();
  if (mu.errs.some(Boolean)) O.toast(t('multiUnsupported'));
}
Mu.show = function () {
  mu.root = $('multi'); mu.root.classList.remove('hidden');
  if (!mu.built) {
    mu.root.addEventListener('click', function (e) {
      var c = e.target.closest && e.target.closest('.mu-cell'); if (!c) return;
      mu.focus = Array.prototype.indexOf.call(mu.root.querySelectorAll('.mu-cell'), c); muDraw(); muOk();
    });
    mu.built = true;
  }
  muDraw(); startSlots();
};
Mu.hide = function () { stopSlots(); if (mu.root) mu.root.classList.add('hidden'); };
function muOk() {
  var i = mu.focus;
  if (!mu.slots[i]) { pick(i); return; }
  M.list(mu.slots[i].name, function () {
    return [
      { label: t('changeCh'), onOk: function () { M.close(); pick(i); } },
      { label: t('removeCh'), onOk: function () { mu.slots[i] = null; M.close(); startSlots(); } },
      { label: t('close'), onOk: M.close }
    ];
  });
}
function pick(i) {
  O.app.go('live', { pick: function (ch) { mu.slots[i] = { id: ch.id, name: ch.name }; O.app.go('multi'); } });
}
Mu.onKey = function (e, k) {
  var used = true, cols = 2;
  if (k === K.BACK || k === K.ESC) O.app.go('settings');
  else if (k === K.LEFT) { if (mu.focus % cols) mu.focus--; muDraw(); }
  else if (k === K.RIGHT) { if (mu.focus % cols < cols - 1 && mu.focus < mu.n - 1) mu.focus++; muDraw(); }
  else if (k === K.UP) { if (mu.focus >= cols) mu.focus -= cols; muDraw(); }
  else if (k === K.DOWN) { if (mu.focus + cols < mu.n) mu.focus += cols; muDraw(); }
  else if (k === K.ENTER) muOk();
  else if (k === K.YELLOW) { mu.n = mu.n === 4 ? 2 : 4; mu.focus = 0; startSlots(); }
  else if (k === K.GREEN) startSlots();
  else used = false;
  if (used) e.preventDefault();
  return used;
};
Mu.relang = function () {};
})();
