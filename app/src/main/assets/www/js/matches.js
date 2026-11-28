/* Matches: today's football results (live / finished / upcoming) for the chosen leagues.
   Data: ESPN's public scoreboard (no account). OK on a match plays the channel linked to its league. */
(function () {
'use strict';
var O = window.O, $ = O.$, esc = O.esc, t = O.t, K = O.K, M = O.modal;

/* leagues shown in the left column; "nat" = national teams (several ESPN competitions) */
var LEAGUES = [
  { id: 'all', n: 'mAll', f: '⚽' },
  { id: 'esp.1', n: 'lgEsp', f: '🇪🇸' },
  { id: 'eng.1', n: 'lgEng', f: '<svg class="flg" viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/><rect x="12.5" width="5" height="20" fill="#ce1124"/><rect y="7.5" width="30" height="5" fill="#ce1124"/></svg>' },
  { id: 'ger.1', n: 'lgGer', f: '🇩🇪' },
  { id: 'ita.1', n: 'lgIta', f: '🇮🇹' },
  { id: 'fra.1', n: 'lgFra', f: '🇫🇷' },
  { id: 'tur.1', n: 'lgTur', f: '🇹🇷' },
  { id: 'nat', n: 'lgNat', f: '🌍', src: ['fifa.world', 'fifa.worldq.uefa', 'fifa.worldq.afc', 'fifa.worldq.caf', 'uefa.nations', 'uefa.euro', 'fifa.friendly', 'caf.nations', 'afc.asian.cup'] }
];
var TABS = ['live', 'up', 'fin'];   /* on screen from left to right */
var S = { lg: 0, tab: 0, area: 'lg', li: 0, ev: [], loading: false, err: false, tok: 0, ts: 0 };
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
    function team(x) { var tm = x.team || {}; return { ab: tm.abbreviation || '', full: tm.displayName || '', n: tm.shortDisplayName || tm.displayName || tm.name || '?', logo: tm.logo || (tm.logos && tm.logos[0] && tm.logos[0].href) || '', s: x.score != null ? String(x.score) : '' }; }
    var hid = h.team && h.team.id, goals = [];
    (c.details || []).forEach(function (g) {
      if (!g.scoringPlay) return;
      var who = (g.athletesInvolved || [])[0] || {}, tp = (g.type && g.type.text) || '';
      goals.push({ side: g.team && String(g.team.id) === String(hid) ? 'h' : 'a', min: (g.clock && g.clock.displayValue) || '',
        name: who.shortName || who.displayName || '', og: /own/i.test(tp), pen: /pen/i.test(tp) });
    });
    var tv = [];
    (c.geoBroadcasts || []).forEach(function (g) { var n = g.media && (g.media.shortName || g.media.name); if (n && tv.indexOf(n) < 0) tv.push(n); });
    (c.broadcasts || []).forEach(function (b) { (b.names || []).forEach(function (n) { if (n && tv.indexOf(n) < 0) tv.push(n); }); });
    out.push({ tv: tv.slice(0, 4), id: code + ':' + e.id, eid: e.id, code: code, lg: leagueOf(code).id, t: Date.parse(e.date) || 0,
      state: ty.state === 'in' ? 'live' : ty.state === 'post' ? 'fin' : 'up',
      clock: ty.shortDetail || st.displayClock || '', h: team(h), a: team(a), goals: goals,
      venue: (c.venue && (c.venue.fullName || (c.venue.address && c.venue.address.city))) || '' });
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
    S.ev = got; tvApply();
    draw(); schedule(); tv365();
  }
}
/* ---------- which channels show the match: from 365Scores (Arabic channel names) ----------
   The day's list gives the games; the channels are only in each game's own page, so those are
   fetched one by one (and kept: they do not change). */
