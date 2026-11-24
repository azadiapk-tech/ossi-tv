/* Live TV: 3 columns (categories | channels | preview), fullscreen player with channel browser overlay,
   favourites, continue-watching and persistent re-ordering (long-press RED). */
(function () {
'use strict';
var O = window.O, $ = O.$, esc = O.esc, t = O.t, K = O.K, D = O.data, Pl = O.player;
function FULLR() { return { x: 0, y: 0, w: O.stageW || 1920, h: 1080 }; }
function PREVR() { var w = 664 + (O.stageXP || 0); return { x: 1228 + (O.stageXC || 0), y: 150, w: w, h: Math.round(w * 9 / 16) }; }
var PSEUDO = 3;
var root, built = false, shown = false, G = {}, zapT = 0, searchT = 0;
var S = {
  cats: [], catView: [], cur: null, all: [], view: [], area: 'channels', qc: '', qh: '',
  playing: null, zapList: [], zapIdx: 0, full: false, overlay: false, edit: null, tok: 0,
  retry: null, pick: null, loading: false
};
var Live = O.live = {};
var ARC = '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" fill="none" stroke="#67e8f9" stroke-width="2" stroke-linecap="round"/><path d="M4 4v4h4" fill="none" stroke="#67e8f9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v4.5l3 2" fill="none" stroke="#67e8f9" stroke-width="2" stroke-linecap="round"/></svg>';
O.onEpg = function (id, n) {
  if (!root) return;
  var els = root.querySelectorAll('[data-epg="' + String(id).replace(/"/g, '') + '"]');
  for (var i = 0; i < els.length; i++) els[i].textContent = n && n.cur ? n.cur.title : '';
  var ch = S.playing || S.view[G.ch ? G.ch.cur : 0];
  if (ch && String(ch.id) === String(id) && shown && !S.full) drawInfo();
};

function initials(name) {
  var n = String(name).replace(/^[^:]*:\s*/, '').replace(/[^\w؀-ۿ]/g, '');
  return (n || 'TV').slice(0, 2).toUpperCase();
}
function logo(c) {
  var ini = esc(initials(c.name));
  return '<span class="lg" data-ini="' + ini + '">' + (c.icon ? '<img src="' + esc(c.icon) + '" decoding="async">' : ini) + '</span>';
}
function key(x) { return String(x.id); }

/* ---------- build ---------- */
function build() {
  root = $('live');
  root.innerHTML =
    '<div class="lv-shadow"></div><div class="hdr"></div>' + O.brandBack(t('live')) +
    '<div class="hbtn" id="lvHome" style="left:1790px;margin-left:var(--X,0px)">' + O.ic.home + '</div>' +
    '<div class="pane lv-cats"></div><div class="pane lv-chs"></div>' +
    '<div class="sbox" id="lvCatS" style="left:20px;top:140px;width:520px">' + O.ic.search + '<input id="lvCatQ" placeholder="' + esc(t('searchCat')) + '"></div>' +
    '<div class="sbox" id="lvChS" style="left:580px;top:140px;width:600px">' + O.ic.search + '<input id="lvChQ" placeholder="' + esc(t('searchCh')) + '"></div>' +
    '<div class="lv-list" id="lvCats"></div><div class="lv-list" id="lvChs"></div>' +
    '<div class="lv-prev msg" id="lvPrev"></div><div class="lv-info" id="lvInfo"></div>' +
    '<div class="hints lv-hint"><span><i class="kd w"></i>OK</span><span><i class="kd y"></i>' + esc(t('hFav')) + '</span><span><i class="kd r"></i>' + esc(t('hSort')) + '</span></div>' +
    '<div class="editbar hidden" id="lvEdit"></div>' +
    '<div class="editbar tbar hidden" id="lvEditT"><span class="et" dir="auto">' + esc(t('eTouch')) + '</span>' +
    '<b class="ebtn" id="lvEdReset">' + esc(t('resetOrder')) + '</b><b class="ebtn on" id="lvEdDone">' + esc(t('eDone')) + '</b></div>';
  G.cats = new O.VGrid($('lvCats'), {
    cols: 1, itemH: 74, gap: 8, render: catRow, count: function () { return S.catView.length; },
    onClick: function (i) { setArea('cats'); onCatOk(); },
    onLong: function (i) { longPress('cats', i); },
    onDragStart: function (i) { return dragStart('cats', i); },
    onDrop: function (slot) { dropAt(slot); }
  });
  G.ch = new O.VGrid($('lvChs'), {
    cols: 1, itemH: 104, gap: 10, render: chRow, count: function () { return S.view.length; },
    onClick: function (i, e) {
      setArea('channels');
      if (e.target.closest && e.target.closest('.hrt')) toggleFav(S.view[i]); else activate(i);
    },
    onLong: function (i) { longPress('channels', i); },
    onDragStart: function (i) { return dragStart('channels', i); },
    onDrop: function (slot) { dropAt(slot); }
  });
  $('lvPrev').onclick = function () { if (S.playing && Pl.st !== 'idle' && !S.edit) enterFull(); };
  $('lvEdDone').onclick = function () { if (S.edit) { if (S.edit.dirty) editSave(); else exitEdit(); } };
  $('lvEdReset').onclick = function () { if (S.edit) editReset(); };
  $('lvInfo').addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#lvArch')) openArchive(S.playing || S.view[G.ch.cur]);
  });
  $('lvHome').onclick = function () { O.app.go('home'); };
  $('lvCatQ').addEventListener('input', function () {
    clearTimeout(searchT); searchT = setTimeout(function () { S.qc = $('lvCatQ').value.toLowerCase().replace(/^\s+|\s+$/g, ''); filterCats(); G.cats.reset(); }, 200);
  });
  $('lvChQ').addEventListener('input', function () {
    clearTimeout(searchT); searchT = setTimeout(function () { S.qh = $('lvChQ').value.toLowerCase().replace(/^\s+|\s+$/g, ''); applyView(); G.ch.reset(); drawCh(); drawInfo(); }, 200);
  });
  built = true;
}

/* ---------- rows ---------- */
function catRow(i) {
  var c = S.catView[i], act = S.cur && S.cur.id === c.id, sel = S.edit && S.edit.sel[key(c)];
  return '<div class="cat' + (c.type !== 'cat' ? ' pseudo' : '') + (act ? ' act' : '') + (sel ? ' sel' : '') + '" data-i="' + i + '">' +
    '<span class="nm" dir="auto">' + esc(c.name) + '</span>' + (O.par.isLocked('live', c) ? O.ic.lock : '') +
    '<b>' + (c.count != null ? c.count : '') + '</b></div>';
}
function chRow(i) {
  var c = S.view[i], fav = O.fav.has('live', c.id), sel = S.edit && S.edit.sel[key(c)];
  var now = S.playing && key(S.playing) === key(c);
  var ep = D.epgNow(c.id), np = ep && ep.cur ? ep.cur.title : '';
  if (!ep) D.epg(c.id);
  return '<div class="ch' + (now ? ' now' : '') + (sel ? ' sel' : '') + '" data-i="' + i + '"><span class="no">' + (i + 1) + '</span>' + logo(c) +
    '<span class="chx"><span class="nm" dir="auto">' + esc(c.name) + '</span><span class="np" dir="auto" data-epg="' + esc(c.id) + '">' + esc(np) + '</span></span>' +
    (c.arch ? '<span class="arc" title="archive">' + ARC + '</span>' : '') +
    (S.edit ? '<span class="ck' + (sel ? ' on' : '') + '"></span>' : '<span class="hrt' + (fav ? ' on' : '') + '">' + O.ic.heart + '</span>') + '</div>';
}

/* ---------- categories ---------- */
function buildCats() {
  var real = O.applyOrder(D.cats.live || [], O.store.p('order.cats.live', []), 'id').map(function (c) { return { id: c.id, name: c.name, type: 'cat' }; });
  S.cats = [
    { id: 'recent', name: t('continue'), type: 'recent' },
    { id: 'fav', name: t('favorites'), type: 'fav' },
    { id: 'all', name: t('allChannels'), type: 'all' }
  ].concat(real);
  refreshCounts(); filterCats();
}
function refreshCounts() {
  S.cats.forEach(function (c) {
    if (c.type === 'recent') c.count = O.recent.list('live').length;
    else if (c.type === 'fav') c.count = O.fav.list('live').length;
    else if (c.type === 'all') c.count = D.liveAll ? D.liveAll.length : null;
    else c.count = D.byCat ? (D.byCat[c.id] || []).length : null;
  });
}
function filterCats() {
  var q = S.qc;
  S.catView = q ? S.cats.filter(function (c) { return c.name.toLowerCase().indexOf(q) > -1; }) : S.cats;
}
function onCatOk() {
  var c = S.catView[G.cats.cur]; if (!c) return;
  if (S.edit) { toggleSel(c); return; }
  openCat(c, true);
}
function openCat(entry, toChannels) {
  O.par.guard('live', entry, function () { loadList(entry, toChannels); });
}
function lockedSet() {
  var set = {};
  (D.cats.live || []).forEach(function (c) { if (O.par.isLocked('live', { id: c.id, name: c.name })) set[c.id] = 1; });
  return set;
}
function loadList(entry, toChannels, keep) {
  S.cur = entry; S.retry = null;
  O.store.ps('last.live', { cat: entry.id });
  S.qh = ''; $('lvChQ').value = '';
  var tk = ++S.tok;
  if (entry.type === 'recent') { setAll(O.recent.list('live'), toChannels, keep); return; }
  if (entry.type === 'fav') { setAll(O.applyOrder(O.fav.list('live'), O.store.p('order.ch.fav', []), 'id'), toChannels, keep); return; }
  S.loading = true; S.all = []; S.view = []; drawCh(); G.cats.draw();
  D.getItems('live', entry.id, function (list) {
    if (tk !== S.tok) return;
    if (entry.type === 'all' && O.par.active()) { var ls = lockedSet(); list = list.filter(function (x) { return !ls[x.cat]; }); }
    setAll(O.applyOrder(list, O.store.p('order.ch.' + entry.id, []), 'id'), toChannels, keep);
  }, function (err) {
    if (tk !== S.tok) return;
    S.loading = false; S.err = err; drawCh();
    S.retry = function () { loadList(entry, toChannels); };
  });
}
function setAll(list, toChannels, keep) {
  S.loading = false; S.err = null; S.all = list; applyView();
  refreshCounts(); G.ch.reset(); if (keep) G.ch.setCur(keep);
  drawCh(); drawInfo(); G.cats.draw();
  if (toChannels && S.view.length) setArea('channels');
}
function applyView() {
  var q = S.qh;
  S.view = q ? S.all.filter(function (c) { return c.name.toLowerCase().indexOf(q) > -1; }) : S.all;
}
function drawCh() {
  var el = $('lvChs');
  if (S.loading) { el.innerHTML = '<div class="loading">' + esc(t('loading')) + '</div>'; return; }
  if (S.err) { el.innerHTML = '<div class="loading">' + esc(t('loadFail')) + '<br>' + esc(t('retryHint')) + '</div>'; return; }
  if (!S.view.length) { el.innerHTML = '<div class="loading">' + esc(t('empty')) + '</div>'; return; }
  G.ch.draw();
}

/* ---------- preview panel ---------- */
function drawPrev() {
  var p = $('lvPrev'), h = '';
  if (S.full || S.pick) { return; }
  var playing = S.playing && Pl.kind === 'live' && Pl.st === 'playing';
  p.className = 'lv-prev' + (playing ? '' : ' msg') + (S.area === 'preview' ? ' focus' : '');
  if (!S.playing || Pl.st === 'idle') h = '<span style="color:#7f93b8">' + esc(t('pickHint')) + '</span>';
  else if (Pl.st === 'loading') h = '<div class="spinner"></div>';
  else if (Pl.st === 'error') h = esc(t('playFail')) + '<br><small style="font-size:18px;color:#8fa0bd">' + esc(t('retryHint')) + '</small>';
  p.innerHTML = h;
}
function drawInfo() {
  var ch = S.playing || S.view[G.ch ? G.ch.cur : 0];
  var rs = S.playing && ch === S.playing && Pl.st === 'playing' ? O.resLabel(Pl.res()) : '';
  $('lvInfo').innerHTML = ch ? '<h2 dir="auto">' + esc(ch.name) + '</h2><hr><p dir="auto">' + esc(S.cur ? S.cur.name : '') + '</p>' +
    (rs ? '<p class="lvres"><span class="res">' + esc(rs) + '</span></p>' : '') +
    '<div class="lvepg">' + O.epgHtml(ch ? D.epgNow(ch.id) : null, true) + '</div>' +
    (ch && ch.arch ? '<b class="lvbtn" id="lvArch">' + ARC + esc(t('archive')) + (isTouch() ? '' : ' <i class="kd b"></i>') + '</b>' : '') +
    '<p class="lvhint">' + esc(t(isTouch() ? 'prevHintT' : 'prevHint')) + '</p>' : '';
  if (ch && !D.epgNow(ch.id)) D.epg(ch.id);
}
Pl.on(function (ev) {
  if (!shown || S.full) return;
  if (ev === 'vsize' || ev === 'started') drawInfo();
  if (ev === 'state' || ev === 'started') drawPrev();
  if (ev === 'started' && Pl.kind === 'live' && S.playing) {
    O.recent.push('live', { id: S.playing.id, name: S.playing.name, icon: S.playing.icon, cat: S.playing.cat });
    refreshCounts(); G.cats.draw();
  }
});
Pl.on(function (ev) {
  if (ev === 'started' && Pl.kind === 'live' && S.full && S.playing) {
    O.recent.push('live', { id: S.playing.id, name: S.playing.name, icon: S.playing.icon, cat: S.playing.cat });
  }
});

/* ---------- focus areas ---------- */
function setArea(a) {
  S.area = a;
  G.cats.setActive(a === 'cats'); G.ch.setActive(a === 'channels');
  $('lvCatS').classList.toggle('focus', a === 'catSearch');
  $('lvChS').classList.toggle('focus', a === 'chSearch');
  if (!S.full) drawPrev();
}

/* ---------- playback ---------- */
function playChannel(c, full) {
  S.playing = c; S.zapList = S.view.indexOf(c) > -1 ? S.view : (S.zapList.indexOf(c) > -1 ? S.zapList : [c]);
  S.zapIdx = S.zapList.indexOf(c);
  Pl.playLive(c, full ? FULLR() : PREVR());
  drawInfo(); if (!S.full) drawPrev(); G.ch.draw();
}
function pushPui() { O.pui.setLive(S.playing, S.zapIdx + 1, S.cur ? S.cur.name : ''); O.pui.refresh(); }
function activate(i) {
  var c = S.view[i]; if (!c) return;
  if (S.edit) { toggleSel(c); return; }
  if (S.pick) { var cb = S.pick; S.pick = null; cb(c); return; }
  if (S.overlay) { playChannel(c, true); closeOverlay(); pushPui(); return; }
  var same = S.playing && key(S.playing) === key(c) && Pl.kind === 'live' && Pl.st !== 'idle' && Pl.st !== 'error';
  if (same) { enterFull(); return; }
  if (!O.cfg.get('preview', true)) { playChannel(c, true); enterFull(); return; }
  playChannel(c, false);
}
function enterFull() {
  S.full = true; root.classList.add('hidden');
  Pl.setRect(FULLR());
  O.pui.enter('live', {
    back: exitFull, zap: zap, ok: openOverlay,
    archive: function () { var ch = S.playing; if (!ch || !ch.arch) { O.toast(t('noArchive')); return; } exitFull(); openArchive(ch); },
    hasArchive: function () { return !!(S.playing && S.playing.arch); },
    fav: function () { if (S.playing) toggleFav(S.playing); },
    isFav: function () { return !!(S.playing && O.fav.has('live', S.playing.id)); }
  });
  pushPui();
}
function exitFull() {
  clearTimeout(zapT);
  O.pui.exit(); S.full = false; root.classList.remove('hidden'); root.classList.remove('overlay'); S.overlay = false;
  if (O.cfg.get('preview', true) && Pl.st !== 'idle') Pl.setRect(PREVR()); else { Pl.stop(); S.playing = null; }
  var i = S.view.indexOf(S.playing);
  setArea('channels'); G.cats.draw(); drawCh(); if (i > -1) G.ch.setCur(i);
  drawPrev(); drawInfo();
}
function zap(dir) {
  var L = S.zapList; if (!L.length) return;
  S.zapIdx = (S.zapIdx + dir + L.length) % L.length;
  S.playing = L[S.zapIdx]; pushPui();
  clearTimeout(zapT); Pl.stop(); O.pui.spin(true);
  var c = S.playing;
  zapT = setTimeout(function () { if (S.playing === c) { Pl.playLive(c, FULLR()); pushPui(); } }, 350);
}
function openOverlay() {
  O.pui.touch(false);
  S.overlay = true; root.classList.add('overlay'); root.classList.remove('hidden');
  setArea('channels'); G.cats.draw(); drawCh();
  var i = S.view.indexOf(S.playing); if (i > -1) G.ch.setCur(i);
}
function closeOverlay() { O.pui.touch(true); S.overlay = false; root.classList.remove('overlay'); root.classList.add('hidden'); }

function toggleFav(c) {
  var keep = G.ch.cur;
  var on = O.fav.toggle('live', { id: c.id, name: c.name, icon: c.icon, cat: c.cat });
  O.toast(on ? t('favAdded') : t('favRemoved'));
  refreshCounts();
  if (S.cur && S.cur.type === 'fav' && !on) loadList(S.cur, false, keep); else { G.ch.draw(); G.cats.draw(); }
}

/* ---------- edit mode (RED long-press) ---------- */
function editArr() {
  return S.edit.area === 'channels' ? S.all : S.cats.slice(PSEUDO);
}
function editGrid() { return S.edit.area === 'channels' ? G.ch : G.cats; }
function isTouch() { return document.documentElement.className.indexOf('touch') > -1; }
/* remote edit bar: select mode -> move mode */
O.editBarHtml = function (mode) {
  function k(cls, txt) { return '<span>' + (cls ? '<i class="kd ' + cls + '"></i>' : '') + esc(txt) + '</span>'; }
  return mode === 'move'
    ? k('', '▲ ▼  ' + t('eMoveUD')) + k('w', t('eOkDrop')) + k('', '↩  ' + t('eBackCancel'))
    : k('w', t('eSel')) + k('', '☰  ' + t('eMenuMove')) + k('', '↩  ' + t('eBackCancel'));
};
function drawEditBar() { if (S.edit) $('lvEdit').innerHTML = O.editBarHtml(S.edit.mode); }
function showEditBar(on) {
  drawEditBar();
  $('lvEdit').classList.toggle('hidden', !on || isTouch()); $('lvEditT').classList.toggle('hidden', !on || !isTouch());
  root.querySelector('.lv-hint').style.display = on ? 'none' : '';
}
function enterEdit() {
  if (S.full || S.overlay || S.edit || S.pick) return;
  var a = S.area;
  if (a !== 'channels' && a !== 'cats') { O.toast(t('editFocus')); return; }
  if (a === 'channels') {
    if (!S.cur || S.cur.type === 'recent') { O.toast(t('editRecent')); return; }
    if (S.qh) { O.toast(t('clearSearch')); return; }
    if (!S.all.length) return;
  } else if (S.qc) { O.toast(t('clearSearch')); return; }
  S.edit = { area: a, sel: {}, dirty: false, orig: null, mode: 'select' };
  S.edit.orig = editArr().slice();
  showEditBar(true); G.ch.draw(); G.cats.draw();
  if (!isTouch()) O.toast(t('editOn'));
}
function toggleSel(c) {
  if (c.type && c.type !== 'cat') { O.toast(t('noMove')); return; }
  var k = key(c); if (S.edit.sel[k]) delete S.edit.sel[k]; else S.edit.sel[k] = 1;
  (S.edit.area === 'channels' ? G.ch : G.cats).draw();
}
function writeBack(arr) {
  if (S.edit.area === 'channels') { S.all = arr; S.view = arr; }
  else { S.cats = S.cats.slice(0, PSEUDO).concat(arr); S.catView = S.cats; }
}
function editDrop() {
  var E = S.edit, grid = editGrid(), arr = editArr(), base = E.area === 'channels' ? 0 : PSEUDO;
  var f = grid.cur - base;
  if (f < 0 || f >= arr.length) { O.toast(t('dropHere')); return; }
  if (!Object.keys(E.sel).length) { O.toast(t('selectFirst')); return; }
  var focus = arr[f];
  if (E.sel[key(focus)]) { O.toast(t('dropOther')); return; }
  var block = [], rest = [], minIdx = 1e9;
  arr.forEach(function (x, i) { if (E.sel[key(x)]) { block.push(x); if (i < minIdx) minIdx = i; } else rest.push(x); });
  var fi = rest.indexOf(focus), pos = minIdx > f ? fi : fi + 1;
  var out = rest.slice(0, pos).concat(block, rest.slice(pos));
  writeBack(out); E.sel = {}; E.dirty = true;
  grid.draw(); grid.setCur(out.indexOf(block[0]) + base);
  O.toast(t('moved'));
}
function exitEdit() { S.edit = null; showEditBar(false); root.classList.remove('moving'); G.ch.draw(); G.cats.draw(); }
/* ----- remote: ☰ lifts the selection, ▲▼ move it, OK drops + saves ----- */
function startMove() {
  var E = S.edit, grid = editGrid(), arr = editArr(), base = E.area === 'channels' ? 0 : PSEUDO;
  if (!Object.keys(E.sel).length) {
    var c = arr[grid.cur - base];
    if (!c) { O.toast(t('noMove')); return; }
    E.sel[key(c)] = 1;
  }
  var block = [], rest = [], pos = -1;
  arr.forEach(function (x) { if (E.sel[key(x)]) { if (pos < 0) pos = rest.length; block.push(x); } else rest.push(x); });
  E.mode = 'move'; E.block = block; E.rest = rest; E.pos = pos;
  root.classList.add('moving');
  applyMove(); drawEditBar();
}
function applyMove() {
  var E = S.edit, grid = editGrid(), base = E.area === 'channels' ? 0 : PSEUDO;
  writeBack(E.rest.slice(0, E.pos).concat(E.block, E.rest.slice(E.pos)));
  grid.draw(); grid.setCur(E.pos + base);
}
function moveBy(d) {
  var E = S.edit, np = O.clamp(E.pos + d, 0, E.rest.length);
  if (np === E.pos) return;
  E.pos = np; E.dirty = true; applyMove();
}
function editSave() {
  var E = S.edit;
  if (E.area === 'channels') O.store.ps('order.ch.' + S.cur.id, S.all.map(function (c) { return c.id; }));
  else O.store.ps('order.cats.live', S.cats.slice(PSEUDO).map(function (c) { return c.id; }));
  exitEdit(); O.toast(t('orderSaved'));
}
function editCancel() {
  var E = S.edit; writeBack(E.orig.slice()); exitEdit();
}
function editReset() {
  O.modal.confirm(t('resetOrder'), t('resetOrderMsg'), function () {
    if (S.edit.area === 'channels') { O.store.pd('order.ch.' + S.cur.id); var c = S.cur; exitEdit(); loadList(c, false); }
    else { O.store.pd('order.cats.live'); exitEdit(); buildCats(); G.cats.reset(); G.cats.draw(); }
    O.toast(t('orderReset'));
  }, null, true);
}
/* ----- touch: long-press selects, long-press on a selection drags it, drop saves ----- */
function longPress(area, i) {
  if (S.edit || S.full || S.pick) return;
  setArea(area);
  (area === 'channels' ? G.ch : G.cats).cur = i;
  enterEdit();
  if (!S.edit) return;
  var c = area === 'channels' ? S.view[i] : S.catView[i];
  if (c && (!c.type || c.type === 'cat')) toggleSel(c);
}
function dragStart(area, i) {
  var E = S.edit; if (!E || E.area !== area) return false;
  var c = area === 'channels' ? S.view[i] : S.catView[i];
  if (!c || (c.type && c.type !== 'cat')) return false;
  if (!E.sel[key(c)]) toggleSel(c);
  return Object.keys(E.sel).length > 0;
}
function dropAt(slot) {
  var E = S.edit; if (!E || !Object.keys(E.sel).length) return;
  var arr = editArr(), base = E.area === 'channels' ? 0 : PSEUDO, sl = O.clamp(slot - base, 0, arr.length);
  var block = [], rest = [], before = 0;
  arr.forEach(function (x, i) { if (E.sel[key(x)]) block.push(x); else { rest.push(x); if (i < sl) before++; } });
  var out = rest.slice(0, before).concat(block, rest.slice(before));
  writeBack(out); E.sel = {}; E.dirty = true;
  editSave();
}

/* ----- catch-up (archive) ----- */
function dayKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
function dayLabel(ms) {
  var k = dayKey(ms);
  if (k === dayKey(Date.now())) return t('today');
  if (k === dayKey(Date.now() - 86400000)) return t('yesterday');
  var loc = { ar: 'ar', en: 'en-GB', de: 'de-DE' }[O.lang()] || 'en-GB';
  try { return new Date(ms).toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return new Date(ms).toDateString(); }
}
function openArchive(ch) {
  if (!ch || !ch.arch) { O.toast(t('noArchive')); return; }
  O.toast(t('loading'));
  D.archive(ch.id, function (list) {
    var now = Date.now(), from = now - ch.arch * 86400000 - 3600000;
    var items = list.filter(function (x) { return x.e < now && x.s > from; });
    if (list.some(function (x) { return x.arch; })) items = items.filter(function (x) { return x.arch; });
    if (!items.length) { O.toast(t('noArchive')); return; }
    var days = {}, order = [];
    items.forEach(function (x) { var k = dayKey(x.s); if (!days[k]) { days[k] = []; order.push(k); } days[k].push(x); });
    order.reverse();
    O.modal.list(t('archive') + ' • ' + ch.name, function () {
      return order.map(function (k) {
        var l = days[k];
        return { label: dayLabel(l[0].s), value: String(l.length), onOk: function () { showDay(ch, l.slice().reverse()); } };
      });
    });
  }, function () { O.toast(t('loadFail')); });
}
function showDay(ch, progs) {
  O.modal.list(dayLabel(progs[0].s), function () {
    return progs.map(function (x) {
      return { label: O.fmtHM(x.s) + '   ' + (x.title || '—'), onOk: function () { O.modal.closeAll(); playArchive(ch, x); } };
    });
  });
}
function playArchive(ch, x) {
  var dur = Math.max(1, Math.ceil((x.e - x.s) / 60000));
  var st = x.start;
  if (!st) { var d = new Date(x.s), z = function (n) { return (n < 10 ? '0' : '') + n; }; st = d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }
  var url = O.api.timeshift(ch.id, st, dur);
  if (!url) { O.toast(t('playFail')); return; }
  Pl.stop(); S.playing = null; root.classList.add('hidden');
  O.vodPlay({
    title: x.title || ch.name, sub: ch.name + '  •  ' + dayLabel(x.s) + '  ' + O.fmtHM(x.s) + ' – ' + O.fmtHM(x.e),
    url: url, startMs: 0, posKey: 'arch:' + ch.id + ':' + x.s, item: ch,
    onExit: function () { root.classList.remove('hidden'); setArea('channels'); drawPrev(); drawInfo(); G.ch.draw(); }
  });
}

Live.onRed = function (kind) {
  if (kind === 'long') enterEdit();
  else if (kind === 'save' && S.edit) editSave();
};
Live.editing = function () { return !!S.edit; };
/* long OK in a list = start selecting (same as ☰) */
Live.canLongOk = function () { return !S.edit && !S.full && !S.overlay && !S.pick && (S.area === 'channels' || S.area === 'cats'); };
Live.onLongOk = function () { longPress(S.area, (S.area === 'channels' ? G.ch : G.cats).cur); };

/* ---------- keys ---------- */
function back() {
  if (S.edit) {
    if (S.edit.dirty) O.modal.confirm(t('discardTitle'), t('discardMsg'), editCancel, null, true); else editCancel();
    return;
  }
  if (S.overlay) { closeOverlay(); return; }
  if (S.pick) { S.pick = null; O.app.go('multi'); return; }
  O.app.back();
}
Live.overlayOpen = function () { return S.overlay; };
Live.fullOpen = function () { return S.full; };
Live.onKey = function (e, k) {
  var E = S.edit, used = true, a = S.area;
  if (k === K.BACK || k === K.ESC) { back(); e.preventDefault(); return true; }
  if (E && E.mode === 'move') {
    var vis = editGrid().vis();
    if (k === K.UP) moveBy(-1); else if (k === K.DOWN) moveBy(1);
    else if (k === K.PGUP || k === K.CHDN) moveBy(-vis); else if (k === K.PGDN || k === K.CHUP) moveBy(vis);
    else if (k === K.ENTER || k === K.RED) editSave();
    e.preventDefault(); return true;
  }
  if (k === K.MENU) {
    if (!E) { if (!S.overlay && !S.full) enterEdit(); }
    else startMove();
    e.preventDefault(); return true;
  }
  if (k === K.GREEN) { if (E) editDrop(); e.preventDefault(); return true; }
  if (k === K.YELLOW) {
    if (!E && a === 'channels' && S.view[G.ch.cur]) toggleFav(S.view[G.ch.cur]);
    e.preventDefault(); return true;
  }
  if (k === K.BLUE) { if (E) editReset(); else if (!S.overlay) openArchive(S.playing || S.view[G.ch.cur]); e.preventDefault(); return true; }

  if (a === 'catSearch' || a === 'chSearch') {
    if (k === K.DOWN) setArea(a === 'catSearch' ? 'cats' : 'channels');
    else if (k === K.RIGHT && a === 'catSearch') setArea('chSearch');
    else if (k === K.LEFT && a === 'chSearch') setArea('catSearch');
    else if (k === K.ENTER) $(a === 'catSearch' ? 'lvCatQ' : 'lvChQ').focus();
    else used = false;
  } else if (a === 'cats') {
    if (k === K.UP) { if (!G.cats.move(0, -1) && !E) setArea('catSearch'); }
    else if (k === K.DOWN) G.cats.move(0, 1);
    else if (k === K.RIGHT) { if (E && E.area === 'cats') editDrop(); else if (S.view.length) setArea('channels'); }
    else if (k === K.ENTER) { if (S.retry && !S.cats.length) S.retry(); else onCatOk(); }
    else if (k === K.PGUP || k === K.CHDN) G.cats.page(-1);
    else if (k === K.PGDN || k === K.CHUP) G.cats.page(1);
    else used = false;
  } else if (a === 'channels') {
    if (k === K.UP) { if (!G.ch.move(0, -1) && !E) setArea('chSearch'); }
    else if (k === K.DOWN) G.ch.move(0, 1);
    else if (k === K.LEFT) { if (!E || E.area !== 'channels') setArea('cats'); }
    else if (k === K.RIGHT) {
      if (E && E.area === 'channels') editDrop();
      else if (!S.overlay && !E && !S.pick) setArea('preview');
    }
    else if (k === K.ENTER) { if (S.retry && !S.view.length) S.retry(); else activate(G.ch.cur); }
    else if (k === K.PGUP || k === K.CHDN) G.ch.page(-1);
    else if (k === K.PGDN || k === K.CHUP) G.ch.page(1);
    else used = false;
    if (used && (k === K.UP || k === K.DOWN)) drawInfo();
  } else if (a === 'preview') {
    if (k === K.LEFT) setArea('channels');
    else if (k === K.ENTER) { if (S.playing && Pl.st !== 'idle') enterFull(); }
    else used = false;
  }
  if (used) e.preventDefault();
  return used;
};
Live.gotoNumber = function (n) {
  var L = (S.full || S.overlay) ? S.zapList : S.view;
  if (!(n >= 1 && n <= L.length)) { O.toast(t('noChannelNo')); return; }
  if (S.full || S.overlay) {
    S.zapIdx = n - 1; playChannel(L[n - 1], true); if (S.overlay) closeOverlay(); pushPui();
  } else { setArea('channels'); G.ch.setCur(n - 1); drawInfo(); }
};

/* ---------- lifecycle ---------- */
Live.show = function (arg) {
  if (!built) build();
  shown = true; S.full = false; S.overlay = false;
  S.pick = arg && arg.pick ? arg.pick : null;
  root.classList.remove('hidden'); root.classList.remove('overlay');
  $('lvPrev').style.display = S.pick ? 'none' : '';
  $('lvInfo').style.display = S.pick ? 'none' : '';
  if (!S.cats.length) {
    S.loading = true; drawCh();
    D.getCats('live', function () {
      buildCats();
      var last = O.store.p('last.live', null), ent = null;
      if (last) S.cats.forEach(function (c) { if (c.id === last.cat) ent = c; });
      if (!ent) ent = S.cats[PSEUDO] || S.cats[2];
      G.cats.draw();
      openCat(ent, true);
      setTimeout(function () {
        D.loadAllLive(function () { refreshCounts(); if (shown) G.cats.draw(); });
      }, 1500);
    }, function (err) {
      S.loading = false; S.err = err; drawCh();
      S.retry = function () { S.err = null; Live.show(); };
    });
    setArea('cats');
  } else {
    refreshCounts(); G.cats.draw(); drawCh(); drawPrev(); drawInfo();
    setArea(S.view.length ? 'channels' : 'cats');
  }
  drawPrev();
};
Live.hide = function () {
  shown = false; clearTimeout(zapT);
  if (S.edit) { S.edit = null; showEditBar(false); }
  if (!S.pick) { Pl.stop(); S.playing = null; }
  if (root) root.classList.add('hidden');
};
Live.relang = function () { built = false; S.cats = []; S.catView = []; S.cur = null; S.all = []; S.view = []; };
Live.refreshData = function () { S.cats = []; S.catView = []; S.cur = null; S.all = []; S.view = []; };
})();
