/* Home screen: 4 big tiles, "continue watching" row, clock, playlist badge. */
(function () {
'use strict';
var O = window.O, $ = O.$, esc = O.esc, t = O.t, K = O.K;
function svg(inner) { return '<svg viewBox="0 0 64 64">' + inner + '</svg>'; }
var TILES = [
  { go: 'live', l: 'live', s: 'liveSub', i: svg('<rect x="6" y="18" width="52" height="38" rx="7" fill="none" stroke="#4f8cff" stroke-width="5"/><path d="M20 6l12 12 12-12" stroke="#4f8cff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 28v18l16-9z" fill="#4f8cff"/>') },
  { go: 'movies', l: 'movies', s: 'moviesSub', i: svg('<rect x="6" y="26" width="52" height="30" rx="4" fill="#ffab40"/><path d="M6 12l10 12M22 12l10 12M38 12l10 12M52 14l6 10" stroke="#ffab40" stroke-width="6" stroke-linecap="round"/><path d="M32 33l3 6 6 1-5 4 1 7-5-3-5 3 1-7-5-4 6-1z" fill="#fff3d6"/>') },
  { go: 'series', l: 'series', s: 'seriesSub', i: svg('<rect x="14" y="6" width="44" height="36" rx="5" fill="#e040fb"/><path d="M30 14v20l16-10z" fill="#fff"/><path d="M6 16v34a5 5 0 005 5h33" stroke="#e040fb" stroke-width="5" fill="none" stroke-linecap="round"/>') },
  { go: 'settings', l: 'settings', s: 'settingsSub', i: svg('<circle cx="32" cy="32" r="14" fill="none" stroke="#5ef0a8" stroke-width="9"/><circle cx="32" cy="32" r="26" fill="none" stroke="#5ef0a8" stroke-width="9" stroke-dasharray="7.2 7.2"/>') }
];
var H = O.home = {}, root, built = false, idx = 0, clockT = 0, area = 'tiles', ci = 0, cont = [];

function build() {
  root = $('home');
  var h = O.brand + '<div class="hinfo"><div class="subbadge hidden" id="hSub"></div><div class="plbadge" dir="auto"><span>' + esc(t('playlist')) + ':</span><b id="hPl"></b></div></div>' +
    '<div class="clock"><b id="hTime"></b><span id="hDate"></span></div><div class="tiles">';
  TILES.forEach(function (x, i) {
    h += '<div class="tile" data-i="' + i + '">' + x.i + '<h3 dir="auto">' + esc(t(x.l)) + '</h3><p dir="auto">' + esc(t(x.s)) + '</p></div>';
  });
  h += '</div><div class="cw-h" dir="auto">' + esc(t('continue')) + '</div><div class="cw" id="hCont"></div>';
  root.innerHTML = h;
  root.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.tile');
    if (c) { idx = parseInt(c.getAttribute('data-i'), 10); area = 'tiles'; paint(); O.app.go(TILES[idx].go); return; }
    var cc = e.target.closest && e.target.closest('.cc');
    if (cc) { ci = parseInt(cc.getAttribute('data-c'), 10); area = 'cont'; paint(); openCont(ci); }
  });
  built = true;
}