var T365 = { ts: 0, games: [], busy: false }, TVC = {}, MAP = {}, PEND = {}, tvDrawT = 0;
var Q365 = 'appTypeId=5&userCountryId=131&timezoneName=';   /* list in English (to match ESPN's names), channels in Arabic */
var CMP = { 'esp.1': 11, 'eng.1': 7, 'ger.1': 25, 'ita.1': 17, 'fra.1': 35, 'tur.1': 78 };
function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'; } catch (e) { return 'Europe/Berlin'; } }
function norm(n) {
  var x = String(n || ''); try { x = x.normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f]/g, ''); } catch (e) {}
  return x.toLowerCase().replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/(^|\s)ال/g, '$1')
    .replace(/\b(fc|cf|ac|sc|afc|ssc|as|club|de|ال)\b/g, '').replace(/[^\w\u0600-\u06ff]/g, '');
}
function sim(a, b) {
  a = norm(a); b = norm(b); if (!a || !b) return 0;
  if (a === b || a.indexOf(b) > -1 || b.indexOf(a) > -1) return 1;
  var g = {}, n = 0, hit = 0, i;
  for (i = 0; i < a.length - 1; i++) { g[a.substr(i, 2)] = (g[a.substr(i, 2)] || 0) + 1; n++; }
  for (i = 0; i < b.length - 1; i++) { var k = b.substr(i, 2); if (g[k]) { g[k]--; hit++; } }
  return n ? 2 * hit / (n + b.length - 1) : 0;
}
function tside(tm, c) {
  var s = Math.max(sim(tm.n, c.name), sim(tm.full, c.name), sim(tm.n, c.shortName || ''));
  if (tm.ab && c.symbolicName && tm.ab.toUpperCase() === String(c.symbolicName).toUpperCase()) s += 0.6;
  return s;
}
function match365(e) {
  var best = null, bs = 0, cid = CMP[e.code];
  T365.games.forEach(function (g) {
    if (!g.homeCompetitor || !g.awayCompetitor) return;
    var gt = Date.parse(g.startTime) || 0; if (Math.abs(gt - e.t) > 20 * 60000) return;
    var sc = tside(e.h, g.homeCompetitor) + tside(e.a, g.awayCompetitor);
    if (cid) { if (g.competitionId !== cid) return; sc += 0.3; }
    if (sc > bs) { bs = sc; best = g; }
  });
  return bs >= 0.9 ? best : null;
}
function tvApply() {
  S.ev.forEach(function (e) { var g = MAP[e.id]; if (g && TVC[g] && TVC[g].length) e.tv = TVC[g].slice(0, 4); });
}
function tvRedraw() {
  clearTimeout(tvDrawT);
  tvDrawT = setTimeout(function () { tvApply(); if (shown) { draw(); if (DET) drawDet(); } }, 300);
}
function tv365() {
  if (T365.busy) return;
  var now = new Date();
  if (T365.games.length && Date.now() - T365.ts < 30 * 60000) { tvDetails(); return; }
  T365.busy = true;
  var d = ('0' + now.getDate()).slice(-2) + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + now.getFullYear();
  O.httpJSON('https://webws.365scores.com/web/games/allscores/?' + Q365 + encodeURIComponent(tz()) +
    '&sports=1&startDate=' + d + '&endDate=' + d + '&showOdds=false', function (r) {
    T365.busy = false; T365.ts = Date.now(); T365.games = (r && r.games) || []; tvDetails();
  }, function () { T365.busy = false; });
}
function tvDetails() {
  var todo = [];
  S.ev.forEach(function (e) {
    if (MAP[e.id] == null) { var g = match365(e); MAP[e.id] = g ? g.id : 0; if (g && !g.hasTVNetworks) TVC[g.id] = TVC[g.id] || []; }
    var id = MAP[e.id];
    if (id && !TVC[id] && !PEND[id] && todo.indexOf(id) < 0) todo.push(id);
  });
  tvApply();
  var run = 0;
  (function next() {
    while (run < 3 && todo.length) {
      var id = todo.shift(); run++;
      PEND[id] = 1;
      (function (id) {
        O.httpJSON('https://webws.365scores.com/web/game/?' + Q365 + encodeURIComponent(tz()) + '&gameId=' + id, function (r) {
          var n = [];
          (((r && r.game) || {}).tvNetworks || []).forEach(function (x) { if (x && x.name && n.indexOf(x.name) < 0) n.push(x.name); });
          delete PEND[id]; TVC[id] = n; run--; if (n.length) tvRedraw(); next();
        }, function () { delete PEND[id]; run--; next(); });
      })(id);
    }
  })();
}
MA._tv = { sim: sim, match: match365, T: T365, MAP: MAP, TVC: TVC };

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

