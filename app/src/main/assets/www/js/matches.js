/* Matches: today's football results (live / finished / upcoming) for the chosen leagues.
   Data: ESPN's public scoreboard (no account). OK on a match plays the channel linked to its league. */
(function () {
'use strict';
var O = window.O, $ = O.$, esc = O.esc, t = O.t, K = O.K, M = O.modal;

/* leagues shown in the left column; "nat" = national teams (several ESPN competitions) */
var LEAGUES = [
  { id: 'all', n: 'mAll', f: '⚽' },
  { id: 'esp.1', n: 'lgEsp', f: '🇪🇸' },
  { id: 'eng.1', n: 'lgEng', f: '🏴' },
  { id: 'ger.1', n: 'lgGer', f: '🇩🇪' },
  { id: 'ita.1', n: 'lgIta', f: '🇮🇹' },
  { id: 'fra.1', n: 'lgFra', f: '🇫🇷' },
  { id: 'tur.1', n: 'lgTur', f: '🇹🇷' },
  { id: 'nat', n: 'lgNat', f: '🌍', src: ['fifa.world', 'fifa.worldq.uefa', 'fifa.worldq.afc', 'fifa.worldq.caf', 'uefa.nations', 'uefa.euro', 'fifa.friendly', 'caf.nations', 'afc.asian.cup'] }
];
var TABS = ['live', 'fin', 'up'];
var S = { lg: 0, tab: 0, area: 'list', li: 0, ev: [], loading: false, err: false, tok: 0, ts: 0 };
var root = null, built = false, shown = false, timer = 0;
var MA = O.matches = {};

function ymd(d) { return d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
function srcOf(lg) { return lg.src || [lg.id]; }
function leagueOf(code) { for (var i = 1; i < LEAGUES.length; i++) if (srcOf(LEAGUES[i]).indexOf(code) > -1) return LEAGUES[i]; return LEAGUES[0]; }

/* ---------- data ---------- */
function parse(code, d) {
  var out = [];
  ((d && d.events) || []).forEach(function (e) {
    var c = (e.competitions || [])[0] || {}, st = (e.status || (c.status) || {}), ty = st.type || {};
    var h = null, a = null;
    (c.competitors || []).forEach(function (x) { if (x.homeAway === 'home') h = x; else a = x; });
    if (!h || !a) return;
    function team(x) { var tm = x.team || {}; return { n: tm.shortDisplayName || tm.displayName || tm.name || '?', logo: tm.logo || (tm.logos && tm.logos[0] && tm.logos[0].href) || '', s: x.score != null ? String(x.score) : '' }; }
    out.push({ id: code + ':' + e.id, code: code, lg: leagueOf(code).id, t: Date.parse(e.date) || 0,
      state: ty.state === 'in' ? 'live' : ty.state === 'post' ? 'fin' : 'up',
      clock: ty.shortDetail || st.displayClock || '', h: team(h), a: team(a) });
  });
  return out;
}
function load(quiet) {
  var tk = ++S.tok, codes = [], got = [], left;
  LEAGUES.forEach(function (l, i) { if (i) codes = codes.concat(srcOf(l)); });
  left = codes.length; S.err = false;
  if (!quiet) { S.loading = true; draw(); }
  var day = ymd(new Date()), fails = 0;
  codes.forEach(function (code) {
    O.getJSON('https://site.api.espn.com/apis/site/v2/sports/soccer/' + code + '/scoreboard?dates=' + day + '&lang=ar&region=sa',
      function (d) { if (tk !== S.tok) return; got = got.concat(parse(code, d)); done(); },
      function () { if (tk !== S.tok) return; fails++; done(); }, 1);
  });
  function done() {
    if (--left > 0) return;
    S.loading = false; S.ts = Date.now();
    if (!got.length && fails === codes.length) { S.err = true; draw(); return; }
    got.sort(function (x, y) { return x.t - y.t; });
    var keep = S.ev.length; S.ev = got;
    if (!keep) { var c = counts(); S.tab = c.live ? 0 : c.up ? 2 : 1; }
    draw(); schedule();
  }
}
function schedule() {
  clearTimeout(timer);
  if (!shown) return;
  var live = S.ev.some(function (e) { return e.state === 'live'; });
  timer = setTimeout(function () { if (shown) load(true); }, live ? 60000 : 300000);   /* live: every minute */
}
function counts(lgId) {
  var c = { live: 0, fin: 0, up: 0, all: 0 };
  S.ev.forEach(function (e) { if (lgId && lgId !== 'all' && e.lg !== lgId) return; c[e.state]++; c.all++; });
  return c;
}
function view() {
  var lg = LEAGUES[S.lg].id, tab = TABS[S.tab];
  return S.ev.filter(function (e) { return e.state === tab && (lg === 'all' || e.lg === lg); });
}

/* ---------- channel linked to a league ---------- */
function chanOf(lgId) { return O.store.p('mchan.' + lgId, null); }
function linkChannel(e) {
  var lg = leagueOf(e.code);
  O.app.setParent('live', 'matches');
  O.app.go('live', { pick: function (c) {
    O.store.ps('mchan.' + lg.id, { id: c.id, name: c.name, icon: c.icon, cat: c.cat });
    O.toast(t('mLinked') + ' ' + c.name);
    O.app.go('matches');
  } });
}
function watch(e) {
  var ch = chanOf(e.lg);
  if (!ch) { linkChannel(e); return; }
  O.live.playFrom(ch, 'matches');
}
function rowMenu(e) {
  var ch = chanOf(e.lg), lg = leagueOf(e.code), rows = [];
  if (ch) rows.push({ label: '▶  ' + t('mWatch') + ': ' + ch.name, onOk: function () { M.close(); watch(e); } });
  rows.push({ label: '📺  ' + (ch ? t('mRelink') : t('mLink')) + ' (' + t(lg.n) + ')', onOk: function () { M.close(); linkChannel(e); } });
  if (ch) rows.push({ label: '✖  ' + t('mUnlink'), onOk: function () { M.close(); O.store.ps('mchan.' + lg.id, null); draw(); } });
  M.list(e.h.n + ' – ' + e.a.n, function () { return rows; }, { light: true });
}

/* ---------- drawing ---------- */
function ini(n) { return esc(String(n || '?').replace(/[^\w؀-ۿ]/g, '').slice(0, 2).toUpperCase()); }
function logo(tm) {
  return '<span class="mt-lg"><i>' + ini(tm.n) + '</i>' + (tm.logo ? '<img src="' + esc(tm.logo) + '" decoding="async" loading="lazy" onerror="this.remove()">' : '') + '</span>';
}
function hm(ms) { return O.fmtHM(ms); }
function row(e, i) {
  var ch = chanOf(e.lg), mid, st;
  if (e.state === 'up') { mid = '<b class="mt-time">' + hm(e.t) + '</b>'; st = '<span class="mt-up">' + esc(t('mToday')) + '</span>'; }
  else {
    mid = '<b class="mt-sc"><span dir="ltr">' + esc(e.a.s) + ' - ' + esc(e.h.s) + '</span></b>';
    st = e.state === 'live' ? '<span class="mt-live">● ' + esc(t('mLive')) + ' ' + esc(e.clock) + '</span>' : '<span class="mt-fin">' + esc(t('mEnded')) + '</span>';
  }
  return '<div class="mt-row' + (S.area === 'list' && i === S.li ? ' focus' : '') + '" data-i="' + i + '">' +
    '<div class="mt-t mt-h"><span class="mt-n" dir="auto">' + esc(e.h.n) + '</span>' + logo(e.h) + '</div>' + mid +
    '<div class="mt-t mt-a">' + logo(e.a) + '<span class="mt-n" dir="auto">' + esc(e.a.n) + '</span></div>' +
    '<div class="mt-meta">' + st + '<span class="mt-ch' + (ch ? '' : ' off') + '" data-ch="' + i + '">' + (ch ? '📺 ' + esc(ch.name) : '＋ ' + esc(t('mLink'))) + '</span></div></div>';
}
function draw() {
  if (!built) return;
  var h = '';
  LEAGUES.forEach(function (l, i) {
    var c = counts(l.id);
    h += '<div class="cat mt-cat' + (i === S.lg ? ' act' : '') + (S.area === 'lg' && i === S.lg ? ' focus' : '') + '" data-l="' + i + '"><span class="fl">' + l.f + '</span><span class="nm" dir="auto">' + esc(t(l.n)) + '</span><b>' + (S.ev.length ? c.all : '') + '</b></div>';
  });
  $('mtLg').innerHTML = h;
  var cc = counts(LEAGUES[S.lg].id), lab = { live: '🔴 ' + t('mLiveNow'), fin: '✅ ' + t('mEndedTab'), up: '🕐 ' + t('mUpcoming') };
  $('mtTabs').innerHTML = TABS.map(function (k, i) {
    return '<div class="mt-tab' + (i === S.tab ? ' on' : '') + (S.area === 'tabs' && i === S.tab ? ' focus' : '') + '" data-t="' + i + '">' + esc(lab[k]) + '<i>' + cc[k] + '</i></div>';
  }).join('');
  var el = $('mtList');
  if (S.loading && !S.ev.length) { el.innerHTML = '<div class="loading">' + esc(t('loading')) + '</div>'; return; }
  if (S.err) { el.innerHTML = '<div class="loading">' + esc(t('mFail')) + '</div>'; return; }
  var v = view(); S.view = v;
  if (S.li >= v.length) S.li = Math.max(0, v.length - 1);
  if (!v.length) { el.innerHTML = '<div class="loading">' + esc(t('mNone')) + '</div>'; return; }
  var out = '', lastLg = null;
  v.forEach(function (e, i) {
    if (e.lg !== lastLg) { lastLg = e.lg; var l = leagueOf(e.code); out += '<div class="mt-lgh">' + l.f + ' ' + esc(t(l.n)) + '</div>'; }
    out += row(e, i);
  });
  var st = el.scrollTop; el.innerHTML = out; el.scrollTop = st;
  reveal();
}
function reveal() {
  if (S.area !== 'list') return;
  var el = $('mtList'), r = el.querySelector('.mt-row.focus'); if (!r) return;
  var top = r.offsetTop - 60, bot = r.offsetTop + r.offsetHeight + 20;
  if (top < el.scrollTop) el.scrollTop = top; else if (bot > el.scrollTop + el.clientHeight) el.scrollTop = bot - el.clientHeight;
}
function build() {
  root = $('matches');
  root.innerHTML = '<div class="hdr"></div>' + O.brandBack(t('matches')) +
    '<div class="hbtn" data-go="home" style="left:1790px;margin-left:var(--X,0px)">' + O.ic.home + '</div>' +
    '<div class="pane lv-cats"></div><div class="lv-list mt-lgs" id="mtLg"></div>' +
    '<div class="mt-tabs" id="mtTabs" dir="rtl"></div><div class="mt-list" id="mtList" dir="rtl"></div>' +
    '<div class="mt-src">' + esc(t('mSrc')) + '</div>';
  root.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]'); if (g) { O.app.go(g.getAttribute('data-go')); return; }
    var c = e.target.closest('[data-ch]'); if (c) { var ev = S.view[+c.getAttribute('data-ch')]; if (ev) rowMenu(ev); return; }
    var l = e.target.closest('[data-l]'); if (l) { S.lg = +l.getAttribute('data-l'); S.li = 0; S.area = 'lg'; draw(); return; }
    var tb = e.target.closest('[data-t]'); if (tb) { S.tab = +tb.getAttribute('data-t'); S.li = 0; S.area = 'tabs'; draw(); return; }
    var r = e.target.closest('.mt-row'); if (r) { S.li = +r.getAttribute('data-i'); S.area = 'list'; draw(); watch(S.view[S.li]); }
  });
  built = true;
}
MA.show = function () {
  if (!built) build();
  shown = true; root.classList.remove('hidden');
  O.app.setParent('live', null);
  draw();
  if (!S.ev.length || Date.now() - S.ts > 60000) load(!!S.ev.length); else schedule();
};
MA.hide = function () { shown = false; clearTimeout(timer); if (root) root.classList.add('hidden'); };
MA.onKey = function (e, k) {
  var used = true, v = S.view || [];
  if (k === K.BACK || k === K.ESC) { O.app.go('home'); e.preventDefault(); return true; }
  if (S.area === 'lg') {
    if (k === K.UP) S.lg = Math.max(0, S.lg - 1); else if (k === K.DOWN) S.lg = Math.min(LEAGUES.length - 1, S.lg + 1);
    else if (k === K.RIGHT || k === K.ENTER) S.area = v.length ? 'list' : 'tabs';
    else used = false;
    S.li = k === K.UP || k === K.DOWN ? 0 : S.li;
  } else if (S.area === 'tabs') {
    if (k === K.RIGHT) S.tab = Math.max(0, S.tab - 1); else if (k === K.LEFT) S.tab = Math.min(TABS.length - 1, S.tab + 1);
    else if (k === K.DOWN || k === K.ENTER) { if (v.length) S.area = 'list'; }
    else used = false;
    if (k === K.LEFT || k === K.RIGHT) S.li = 0;
  } else {
    if (k === K.UP) { if (S.li > 0) S.li--; else S.area = 'tabs'; }
    else if (k === K.DOWN) S.li = Math.min(v.length - 1, S.li + 1);
    else if (k === K.LEFT) S.area = 'lg';
    else if (k === K.ENTER) { if (v[S.li]) watch(v[S.li]); }
    else if (k === K.MENU) { if (v[S.li]) rowMenu(v[S.li]); }
    else used = false;
  }
  if (used) { draw(); e.preventDefault(); }
  return used;
};
MA.relang = function () { built = false; };
/* only on phones for now (testing): not on TVs and not in the Windows app */
MA.enabled = function () { return !!(window.OssiNative && O.isTouch()); };
})();