/* ----- continue watching: recent movies + series, newest first ----- */
function contItems() {
  var out = [];
  O.recent.list('movie').forEach(function (it) {
    var p = O.pos.get('movie:' + it.id);
    if (p && p.d > 0 && p.t === 0) return;                 /* finished */
    out.push({ k: 'movie', it: it, ts: it.ts || 0, pct: p && p.d > 0 ? p.t / p.d * 100 : 0, sub: p && p.d > 0 ? t('left') + ' ' + O.fmtDur(p.d - p.t) : '' });
  });
  O.recent.list('series').forEach(function (it) {
    var last = O.store.p('lastEp.' + it.id, null), p = last && last.e ? O.pos.get('series:' + last.e) : null;
    out.push({ k: 'series', it: it, ts: it.ts || 0, pct: p && p.d > 0 ? p.t / p.d * 100 : 0,
      sub: (last && last.n != null ? t('seasonShort') + last.n + ' • E' + last.en : '') +
           (p && p.d > 0 && p.t > 0 ? '  •  ' + t('left') + ' ' + O.fmtDur(p.d - p.t) : '') });
  });
  out.sort(function (a, b) { return b.ts - a.ts; });
  return out.slice(0, 16);
}
function drawCont() {
  cont = contItems();
  root.classList.toggle('nocont', !cont.length);
  var h = '';
  cont.forEach(function (c, i) {
    var ini = esc(String(c.it.name || '').replace(/^[^:]*:\s*/, '').slice(0, 2));
    h += '<div class="cc" data-c="' + i + '"><div class="ci"><div class="ph">' + ini + '</div>' + (c.it.icon ? '<img src="' + esc(c.it.icon) + '" decoding="async" onerror="this.style.display=\'none\'">' : '') +
      '<span class="ck">' + (c.k === 'movie' ? TILES[1].i : TILES[2].i) + '</span>' + (c.pct > 0 ? '<div class="pb" style="width:' + Math.min(100, c.pct).toFixed(1) + '%"></div>' : '') + '</div>' +
      '<div class="cn" dir="auto">' + esc(c.it.name) + '</div><div class="cs" dir="auto">' + esc(c.sub) + '</div></div>';
  });
  $('hCont').innerHTML = h;
  if (ci >= cont.length) ci = Math.max(0, cont.length - 1);
  if (!cont.length && area === 'cont') area = 'tiles';
}
function openCont(i) {
  var c = cont[i]; if (!c) return;
  O.app.setParent('detail', 'home');
  if (c.k === 'movie') O.app.go('detail', { movie: c.it }); else O.app.go('detail', { series: c.it });
}
function paint() {
  var els = root.querySelectorAll('.tile');
  for (var i = 0; i < els.length; i++) els[i].classList.toggle('focus', area === 'tiles' && i === idx);
  root.classList.toggle('in-cont', area === 'cont');
  var cs = root.querySelectorAll('.cc');
  for (var j = 0; j < cs.length; j++) cs[j].classList.toggle('focus', area === 'cont' && j === ci);
  if (area === 'cont' && cs[ci]) {
    var box = $('hCont'), el = cs[ci], l = el.offsetLeft, r = l + el.offsetWidth;
    if (l < box.scrollLeft) box.scrollLeft = l - 20; else if (r > box.scrollLeft + box.clientWidth) box.scrollLeft = r - box.clientWidth + 20;
  }
}
function tick() {
  var d = new Date();
  $('hTime').textContent = O.fmtClock(d); $('hDate').textContent = O.fmtDate(d);
  drawSub();
}
/* subscription: days left (counts down every day) + expiry date, from the server's user_info.exp_date */
function drawSub() {
  var el = $('hSub'); if (!el) return;
  var ui = O.data.info;
  if (!ui) { el.classList.add('hidden'); return; }
  var exp = parseInt(ui.exp_date, 10), cls = 'ok', h;
  if (!(exp > 0)) {
    h = '<span class="sd">∞</span><span class="sl">' + esc(t('subUnlimited')) + '</span>';
  } else {
    var end = new Date(exp * 1000), days = Math.ceil((end.getTime() - Date.now()) / 86400000);
    var loc = { ar: 'ar', en: 'en-GB', de: 'de-DE' }[O.lang()] || 'en-GB', ds;
    try { ds = end.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { ds = end.toISOString().slice(0, 10); }
    if (days <= 0) { cls = 'bad'; h = '<span class="sd">!</span><span class="sl">' + esc(t('subExpired')) + '<small>' + esc(ds) + '</small></span>'; }
    else {
      cls = days <= 7 ? 'bad' : days <= 30 ? 'warn' : 'ok';
      h = '<span class="sd">' + days + '</span><span class="sl">' + esc(t('daysLeft')) + '<small>' + esc(t('expiresOn')) + ' ' + esc(ds) + '</small></span>';
    }
  }
  el.className = 'subbadge ' + cls; el.innerHTML = h;
}
O.onInfo = function () { if (built) drawSub(); };
H.refresh = function () { if (built && $('hPl')) $('hPl').textContent = O.pl.name; };
H.show = function () {
  if (!built) build();
  root.classList.remove('hidden'); drawCont(); paint(); tick(); H.refresh();
  clearInterval(clockT); clockT = setInterval(tick, 20000);
};
H.hide = function () { clearInterval(clockT); if (root) root.classList.add('hidden'); };
H.relang = function () { built = false; };
/* ☰ on a "continue watching" card: remove it from the row */
function contMenu(i) {
  var c = cont[i]; if (!c) return;
  O.modal.list(c.it.name, function () {
    return [{ label: t('contDel'), onOk: function () {
      O.modal.close(); O.recent.remove(c.k, c.it.id); drawCont();
      if (!cont.length) area = 'tiles';
      paint(); O.toast(t('contDeleted'));
    } }];
  }, { light: true });
}
H.onKey = function (e, k) {
  var used = true;
  if (k === K.BACK || k === K.ESC || k === K.EXIT) { if (area === 'cont') { area = 'tiles'; paint(); } else O.app.confirmExit(); }
  else if (area === 'tiles') {
    if (k === K.LEFT) { if (idx > 0) idx--; paint(); }
    else if (k === K.RIGHT) { if (idx < TILES.length - 1) idx++; paint(); }
    else if (k === K.DOWN) { if (cont.length) { area = 'cont'; paint(); } }
    else if (k === K.ENTER) O.app.go(TILES[idx].go);
    else used = false;
  } else {
    if (k === K.LEFT) { if (ci > 0) ci--; paint(); }
    else if (k === K.RIGHT) { if (ci < cont.length - 1) ci++; paint(); }
    else if (k === K.UP) { area = 'tiles'; paint(); }
    else if (k === K.ENTER) openCont(ci);
    else if (k === K.MENU) contMenu(ci);
    else used = false;
  }
  if (used) e.preventDefault();
  return used;
};
})();