/* ---------- watching: pick one of the sport packages, the TV section opens on it ---------- */
function watch(e) {
  O.live.sportCats(function (cats) {
    if (!cats.length) { O.toast(t('mNoSport')); O.app.setParent('live', 'matches'); O.app.go('live'); return; }
    M.list(t('mPickPkg'), function () {
      return cats.map(function (c) { return { label: c.name, onOk: function () {
        M.closeAll(); closeDet(); O.app.setParent('live', 'matches'); O.app.go('live', { cat: c.id });
      } }; });
    }, { light: true });
  });
}

/* ---------- score alerts (only shown while a TV channel is playing) ---------- */
var AL = O.store.g('malerts', {}), alT = 0, bannerT = 0;
function alSave() { O.store.gs('malerts', AL); }
function alOn(e) { return !!AL[e.id]; }
function alToggle(e) {
  if (AL[e.id]) { delete AL[e.id]; O.toast(t('mAlertOff')); }
  else { AL[e.id] = { code: e.code, eid: e.eid, h: e.h.n, a: e.a.n, hs: e.h.s, as: e.a.s, t: e.t }; O.toast(t('mAlertOn')); }
  alSave(); alLoop();
}
function banner(txt) {
  var b = $('mtAlert');
  if (!b) { b = document.createElement('div'); b.id = 'mtAlert'; $('stage').appendChild(b); }
  b.innerHTML = txt; b.classList.add('show');
  clearTimeout(bannerT); bannerT = setTimeout(function () { b.classList.remove('show'); }, 3000);
}
function alCheck() {
  var watching = O.pui && O.pui.active && O.pui.kind === 'live';
  var ids = Object.keys(AL); if (!ids.length || !watching) return;
  var codes = {}; ids.forEach(function (id) { codes[AL[id].code] = 1; });
  var day = ymd(new Date());
  Object.keys(codes).forEach(function (code) {
    O.getJSON('https://site.api.espn.com/apis/site/v2/sports/soccer/' + code + '/scoreboard?dates=' + day + '&lang=ar&region=sa', function (d) {
      parse(code, d).forEach(function (e) {
        var a = AL[e.id]; if (!a) return;
        var line = '<b>' + esc(e.h.n) + '</b><span dir="ltr">' + esc(e.h.s) + ' - ' + esc(e.a.s) + '</span><b>' + esc(e.a.n) + '</b>';
        if (e.state === 'live' && a.state !== 'live' && !a.hs) banner('⚽ ' + esc(t('mKick')) + '<br>' + line);
        else if (e.h.s !== a.hs || e.a.s !== a.as) banner('⚽ ' + esc(t('mGoal')) + ' ' + esc(e.clock) + '<br>' + line);
        if (e.state === 'fin') { banner('🏁 ' + esc(t('mEnded')) + '<br>' + line); delete AL[e.id]; }
        else { a.hs = e.h.s; a.as = e.a.s; a.state = e.state; }
        alSave();
      });
    }, function () {}, 0);
  });
}
function alLoop() {
  clearInterval(alT);
  /* old subscriptions (more than 6 hours past kick-off) are dropped */
  Object.keys(AL).forEach(function (id) { if (Date.now() - (AL[id].t || 0) > 6 * 3600000) delete AL[id]; });
  if (Object.keys(AL).length) alT = setInterval(alCheck, 60000);
}
alLoop();
MA._alCheck = alCheck;

