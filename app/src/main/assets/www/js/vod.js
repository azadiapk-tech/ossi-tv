/* Movies + Series poster grids, series detail (seasons / episodes) and the shared VOD player controller. */
(function () {
'use strict';
var O = window.O, $ = O.$, esc = O.esc, t = O.t, K = O.K, D = O.data, Pl = O.player;
function FULLR() { return { x: 0, y: 0, w: O.stageW || 1920, h: 1080 }; }

/* "continue where you stopped?" — asked before a movie / episode with a saved position starts */
O.askResume = function (startMs, go) {
  if (!(startMs > 0)) { go(0); return; }
  var at = O.fmtDur(startMs);
  O.modal.open({ title: t('resumeQ'), msg: t('stoppedAt') + ' ' + at, rows: [
    { label: t('resume') + '  ' + at, onOk: function () { O.modal.close(); go(startMs); } },
    { label: t('fromStart'), onOk: function () { O.modal.close(); go(0); } }
  ] });
};

/* ================= shared VOD player controller ================= */
var VP = null, lastSave = 0;
O.vodPlay = function (o) {
  VP = o; lastSave = 0;
  Pl.playVod({ url: o.url, startMs: o.startMs || 0, item: o.item }, FULLR());
  O.pui.enter('vod', {
    back: vodExit,
    fav: o.favType && o.item ? function () { var on = O.fav.toggle(o.favType, slimItem(o.item)); O.toast(on ? t('favAdded') : t('favRemoved')); } : null,
    isFav: o.favType && o.item ? function () { return O.fav.has(o.favType, o.item.id); } : null
  });
  O.pui.setVod(o.title, o.sub);
  if (o.startMs > 0) O.toast(t('resumeAt') + ' ' + O.fmtDur(o.startMs));
};
function vodExit() {
  if (!VP) return;
  var o = VP; VP = null;
  if (Pl.time > 0) O.pos.set(o.posKey, Pl.time, Pl.dur);
  Pl.stop(); O.pui.exit();
  if (o.onExit) o.onExit();
}
O.vodActive = function () { return !!VP; };
Pl.on(function (ev, a) {
  if (!VP) return;
  if (ev === 'time') { if (Date.now() - lastSave > 10000) { lastSave = Date.now(); O.pos.set(VP.posKey, a, Pl.dur); } }
  else if (ev === 'ended') {
    O.pos.set(VP.posKey, 0, Pl.dur);
    if (VP.onEnd) { var o = VP; VP = null; Pl.stop(); o.onEnd(); } else vodExit();
  }
});

/* ================= grid screens ================= */
function rating(r) { var n = parseFloat(r); return n > 0 ? n.toFixed(1) : ''; }
function initials(name) {
  var n = String(name).replace(/^[^:]*:\s*/, '').replace(/[^\w؀-ۿ]/g, '');
  return (n || 'TV').slice(0, 2).toUpperCase();
}
function slimItem(c) { return { id: c.id, name: c.name, icon: c.icon, cat: c.cat, rating: c.rating, ext: c.ext }; }

function makeVod(type, rootId) {
  var root = null, built = false, G = {}, searchT = 0, shown = false;
  var S = { cats: [], catView: [], cur: null, all: [], view: [], area: 'grid', qc: '', qh: '', tok: 0, loading: false, err: null, retry: null, edit: null };
  var PS = 2;   /* pseudo categories (continue, favourites) at the top */
  var scr = {};

  function q(sel) { return root.querySelector(sel); }
  function build() {
    root = $(rootId);
    root.innerHTML =
      '<div class="hdr"></div>' + O.brandBack(t(type === 'movie' ? 'movies' : 'series')) +
      '<div class="hbtn" data-go="home" style="left:1700px;margin-left:var(--X,0px)">' + O.ic.home + '</div><div class="hbtn" data-go="settings" style="left:1790px;margin-left:var(--X,0px)">' + O.ic.gear + '</div>' +
      '<div class="pane lv-cats" style="background:rgba(4,10,26,.55)"></div>' +
      '<div class="sbox vcs" style="left:20px;top:140px;width:520px">' + O.ic.search + '<input class="vc srch" placeholder="' + esc(t(type === 'movie' ? 'searchMovies' : 'searchSeries')) + '"></div>' +
      '<div class="lv-list vd-cats"></div><div class="lv-list vd-grid"></div>' +
      '<div class="hints vd-hint"><span><i class="kd w"></i>OK</span><span>☰ ' + esc(t('hMenu')) + '</span><span>' + esc(t('hLongSort')) + '</span></div>' +
      '<div class="editbar hidden vd-edit"></div>' +
      '<div class="editbar tbar hidden vd-editT"><span class="et" dir="auto">' + esc(t('eTouch')) + '</span>' +
      '<b class="ebtn vd-edReset">' + esc(t('resetOrder')) + '</b><b class="ebtn on vd-edDone">' + esc(t('eDone')) + '</b></div>';
    G.cats = new O.VGrid(q('.vd-cats'), {
      cols: 1, itemH: 74, gap: 8, render: catRow, count: function () { return S.catView.length; },
      onClick: function (i) { if (S.edit) { if (S.edit.area === 'cats' && S.edit.mode === 'select') eToggle(i); return; } setArea('cats'); onCatOk(); },
      onLong: function (i) { tLong('cats', i); },
      onDragStart: function (i) { return tDrag('cats', i); },
      onDrop: function (slot) { tDrop(slot); }
    });
    G.grid = new O.VGrid(q('.vd-grid'), {
      cols: 5 + Math.round((O.stageX || 0) / 263), itemH: 420, gap: 16, render: card, count: function () { return S.view.length; },
      onClick: function (i, e) {
        if (S.edit) { if (S.edit.area === 'grid' && S.edit.mode === 'select') eToggle(i); return; }
        setArea('grid');
        if (e.target.closest && e.target.closest('.hrt')) toggleFav(S.view[i]); else activate(i);
      },
      onLong: function (i) { tLong('grid', i); },
      onDragStart: function (i) { return tDrag('grid', i); },
      onDrop: function (slot) { tDrop(slot); }
    });
    q('.vd-edDone').onclick = function () { if (S.edit) { if (S.edit.dirty) eSave(); else eExit(); } };
    q('.vd-edReset').onclick = function () { if (S.edit) eReset(); };
    root.addEventListener('click', function (e) {
      var g = e.target.closest && e.target.closest('[data-go]');
      if (g) O.app.go(g.getAttribute('data-go'));
    });
    /* one search box: searches ALL movies / series (not the packages) */
    q('.vc').addEventListener('input', function () {
      clearTimeout(searchT); searchT = setTimeout(function () { globalSearch(q('.vc').value.toLowerCase().replace(/^\s+|\s+$/g, '')); }, 300);
    });
    built = true;
  }
  function catRow(i) {
    var c = S.catView[i], act = S.cur && S.cur.id === c.id, sel = S.edit && S.edit.sel[String(c.id)];
    return '<div class="cat' + (c.type !== 'cat' ? ' pseudo' : '') + (act ? ' act' : '') + (sel ? ' sel' : '') + '" data-i="' + i + '"><span class="nm" dir="auto">' + esc(c.name) + '</span>' +
      (O.par.isLocked(type, c) ? O.ic.lock : '') + '<b>' + (c.count != null ? c.count : '') + '</b></div>';
  }
  function card(i) {
    var c = S.view[i], fav = O.fav.has(type, c.id), rt = rating(c.rating), ini = esc(initials(c.name)), pb = '';
    if (type === 'movie') { var p = O.pos.get('movie:' + c.id); if (p && p.d > 0 && p.t > 0) pb = '<div class="pb" style="width:' + Math.min(100, p.t / p.d * 100) + '%"></div>'; }
    var sel = S.edit && S.edit.sel[String(c.id)];
    return '<div class="pc' + (sel ? ' sel' : '') + '" data-i="' + i + '"><div class="pi"><div class="ph">' + ini + '</div>' + (c.icon ? '<img src="' + esc(c.icon) + '" decoding="async">' : '') +
      '</div>' + (rt ? '<span class="rt">' + rt + '</span>' : '') + '<span class="hrt' + (fav ? ' on' : '') + '">' + O.ic.heart + '</span>' + pb +
      '<div class="pn" dir="auto">' + esc(c.name) + '</div></div>';
  }
  function buildCats() {
    var real = O.applyOrder((D.cats[type] || []).map(function (c) { return { id: c.id, name: c.name, type: 'cat' }; }), O.store.p('order.cats.' + type, null), 'id');
    S.cats = [{ id: 'recent', name: t('continue'), type: 'recent' }, { id: 'fav', name: t('favorites'), type: 'fav' }].concat(real);
    refreshCounts(); filterCats();
  }
  function refreshCounts() {
    S.cats.forEach(function (c) {
      if (c.type === 'recent') c.count = O.recent.list(type).length;
      else if (c.type === 'fav') c.count = O.fav.list(type).length;
    });
  }
  function filterCats() {
    var qq = S.qc;
    S.catView = qq ? S.cats.filter(function (c) { return c.name.toLowerCase().indexOf(qq) > -1; }) : S.cats;
  }
  function onCatOk() { var c = S.catView[G.cats.cur]; if (c) openCat(c, true); }
  function globalSearch(qv) {
    if (!qv) { if (S.searching) { var back = S.preSearch; S.searching = false; if (back) loadList(back, false); } return; }
    if (!S.searching) { S.searching = true; S.preSearch = S.cur; }
    var tk = ++S.tok;
    S.cur = { id: 'search', name: t(type === 'movie' ? 'searchMovies' : 'searchSeries'), type: 'search' };
    S.loading = !(D.vodAll && D.vodAll[type]); if (S.loading) { S.all = []; S.view = []; drawGrid(); }
    D.getAllVod(type, function (list) {
      if (tk !== S.tok) return;
      S.loading = false; S.err = null; S.all = list; S.qh = qv; applyView();
      G.grid.reset(); drawGrid(); G.cats.draw();
    }, function (err) { if (tk !== S.tok) return; S.loading = false; S.err = err; drawGrid(); });
  }
  function openCat(entry, toGrid) { O.par.guard(type, entry, function () { loadList(entry, toGrid); }); }
  function loadList(entry, toGrid, keep) {
    S.cur = entry; S.retry = null; S.qh = ''; S.searching = false; q('.vc').value = '';
    O.store.ps('last.' + type, { cat: entry.id });
    var tk = ++S.tok;
    if (entry.type === 'recent') { setAll(O.recent.list(type), toGrid, keep); return; }
    if (entry.type === 'fav') { setAll(O.fav.list(type), toGrid, keep); return; }
    S.loading = true; S.err = null; S.all = []; S.view = []; drawGrid(); G.cats.draw();
    D.getItems(type, entry.id, function (list) { if (tk === S.tok) setAll(O.applyOrder(list, O.store.p('order.' + type + '.' + entry.id, null), 'id'), toGrid, keep); }, function (err) {
      if (tk !== S.tok) return;
      S.loading = false; S.err = err; drawGrid(); S.retry = function () { loadList(entry, toGrid); };
    });
  }
  function setAll(list, toGrid, keep) {
    S.loading = false; S.err = null; S.all = list; applyView(); refreshCounts();
    G.grid.reset(); if (keep) G.grid.setCur(keep);
    drawGrid(); G.cats.draw();
    if (toGrid && S.view.length) setArea('grid');
  }
  function applyView() {
    var qq = S.qh;
    S.view = qq ? S.all.filter(function (c) { return c.name.toLowerCase().indexOf(qq) > -1; }) : S.all;
  }
  function drawGrid() {
    var el = q('.vd-grid');
    if (S.loading) { el.innerHTML = '<div class="loading">' + esc(t('loading')) + '</div>'; return; }
    if (S.err) { el.innerHTML = '<div class="loading">' + esc(t('loadFail')) + '<br>' + esc(t('retryHint')) + '</div>'; return; }
    if (!S.view.length) { el.innerHTML = '<div class="loading">' + esc(t('empty')) + '</div>'; return; }
    G.grid.draw();
  }
  function setArea(a) {
    S.area = a;
    G.cats.setActive(a === 'cats'); G.grid.setActive(a === 'grid');
    q('.vcs').classList.toggle('focus', a === 'catSearch');
  }
  function toggleFav(c) {
    var keep = G.grid.cur, on = O.fav.toggle(type, slimItem(c));
    O.toast(on ? t('favAdded') : t('favRemoved')); refreshCounts();
    if (S.cur && S.cur.type === 'fav' && !on) loadList(S.cur, false, keep); else { G.grid.draw(); G.cats.draw(); }
  }
  /* ----- re-ordering with the remote: ☰ (or long OK) select, ☰ lift, arrows move, OK drop + save ----- */
  function eArr() { return S.edit.area === 'grid' ? S.all : S.cats.slice(PS); }
  function eGrid() { return S.edit.area === 'grid' ? G.grid : G.cats; }
  function eBase() { return S.edit.area === 'grid' ? 0 : PS; }
  function eBar() {
    var b = q('.vd-edit'), tb = q('.vd-editT'), touch = O.isTouch();
    b.innerHTML = S.edit ? O.editBarHtml(S.edit.mode) : '';
    b.classList.toggle('hidden', !S.edit || touch); tb.classList.toggle('hidden', !S.edit || !touch);
    q('.hints').style.display = S.edit ? 'none' : '';
  }
  function eDraw() { G.grid.draw(); G.cats.draw(); }
  /* ☰ on a list: small options window */
  function listMenu() {
    var a = S.area, M = O.modal, rows = [];
    if (a !== 'grid' && a !== 'cats') { O.toast(t('editFocus')); return; }
    var g = a === 'grid' ? G.grid : G.cats, c = a === 'grid' ? S.view[g.cur] : S.catView[g.cur];
    if (!c) return;
    if (a === 'grid' || !c.type || c.type === 'cat') {
      rows.push({ label: t('mMoveOne'), onOk: function () { M.close(); editStart(true); if (S.edit) eLift(); } });
      rows.push({ label: t('mMoveMany'), onOk: function () { M.close(); editStart(false); } });
    }
    if (a === 'grid') rows.push({ label: t(O.fav.has(type, c.id) ? 'mFavDel' : 'mFavAdd'), onOk: function () { M.close(); toggleFav(c); } });
    if (!rows.length) { O.toast(t('noMove')); return; }
    M.list(c.name || t('options'), function () { return rows; }, { light: true });
  }
  function editStart(selectCur) {
    var a = S.area;
    if (a !== 'grid' && a !== 'cats') return;
    if (a === 'grid') {
      if (!S.cur || S.cur.type !== 'cat') { O.toast(t('editRecent')); return; }
      if (S.qh) { O.toast(t('clearSearch')); return; }
      if (!S.all.length) return;
    } else if (S.qc) { O.toast(t('clearSearch')); return; }
    S.edit = { area: a, sel: {}, mode: 'select', orig: null, dirty: false };
    S.edit.orig = eArr().slice();
    if (selectCur) eToggle(eGrid().cur);
    root.classList.add('editing'); eBar(); eDraw();
  }
  function eToggle(i) {
    var c = eArr()[i - eBase()];
    if (!c) { O.toast(t('noMove')); return; }
    var k = String(c.id); if (S.edit.sel[k]) delete S.edit.sel[k]; else S.edit.sel[k] = 1;
    eDraw();
  }
  function eWrite(arr) {
    if (S.edit.area === 'grid') { S.all = arr; applyView(); }
    else { S.cats = S.cats.slice(0, PS).concat(arr); filterCats(); }
  }
  function eLift() {
    var E = S.edit, arr = eArr();
    if (!Object.keys(E.sel).length) { var c = arr[eGrid().cur - eBase()]; if (!c) { O.toast(t('noMove')); return; } E.sel[String(c.id)] = 1; }
    var block = [], rest = [], pos = -1;
    arr.forEach(function (x) { if (E.sel[String(x.id)]) { if (pos < 0) pos = rest.length; block.push(x); } else rest.push(x); });
    E.mode = 'move'; E.block = block; E.rest = rest; E.pos = pos;
    root.classList.add('moving'); eApply(); eBar();
  }
  function eApply() {
    var E = S.edit;
    eWrite(E.rest.slice(0, E.pos).concat(E.block, E.rest.slice(E.pos)));
    eDraw(); eGrid().setCur(E.pos + eBase());
  }
  function eMove(d) {
    var E = S.edit, np = O.clamp(E.pos + d, 0, E.rest.length);
    if (np !== E.pos) { E.pos = np; E.dirty = true; eApply(); }
  }
  function eExit() { S.edit = null; root.classList.remove('editing'); root.classList.remove('moving'); eBar(); eDraw(); }
  function eSave() {
    var E = S.edit;
    if (E.area === 'grid') O.store.ps('order.' + type + '.' + S.cur.id, S.all.map(function (c) { return c.id; }));
    else O.store.ps('order.cats.' + type, S.cats.slice(PS).map(function (c) { return c.id; }));
    eExit(); O.toast(t('orderSaved'));
  }
  function eCancel() { eWrite(S.edit.orig.slice()); eExit(); }
  function eReset() {
    O.modal.confirm(t('resetOrder'), t('resetOrderMsg'), function () {
      var area = S.edit.area; eExit();
      if (area === 'grid') { O.store.pd('order.' + type + '.' + S.cur.id); loadList(S.cur, false); }
      else { O.store.pd('order.cats.' + type); buildCats(); G.cats.reset(); G.cats.draw(); }
      O.toast(t('orderReset'));
    }, null, true);
  }
  /* ----- touch / mouse: hold = select (enters edit), tap = (de)select, hold a selected one = drag, release = drop + save ----- */
  function tLong(area, i) {
    if (S.edit) return;
    setArea(area); (area === 'grid' ? G.grid : G.cats).cur = i;
    editStart(true);
  }
  function tDrag(area, i) {
    var E = S.edit; if (!E || E.area !== area || E.mode !== 'select') return false;
    var c = eArr()[i - eBase()]; if (!c) return false;
    if (!E.sel[String(c.id)]) { E.sel[String(c.id)] = 1; eDraw(); }
    return true;
  }
  function tDrop(slot) {
    var E = S.edit; if (!E || !Object.keys(E.sel).length) return;
    var arr = eArr(), sl = O.clamp(slot - eBase(), 0, arr.length), block = [], rest = [], before = 0;
    arr.forEach(function (x, i) { if (E.sel[String(x.id)]) block.push(x); else { rest.push(x); if (i < sl) before++; } });
    eWrite(rest.slice(0, before).concat(block, rest.slice(before)));
    E.sel = {}; E.dirty = true;
    eSave();
  }
  scr.canLongOk = function () { return !S.edit && (S.area === 'grid' || S.area === 'cats'); };
  scr.onLongOk = function () { editStart(true); };

  function activate(i) {
    var c = S.view[i]; if (!c) return;
    O.app.setParent('detail', type === 'series' ? 'series' : 'movies');
    if (type === 'series') O.app.go('detail', { series: c }); else O.app.go('detail', { movie: c });
  }
  scr.onKey = function (e, k) {
    var a = S.area, used = true, E = S.edit;
    if (E) {
      if (k === K.BACK || k === K.ESC) { eCancel(); O.toast(t('eCancelled')); e.preventDefault(); return true; }
      if (E.mode === 'move') {
        var cols = E.area === 'grid' ? G.grid.cols : 1;
        if (k === K.UP) eMove(-cols); else if (k === K.DOWN) eMove(cols);
        else if (k === K.LEFT) eMove(-1); else if (k === K.RIGHT) eMove(1);
        else if (k === K.ENTER || k === K.RED) eSave();
        e.preventDefault(); return true;
      }
      if (k === K.MENU) { eLift(); e.preventDefault(); return true; }
      if (k === K.ENTER) { eToggle(eGrid().cur); e.preventDefault(); return true; }
      if (k === K.RED) { eSave(); e.preventDefault(); return true; }
      if (E.area === 'grid') {
        if (k === K.UP) G.grid.move(0, -1); else if (k === K.DOWN) G.grid.move(0, 1);
        else if (k === K.LEFT) G.grid.move(-1, 0); else if (k === K.RIGHT) G.grid.move(1, 0);
      } else {
        if (k === K.UP) G.cats.move(0, -1); else if (k === K.DOWN) G.cats.move(0, 1);
      }
      e.preventDefault(); return true;
    }
    if (k === K.MENU) { listMenu(); e.preventDefault(); return true; }
    if (k === K.BACK || k === K.ESC) { O.app.back(); e.preventDefault(); return true; }
    if (k === K.YELLOW) { if (a === 'grid' && S.view[G.grid.cur]) toggleFav(S.view[G.grid.cur]); e.preventDefault(); return true; }
    if (a === 'catSearch') {
      if (k === K.DOWN) setArea('cats'); else if (k === K.ENTER) O.searchKb(q('.vc')); else if (k === K.RIGHT) { if (S.view.length) setArea('grid'); } else used = false;
    } else if (a === 'cats') {
      if (k === K.UP) { if (!G.cats.move(0, -1)) setArea('catSearch'); }
      else if (k === K.DOWN) G.cats.move(0, 1);
      else if (k === K.RIGHT) { if (S.view.length) setArea('grid'); }
      else if (k === K.ENTER) { if (S.retry && !S.cats.length) S.retry(); else onCatOk(); }
      else if (k === K.PGUP || k === K.CHDN) G.cats.page(-1); else if (k === K.PGDN || k === K.CHUP) G.cats.page(1);
      else used = false;
    } else {
      if (k === K.UP) { if (!G.grid.move(0, -1)) setArea('catSearch'); }
      else if (k === K.DOWN) G.grid.move(0, 1);
      else if (k === K.LEFT) { if (!G.grid.move(-1, 0)) setArea('cats'); }
      else if (k === K.RIGHT) G.grid.move(1, 0);
      else if (k === K.ENTER) { if (S.retry && !S.view.length) S.retry(); else activate(G.grid.cur); }
      else if (k === K.PGUP || k === K.CHDN) G.grid.page(-1); else if (k === K.PGDN || k === K.CHUP) G.grid.page(1);
      else used = false;
    }
    if (used) e.preventDefault();
    return used;
  };
  scr.show = function () {
    if (!built) build();
    shown = true; root.classList.remove('hidden');
    if (!S.cats.length) {
      S.loading = true; drawGrid(); setArea('cats');
      D.getCats(type, function () {
        buildCats();
        var last = O.store.p('last.' + type, null), ent = null;
        if (last) S.cats.forEach(function (c) { if (c.id === last.cat) ent = c; });
        if (!ent) ent = S.cats[2] || S.cats[1];
        G.cats.draw(); openCat(ent, true);
      }, function (err) { S.loading = false; S.err = err; drawGrid(); S.retry = function () { S.err = null; scr.show(); }; });
    } else if (S.searching && O.app.prev !== 'detail') {
      /* coming back from the home screen: start fresh, without the old search */
      var back = S.preSearch; S.searching = false; q('.vc').value = '';
      if (back) loadList(back, true); else { refreshCounts(); G.cats.draw(); drawGrid(); }
    } else {
      refreshCounts(); G.cats.draw(); drawGrid(); setArea(S.view.length ? 'grid' : 'cats');
    }
  };
  scr.hide = function () { if (S.edit) eCancel(); shown = false; if (root) root.classList.add('hidden'); };
  scr.relang = function () { built = false; S.cats = []; S.catView = []; S.cur = null; S.all = []; S.view = []; };
  scr.refreshData = scr.relang;
  return scr;
}
O.movies = makeVod('movie', 'vodm');
O.series = makeVod('series', 'vods');

/* ================= detail page: series (seasons / episodes) or movie ================= */
var DT = O.detail = {};
(function () {
  var NAT = window.OssiNative || null;
  var root, built = false, grid = null;
  var S = { kind: 'series', series: null, movie: null, data: null, si: 0, so: 0, area: 'eps', bi: 0, err: null, loading: false, btns: [] };
  var BI = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="#fff"/></svg>',
    again: '<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 0 2-4.9" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M5 4v4h4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    trailer: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="3.5" fill="none" stroke="#fff" stroke-width="2"/><path d="M10 9v6l5-3z" fill="#fff"/></svg>',
    fav: '<svg viewBox="0 0 24 24"><path d="M12 20.5l-1.3-1.2C6 15.1 3 12.4 3 9.1 3 6.4 5.1 4.3 7.8 4.3c1.5 0 3 .7 4.2 1.9 1.2-1.2 2.7-1.9 4.2-1.9 2.7 0 4.8 2.1 4.8 4.8 0 3.3-3 6-7.7 10.2z" fill="none" stroke="#fff" stroke-width="2"/></svg>',
    favOn: '<svg viewBox="0 0 24 24"><path d="M12 20.5l-1.3-1.2C6 15.1 3 12.4 3 9.1 3 6.4 5.1 4.3 7.8 4.3c1.5 0 3 .7 4.2 1.9 1.2-1.2 2.7-1.9 4.2-1.9 2.7 0 4.8 2.1 4.8 4.8 0 3.3-3 6-7.7 10.2z" fill="#ff3d7f"/></svg>'
  };
  function build() {
    root = $('detail');
    root.innerHTML =
      '<div class="dt-bd" id="dtBd"></div>' +
      '<div class="hdr"></div>' + O.brandBack('') +
      '<div class="hbtn" data-go="home" style="left:1790px;margin-left:var(--X,0px)">' + O.ic.home + '</div>' +
      '<div class="dt-poster" id="dtPoster"></div><div class="dt-btns" id="dtBtns"></div>' +
      '<div class="dt-title ttl" id="dtTitle" dir="auto"></div><div class="dt-meta" id="dtMeta" dir="auto"></div>' +
      '<div class="dt-crew" id="dtCrew"></div><div class="dt-plot" id="dtPlot" dir="auto"></div>' +
      '<div class="dt-seasons" id="dtSeasons"></div><div id="dtEps"></div>' +
      '<div class="hints"><span><i class="kd w"></i>OK</span><span><i class="kd y"></i>' + esc(t('hFav')) + '</span></div>';
    grid = new O.VGrid($('dtEps'), {
      cols: 1, itemH: 80, gap: 8, render: epRow, count: function () { return curEps().length; },
      onClick: function (i) { setArea('eps'); playEp(S.si, i); }
    });
    root.addEventListener('click', function (e) {
      var g = e.target.closest && e.target.closest('[data-go]'); if (g) { O.app.go(g.getAttribute('data-go')); return; }
      var b = e.target.closest && e.target.closest('[data-b]');
      if (b) { S.bi = parseInt(b.getAttribute('data-b'), 10); setArea('btns'); btnAct(S.bi); return; }
      var sn = e.target.closest && e.target.closest('.sn');
      if (sn && S.data && S.kind === 'series') { S.si = parseInt(sn.getAttribute('data-s'), 10); drawSeasons(); grid.reset(); setArea('eps'); }
    });
    built = true;
  }
  function curEps() { return S.kind === 'series' && S.data && S.data.seasons[S.si] ? S.data.seasons[S.si].eps : []; }
  function epRow(i) {
    var e = curEps()[i], p = O.pos.get('series:' + e.id), pb = '';
    if (p && p.d > 0 && p.t > 0) pb = '<div class="pb" style="width:' + Math.min(100, p.t / p.d * 100) + '%"></div>';
    return '<div class="ep" data-i="' + i + '"><span class="no">E' + esc(e.num || (i + 1)) + '</span><span class="nm" dir="auto">' + esc(e.title) + '</span><span class="du">' + esc(e.dur || '') + '</span>' + pb + '</div>';
  }
  function drawSeasons() {
    var d = S.data, h = '';
    if (S.kind !== 'series' || !d) { $('dtSeasons').innerHTML = ''; return; }
    if (O.isTouch()) S.so = 0; else if (S.si < S.so) S.so = S.si; else if (S.si > S.so + 6) S.so = S.si - 6;
    for (var i = S.so; i < d.seasons.length; i++)
      h += '<span class="sn' + (i === S.si ? ' act' : '') + (S.area === 'seasons' && i === S.si ? ' focus' : '') + '" data-s="' + i + '">' + esc(t('season')) + ' ' + esc(d.seasons[i].num) + '</span>';
    $('dtSeasons').innerHTML = h;
  }
  /* ----- action buttons under the poster ----- */
  function item() { return S.kind === 'movie' ? S.movie : S.series; }
  function favType() { return S.kind === 'movie' ? 'movie' : 'series'; }
  function buildBtns() {
    var b = [], it = item(), d = S.data || {};
    if (S.kind === 'movie') {
      var p = O.pos.get('movie:' + it.id), can = p && p.t > 30000 && (!p.d || p.t < p.d * 0.95);
      b.push({ id: 'play', ic: BI.play, label: t('playMovie'), main: true });   /* a saved position is asked about when playing */
    } else if (d.seasons && d.seasons.length) {
      var last = O.store.p('lastEp.' + it.id, null), se = last && d.seasons[last.s], ep = se && se.eps[last.i];
      b.push({ id: 'play', ic: BI.play, label: ep ? t('resume') + '  ' + t('seasonShort') + se.num + ' • E' + (ep.num || last.i + 1) : t('playEp1'), main: true });
    }
    if (d.trailer) b.push({ id: 'trailer', ic: BI.trailer, label: t('trailer') });
    var fav = O.fav.has(favType(), it.id);
    b.push({ id: 'fav', ic: fav ? BI.favOn : BI.fav, label: fav ? t('favRemove') : t('favAdd') });
    S.btns = b; if (S.bi >= b.length) S.bi = 0;
  }
  function drawBtns() {
    buildBtns();
    var h = '';
    S.btns.forEach(function (x, i) {
      h += '<div class="dbtn' + (x.main ? ' main' : '') + (S.area === 'btns' && i === S.bi ? ' focus' : '') + '" data-b="' + i + '">' + x.ic + '<span dir="auto">' + esc(x.label) + '</span></div>';
    });
    $('dtBtns').innerHTML = h;
  }
  function btnAct(i) {
    var x = S.btns[i]; if (!x) return;
    var it = item(), d = S.data || {};
    if (x.id === 'play') {
      if (S.kind === 'movie') playMovie(false);
      else { var last = O.store.p('lastEp.' + it.id, null); if (last && d.seasons[last.s] && d.seasons[last.s].eps[last.i]) playEp(last.s, last.i); else playEp(0, 0); }
    } else if (x.id === 'start') playMovie(true);
    else if (x.id === 'trailer') {
      if (NAT && NAT.openUrl) NAT.openUrl(O.trailerUrl(d.trailer)); else if (window.OssiDesk) window.OssiDesk.openUrl(O.trailerUrl(d.trailer)); else O.toast(t('trailerNA'));
    } else if (x.id === 'fav') {
      var on = O.fav.toggle(favType(), slimItem(it)); O.toast(on ? t('favAdded') : t('favRemoved')); drawBtns();
    }
  }
  function setArea(a) {
    if (a === 'eps' && !curEps().length) a = 'btns';
    S.area = a; grid.setActive(a === 'eps'); drawSeasons(); drawBtns();
  }
  function drawMain() {
    var it = item(), d = S.data;
    root.classList.toggle('dt-movie', S.kind === 'movie');
    $('dtTitle').textContent = (d && d.name) || it.name;
    var meta = [];
    if (d) { if (d.year) meta.push(d.year); var r = parseFloat(d.rating || it.rating); if (r > 0) meta.push('★ ' + r.toFixed(1)); if (d.dur) meta.push(d.dur); if (d.genre) meta.push(d.genre); }
    $('dtMeta').textContent = meta.join('   •   ');
    $('dtPlot').textContent = d ? d.plot : '';
    var crew = '';
    if (d && d.director) crew += '<div dir="auto"><b>' + esc(t('director')) + ':</b> ' + esc(d.director) + '</div>';
    if (d && d.cast) crew += '<div dir="auto"><b>' + esc(t('cast')) + ':</b> ' + esc(d.cast) + '</div>';
    $('dtCrew').innerHTML = crew;
    var cover = (d && d.cover) || it.icon, bd = (d && d.backdrop) || cover;
    $('dtPoster').innerHTML = cover ? '<img src="' + esc(cover) + '" decoding="async">' : '';
    $('dtBd').style.backgroundImage = bd ? 'url("' + String(bd).replace(/"/g, '%22') + '")' : 'none';
    drawBtns();
  }
  function playMovie(fromStart) {
    var c = S.movie, p = O.pos.get('movie:' + c.id), start0 = !fromStart && p && p.t > 30000 && (!p.d || p.t < p.d * 0.95) ? p.t : 0;
    O.askResume(start0, function (start) {
    O.recent.push('movie', slimItem(c));
    root.classList.add('hidden');
    O.vodPlay({
      title: (S.data && S.data.name) || c.name, sub: (S.data && S.data.year) || '',
      url: O.api.stream('movie', c.id, (S.data && S.data.ext) || c.ext || 'mp4'), startMs: start, posKey: 'movie:' + c.id, item: c, favType: 'movie',
      onExit: function () { root.classList.remove('hidden'); drawBtns(); }
    });
    });
  }
  function playEp(si, ei, noAsk) {
    var se = S.data.seasons[si], e = se && se.eps[ei]; if (!e) return;
    var key = 'series:' + e.id, p = O.pos.get(key), start0 = !noAsk && p && p.t > 30000 && (!p.d || p.t < p.d * 0.95) ? p.t : 0;
    O.askResume(start0, function (start) {
    O.recent.push('series', slimItem(S.series));
    O.store.ps('lastEp.' + S.series.id, { s: si, i: ei, e: e.id, n: se.num, en: e.num || ei + 1 });
    root.classList.add('hidden');
    function back() { root.classList.remove('hidden'); S.si = si; drawSeasons(); drawBtns(); if (curEps().length) { grid.draw(); grid.setCur(ei); } }
    O.vodPlay({
      title: (S.data.name || S.series.name), sub: t('season') + ' ' + se.num + '  •  E' + (e.num || ei + 1) + '  ' + e.title,
      url: O.api.stream('series', e.id, e.ext), startMs: start, posKey: key, item: S.series, favType: 'series',
      onEnd: function () {
        var nx = ei + 1 < se.eps.length ? [si, ei + 1] : (si + 1 < S.data.seasons.length ? [si + 1, 0] : null);
        if (!nx) { O.pui.exit(); Pl.stop(); back(); return; }
        var ns = S.data.seasons[nx[0]], ne = ns.eps[nx[1]];
        O.pui.nextUp({
          title: S.data.name || S.series.name, sub: t('season') + ' ' + ns.num + '  •  E' + (ne.num || nx[1] + 1) + '  ' + ne.title, sec: 10,
          go: function () { playEp(nx[0], nx[1], true); },
          cancel: function () { O.pui.exit(); Pl.stop(); back(); }
        });
      },
      onExit: back
    });
    });
  }
  DT.show = function (arg) {
    if (!built) build();
    root.classList.remove('hidden');
    if (arg && arg.movie) {
      S.kind = 'movie'; S.movie = arg.movie; S.series = null; S.data = null; S.bi = 0; S.area = 'btns';
      $('dtEps').innerHTML = ''; drawMain(); drawSeasons();
      var mid = S.movie.id;
      D.movieInfo(mid, function (d) { if (S.movie && S.movie.id === mid) { S.data = d; drawMain(); } }, function () {});
    } else if (arg && arg.series) {
      S.kind = 'series'; S.series = arg.series; S.movie = null; S.data = null; S.si = 0; S.so = 0; S.bi = 0; S.err = null; S.loading = true; S.area = 'eps';
      drawMain(); drawSeasons(); $('dtEps').innerHTML = '<div class="loading">' + esc(t('loading')) + '</div>';
      var id = S.series.id;
      D.seriesInfo(id, function (d) {
        if (!S.series || S.series.id !== id) return;
        S.data = d; S.loading = false;
        var last = O.store.p('lastEp.' + id, null), ei = 0;
        if (last && d.seasons[last.s]) { S.si = last.s; ei = last.i; }
        drawMain(); drawSeasons(); grid.reset();
        if (!curEps().length) $('dtEps').innerHTML = '<div class="loading">' + esc(t('empty')) + '</div>'; else { grid.draw(); grid.setCur(ei); }
        setArea('eps');
      }, function () {
        S.loading = false; S.err = 1; $('dtEps').innerHTML = '<div class="loading">' + esc(t('loadFail')) + '</div>';
      });
    } else { drawMain(); drawSeasons(); }
  };
  DT.hide = function () { if (root) root.classList.add('hidden'); };
  DT.relang = function () { built = false; };
  DT.onKey = function (e, k) {
    var used = true, n = S.kind === 'series' && S.data ? S.data.seasons.length : 0;
    if (k === K.BACK || k === K.ESC) { O.app.back(); }
    else if (k === K.YELLOW) { var on = O.fav.toggle(favType(), slimItem(item())); O.toast(on ? t('favAdded') : t('favRemoved')); drawBtns(); }
    else if (S.area === 'btns') {
      if (k === K.UP) { if (S.bi > 0) S.bi--; drawBtns(); }
      else if (k === K.DOWN) { if (S.bi < S.btns.length - 1) S.bi++; drawBtns(); }
      else if (k === K.RIGHT) { if (curEps().length) setArea('eps'); }
      else if (k === K.ENTER) btnAct(S.bi);
      else used = false;
    } else if (S.area === 'seasons') {
      if (k === K.LEFT) { if (S.si > 0) { S.si--; drawSeasons(); grid.reset(); } else setArea('btns'); }
      else if (k === K.RIGHT && S.si < n - 1) { S.si++; drawSeasons(); grid.reset(); }
      else if (k === K.DOWN || k === K.ENTER) { if (curEps().length) setArea('eps'); }
      else used = false;
    } else {
      if (k === K.UP) { if (!grid.move(0, -1) && n > 1) setArea('seasons'); }
      else if (k === K.DOWN) grid.move(0, 1);
      else if (k === K.LEFT) setArea('btns');
      else if (k === K.ENTER) { if (curEps().length) playEp(S.si, grid.cur); }
      else if (k === K.PGUP || k === K.CHDN) grid.page(-1); else if (k === K.PGDN || k === K.CHUP) grid.page(1);
      else used = false;
    }
    if (used) e.preventDefault();
    return used;
  };
})();
})();