/* ---------- match window ---------- */
var DET = null;
function openDet(e) {
  DET = { e: e, b: 0 };
  var el = $('mtDet'); el.classList.remove('hidden'); drawDet();
}
function closeDet() { DET = null; var el = $('mtDet'); if (el) { el.classList.add('hidden'); el.innerHTML = ''; } }
function detBtns() {
  var e = DET.e, b = [{ id: 'watch', l: '📺 ' + t('mWatch') }];
  if (e.state !== 'fin') b.push({ id: 'alert', l: (alOn(e) ? '🔕 ' + t('mAlertStop') : '🔔 ' + t('mAlertStart')) });
  b.push({ id: 'close', l: t('close') });
  return b;
}
function drawDet() {
  if (!DET) return;
  var e = DET.e, l = leagueOf(e.code), mid;
  if (e.state === 'up') mid = '<b class="md-time">' + O.fmtHM(e.t) + '</b><span class="mt-up">' + esc(t('mToday')) + '</span>';
  else mid = '<b class="md-sc"><span dir="ltr">' + esc(e.a.s) + ' - ' + esc(e.h.s) + '</span></b>' +
    (e.state === 'live' ? '<span class="mt-live">● ' + esc(t('mLive')) + ' ' + esc(e.clock) + '</span>' : '<span class="mt-fin">' + esc(t('mEnded')) + '</span>');
  function goals(side) {
    return e.goals.filter(function (g) { return g.side === side; }).map(function (g) {
      return '<div>⚽ ' + esc(g.name) + ' <i>' + esc(g.min) + (g.pen ? ' (P)' : '') + (g.og ? ' (OG)' : '') + '</i></div>';
    }).join('');
  }
  var h = '<div class="md-box" dir="rtl"><div class="md-lg">' + l.f + ' ' + esc(t(l.n)) + '</div>' +
    '<div class="md-teams"><div class="md-t">' + logo(e.h) + '<b dir="auto">' + esc(e.h.n) + '</b><div class="md-g">' + goals('h') + '</div></div>' +
    '<div class="md-mid">' + mid + '</div>' +
    '<div class="md-t">' + logo(e.a) + '<b dir="auto">' + esc(e.a.n) + '</b><div class="md-g">' + goals('a') + '</div></div></div>' +
    '<div class="md-info">🕐 ' + O.fmtHM(e.t) + (e.venue ? '   •   🏟 ' + esc(e.venue) : '') + '</div>' +
    (e.tv.length ? '<div class="md-tv">📺 ' + esc(t('mOnTv')) + ': <b>' + esc(e.tv.join('  •  ')) + '</b></div>' : '') + '<div class="md-btns">';
  detBtns().forEach(function (x, i) { h += '<b class="md-b' + (i === DET.b ? ' focus' : '') + '" data-b="' + i + '">' + esc(x.l) + '</b>'; });
  $('mtDet').innerHTML = h + '</div></div>';
}
function detAct(i) {
  var x = detBtns()[i]; if (!x) return;
  if (x.id === 'watch') watch(DET.e);
  else if (x.id === 'alert') { alToggle(DET.e); drawDet(); draw(); }
  else closeDet();
}

/* ---------- drawing ---------- */
function ini(n) { return esc(String(n || '?').replace(/[^\w؀-ۿ]/g, '').slice(0, 2).toUpperCase()); }
function logo(tm) {
  return '<span class="mt-lg"><i>' + ini(tm.n) + '</i>' + (tm.logo ? '<img src="' + esc(tm.logo) + '" decoding="async" loading="lazy" onerror="this.remove()">' : '') + '</span>';
}
function hm(ms) { return O.fmtHM(ms); }
function row(e, i) {
  var mid, st;
  if (e.state === 'up') { mid = '<b class="mt-time">' + hm(e.t) + '</b>'; st = '<span class="mt-up">' + esc(t('mToday')) + '</span>'; }
  else {
    mid = '<b class="mt-sc"><span dir="ltr">' + esc(e.a.s) + ' - ' + esc(e.h.s) + '</span></b>';
    st = e.state === 'live' ? '<span class="mt-live">● ' + esc(t('mLive')) + ' ' + esc(e.clock) + '</span>' : '<span class="mt-fin">' + esc(t('mEnded')) + '</span>';
  }
  return '<div class="mt-row' + (S.area === 'list' && i === S.li ? ' focus' : '') + '" data-i="' + i + '">' +
    '<div class="mt-t mt-h"><span class="mt-n" dir="auto">' + esc(e.h.n) + '</span>' + logo(e.h) + '</div>' + mid +
    '<div class="mt-t mt-a">' + logo(e.a) + '<span class="mt-n" dir="auto">' + esc(e.a.n) + '</span></div>' +
    '<div class="mt-meta">' + st + (e.tv.length ? '<span class="mt-ch">📺 ' + esc(e.tv.join(' • ')) + '</span>' : '') + (alOn(e) ? '<span class="mt-bell">🔔</span>' : '') + '</div></div>';
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
    '<div class="mt-tabs" id="mtTabs" dir="ltr"></div><div class="mt-list" id="mtList" dir="rtl"></div>' +
    '<div class="mt-src">' + esc(t('mSrc')) + '</div><div id="mtDet" class="hidden"></div>';
  root.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]'); if (g) { O.app.go(g.getAttribute('data-go')); return; }
    var db = e.target.closest('.md-b'); if (db) { DET.b = +db.getAttribute('data-b'); detAct(DET.b); return; }
    if (DET) { if (!e.target.closest('.md-box')) closeDet(); return; }
    var l = e.target.closest('[data-l]'); if (l) { S.lg = +l.getAttribute('data-l'); S.li = 0; S.area = 'lg'; draw(); return; }
    var tb = e.target.closest('[data-t]'); if (tb) { S.tab = +tb.getAttribute('data-t'); S.li = 0; S.area = 'tabs'; draw(); return; }
    var r = e.target.closest('.mt-row'); if (r) { S.li = +r.getAttribute('data-i'); S.area = 'list'; draw(); openDet(S.view[S.li]); }
  });
  built = true;
}
MA.show = function () {
  if (!built) build();
  shown = true; root.classList.remove('hidden');
  S.area = 'lg'; S.tab = 0; S.li = 0;          /* opens on the leagues, showing the live games */
  O.app.setParent('live', null);
  draw();
  if (!S.ev.length || Date.now() - S.ts > 60000) load(!!S.ev.length); else schedule();
};
MA.hide = function () { shown = false; clearTimeout(timer); closeDet(); if (root) root.classList.add('hidden'); };
MA.onKey = function (e, k) {
  var used = true, v = S.view || [];
  if (DET) {
    var n = detBtns().length;
    if (k === K.BACK || k === K.ESC) closeDet();
    else if (k === K.LEFT) DET.b = Math.min(n - 1, DET.b + 1); else if (k === K.RIGHT) DET.b = Math.max(0, DET.b - 1);
    else if (k === K.ENTER) { detAct(DET.b); e.preventDefault(); return true; }
    drawDet(); e.preventDefault(); return true;
  }
  if (k === K.BACK || k === K.ESC) { O.app.go('home'); e.preventDefault(); return true; }
  if (S.area === 'lg') {
    if (k === K.UP) S.lg = Math.max(0, S.lg - 1); else if (k === K.DOWN) S.lg = Math.min(LEAGUES.length - 1, S.lg + 1);
    else if (k === K.RIGHT) { S.area = 'tabs'; }   /* → the tabs (left-most: live) */
    else if (k === K.ENTER) S.area = v.length ? 'list' : 'tabs';
    else used = false;
    S.li = k === K.UP || k === K.DOWN ? 0 : S.li;
  } else if (S.area === 'tabs') {
    if (k === K.RIGHT) S.tab = Math.min(TABS.length - 1, S.tab + 1);
    else if (k === K.LEFT) { if (S.tab > 0) S.tab--; else S.area = 'lg'; }
    else if (k === K.DOWN || k === K.ENTER) { if (v.length) S.area = 'list'; }
    else used = false;
    if (k === K.LEFT || k === K.RIGHT) S.li = 0;
  } else {
    if (k === K.UP) { if (S.li > 0) S.li--; else S.area = 'tabs'; }
    else if (k === K.DOWN) S.li = Math.min(v.length - 1, S.li + 1);
    else if (k === K.LEFT) S.area = 'lg';
    else if (k === K.ENTER || k === K.MENU) { if (v[S.li]) openDet(v[S.li]); }
    else used = false;
  }
  if (used) { draw(); e.preventDefault(); }
  return used;
};
MA.relang = function () { built = false; };
/* phone, Fire TV and the Windows app */
MA.enabled = function () { return true; };
})();
