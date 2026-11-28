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
function offOf(txt) {   /* postponed / cancelled / suspended matches are not "finished" */
  txt = String(txt || '');
  return /postpon|cancel|delay/i.test(txt) ? 'post' : /suspend|abandon|interrupt/i.test(txt) ? 'susp' : '';
}
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
    out.push({ tvE: tv.slice(0, 4), tv: tv.slice(0, 4), id: code + ':' + e.id, eid: e.id, code: code, lg: leagueOf(code).id, t: Date.parse(e.date) || 0,
      state: ty.state === 'in' ? 'live' : ty.state === 'post' ? 'fin' : 'up', off: offOf(ty.name + ' ' + (ty.description || '')),
      clock: ty.shortDetail || st.displayClock || '', h: team(h), a: team(a), goals: goals,
      venue: (c.venue && (c.venue.fullName || (c.venue.address && c.venue.address.city))) || '' });
  });
  return out;
}
function espnUrl(code) {   /* the last part only stops any cache from giving an old answer */
  return 'https://site.api.espn.com/apis/site/v2/sports/soccer/' + code + '/scoreboard?dates=' + ymd(new Date()) + '&lang=ar&region=sa&_=' + Math.floor(Date.now() / 20000);
}
function load(quiet) {
  var tk = ++S.tok, codes = [], got = [], left;
  LEAGUES.forEach(function (l, i) { if (i) codes = codes.concat(srcOf(l)); });
  left = codes.length; S.err = false;
  if (!quiet) { S.loading = true; draw(); }
  var fails = 0;
  schedule();                                   /* the next refresh is planned even if this one fails */
  codes.forEach(function (code) {
    O.getJSON(espnUrl(code),
      function (d) { if (tk !== S.tok) return; got = got.concat(parse(code, d)); done(); },
      function () { if (tk !== S.tok) return; fails++; done(); }, 1, 20000);
  });
  function done() {
    if (--left > 0) return;
    S.loading = false;
    if (!got.length && fails === codes.length) { if (!S.ev.length) S.err = true; draw(); return; }
    S.ts = Date.now();
    got.sort(function (x, y) { return x.t - y.t; });
    S.ev = got;
    refresh();                                  /* the last known 365Scores state right away (no flicker) */
    sync365(); btrLoad();
    if (DET && DET.e.state !== 'up') det365(DET.e);
  }
}
function refresh() {
  apply365(); trMatch(); tvApply();
  if (DET) { var ne = S.ev.filter(function (x) { return x.id === DET.e.id; })[0]; if (ne) DET.e = ne; }
  if (shown) { draw(); if (DET) drawDet(); }
}
var refT = 0;
function refreshSoon() { clearTimeout(refT); refT = setTimeout(refresh, 250); }

/* ---------- 365Scores: the live state (more up to date than ESPN, e.g. for the Turkish league)
   and the channels (Arabic names). The day's list is used once to find each game; after that only
   the games still running are asked for, every minute (a few KB). ---------- */
var R365 = 'https://webws.365scores.com/web/';
var T365 = { ts: 0, day: '', busy: false, failAt: 0 }, GI = {}, MAP = {}, TVC = {}, PEND = {}, GOALS = {};
var CMP = { 'esp.1': 11, 'eng.1': 7, 'ger.1': 25, 'ita.1': 17, 'fra.1': 35, 'tur.1': 78 };
function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'; } catch (e) { return 'Europe/Berlin'; } }
/* lang 1 = English (to compare with ESPN's names), 27 = Arabic (channels, scorers); the region decides the channels */
function q365(lang) { return 'appTypeId=5&langId=' + lang + '&userCountryId=131&timezoneName=' + encodeURIComponent(tz()); }
function norm(n) {
  var x = String(n || ''); try { x = x.normalize('NFD').replace(/[̀-ًͯ-ٟ]/g, ''); } catch (e) {}
  return x.toLowerCase().replace(/ı/g, 'i').replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/(^|\s)ال/g, '$1')
    .replace(/\b(fc|cf|ac|sc|afc|ssc|as|club|de)\b/g, '').replace(/[^\w؀-ۿ]/g, '');
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
  var best = null, bs = 0, sw = false, cid = CMP[e.code];
  Object.keys(GI).forEach(function (k) {
    var g = GI[k];
    if (!g.homeCompetitor || !g.awayCompetitor) return;
    if (cid && g.competitionId !== cid) return;
    var gt = Date.parse(g.startTime) || 0; if (Math.abs(gt - e.t) > 20 * 60000) return;
    var s1 = tside(e.h, g.homeCompetitor) + tside(e.a, g.awayCompetitor), s2 = tside(e.h, g.awayCompetitor) + tside(e.a, g.homeCompetitor);
    var sc = Math.max(s1, s2) + (cid ? 0.3 : 0);
    if (sc > bs) { bs = sc; best = g; sw = s2 > s1; }   /* sw: 365 lists the teams the other way round */
  });
  return bs >= 0.9 ? { id: best.id, sw: sw, tv: best.hasTVNetworks !== false } : null;
}
function matchAll() {
  var changed = false;
  S.ev.forEach(function (e) {
    var m = MAP[e.id]; if (m && (m.id || m.none === T365.ts)) return;
    var r = match365(e); MAP[e.id] = r || { none: T365.ts }; if (r) changed = true;
  });
  if (changed) mapSave();
  return changed;
}
function mapSave() {
  var keep = {}; Object.keys(MAP).forEach(function (k) { if (MAP[k].id) keep[k] = MAP[k]; });
  O.store.gs('m365', { day: ymd(new Date()), map: keep });
}
(function () { var s = O.store.g('m365', null); if (s && s.day === ymd(new Date()) && s.map) MAP = s.map; })();
function sides(m, g) { return m.sw ? [g.awayCompetitor || {}, g.homeCompetitor || {}] : [g.homeCompetitor || {}, g.awayCompetitor || {}]; }
function sc(x) { return x && x.score >= 0 ? String(Math.round(x.score)) : ''; }
function apply365() {
  S.ev.forEach(function (e) {
    var m = MAP[e.id], g = m && m.id && GI[m.id]; if (!g) return;
    var hs = sides(m, g), sg = g.statusGroup, st = String(g.statusText || '') + ' ' + String(g.shortStatusText || '');
    if (sg === 3) { e.state = 'live'; e.off = ''; e.clock = /half ?time|\bHT\b/i.test(st) ? 'HT' : (g.gameTimeDisplay || g.shortStatusText || e.clock); }
    else if (sg === 4) { e.state = 'fin'; e.off = offOf(st); }
    else return;                                /* not started (or "final result only"): ESPN's view stays */
    if (sc(hs[0]) !== '' || e.off) { e.h.s = sc(hs[0]); e.a.s = sc(hs[1]); }
    var gl = GOALS[m.id];
    if (gl && gl.length >= e.goals.length) e.goals = gl.map(function (x) { return m.sw ? { side: x.side === 'h' ? 'a' : 'h', min: x.min, name: x.name, og: x.og, pen: x.pen } : x; });
  });
}
function sync365() {
  var today = ymd(new Date());
  var missing = S.ev.some(function (e) { return !MAP[e.id] || !MAP[e.id].id; });
  var listOld = T365.day !== today || (missing && Date.now() - T365.ts > 60 * 60000);
  if (missing && listOld && !T365.busy && Date.now() - T365.failAt > 5 * 60000) { full365(); return; }
  live365(tvDetails);
}
function full365() {
  T365.busy = true;
  var now = new Date(), d = ('0' + now.getDate()).slice(-2) + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + now.getFullYear(), day = ymd(now);
  O.httpJSON(R365 + 'games/allscores/?' + q365(1) + '&sports=1&startDate=' + d + '&endDate=' + d + '&showOdds=false', function (r) {
    T365.busy = false; T365.ts = Date.now(); T365.day = day;
    ((r && r.games) || []).forEach(function (g) { GI[g.id] = g; });
    matchAll(); refresh(); tvDetails();
  }, function () { T365.busy = false; T365.failAt = Date.now(); live365(); });
}
/* every minute: only the games that are running, about to start or just ended */
function live365(cb) {
  var ids = [], now = Date.now();
  S.ev.forEach(function (e) {
    var m = MAP[e.id]; if (!m || !m.id || ids.indexOf(m.id) > -1) return;
    var g = GI[m.id];
    if (e.t > now + 15 * 60000) return;
    if (g && g.statusGroup === 4 && !/just/i.test(g.statusText || '') && e.state === 'fin') return;
    ids.push(m.id);
  });
  if (!ids.length) { if (cb) cb(); return; }
  O.httpJSON(R365 + 'games/?' + q365(1) + '&games=' + ids.slice(0, 60).join(','), function (r) {
    ((r && r.games) || []).forEach(function (g) { var old = GI[g.id]; GI[g.id] = g; if (old && !g.homeCompetitor) GI[g.id] = old; });
    refreshSoon(); if (cb) cb();
  }, function () { if (cb) cb(); });
}
function tvDetails() {
  var todo = [];
  S.ev.forEach(function (e) {
    var m = MAP[e.id], id = m && m.id; if (!id) return;
    if (m.tv === false && !TVC[id]) TVC[id] = [];
    if (!TVC[id] && !PEND[id] && todo.indexOf(id) < 0) todo.push(id);
  });
  var run = 0;
  (function next() {
    while (run < 3 && todo.length) {
      var id = todo.shift(); run++; PEND[id] = 1;
      (function (id) {
        det365get(id, function () { run--; next(); });
      })(id);
    }
  })();
}
/* one game's own page: channels + goals (Arabic names) */
function det365get(id, cb) {
  O.httpJSON(R365 + 'game/?' + q365(27) + '&gameId=' + id, function (r) {
    delete PEND[id];
    var g = (r && r.game) || {}, n = [];
    (g.tvNetworks || []).forEach(function (x) { if (x && x.name && n.indexOf(x.name) < 0) n.push(x.name); });
    TVC[id] = n; if (n.length) tvcSave();
    var mem = {}, hid = g.homeCompetitor && g.homeCompetitor.id, gl = [];
    (g.members || []).forEach(function (x) { mem[x.id] = x.shortName || x.name; });
    (g.events || []).forEach(function (x) {
      var ty = x.eventType || {}; if (ty.id !== 1) return;          /* 1 = goal */
      var sub = String(ty.subTypeName || '');
      gl.push({ side: x.competitorId === hid ? 'h' : 'a', min: x.gameTimeDisplay || '', name: mem[x.playerId] || '',
        pen: /جزاء|penalt/i.test(sub), og: /عكس|ذاتي|مرما|own/i.test(sub) });
    });
    if (gl.length || (g.statusGroup === 3 || g.statusGroup === 4)) GOALS[id] = gl;
    refreshSoon(); if (cb) cb();
  }, function () { delete PEND[id]; if (cb) cb(); });
}
function tvcSave() {
  var keep = {}; Object.keys(TVC).forEach(function (k) { if (TVC[k] && TVC[k].length) keep[k] = TVC[k]; });
  O.store.gs('tv365', { day: ymd(new Date()), tv: keep });
}
(function () { var s = O.store.g('tv365', null); if (s && s.day === ymd(new Date()) && s.tv) Object.keys(s.tv).forEach(function (k) { TVC[k] = s.tv[k]; }); })();
function det365(e) { var m = MAP[e.id]; if (m && m.id && !PEND[m.id]) { PEND[m.id] = 1; det365get(m.id); } }

/* ---------- Turkish channels ----------
   1) beIN SPORTS Türkiye's own TV guide (one public page per channel: beIN SPORTS 1-4, HABER)
   2) Sporx "TV'de bugün – futbol": every Turkish channel in one list (S Sport, TRT Spor, beIN MAX, A Spor …),
      only the rows marked live ("Canlı").
   A match is on a channel when that channel's programme with the team names starts at kick-off. */
var BTR_CH = [['beinsports', 'beIN SPORTS 1'], ['beinsports-2', 'beIN SPORTS 2'], ['beinsports-3', 'beIN SPORTS 3'],
  ['beinsports-4', 'beIN SPORTS 4'], ['bein-sports-haber', 'beIN SPORTS HABER']];
var BTR = O.store.g('btr2', null) || { day: '', ts: 0, list: [] }, btrBusy = false, btrFail = 0, TRM = {};
function trNow() { return new Date(Date.now() + 3 * 3600000); }          /* Turkey = UTC+3 all year */
function trDay() { var d = trNow(); return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate(); }
/* one spelling per channel, whichever site it comes from */
function chName(n) {
  n = String(n || '').replace(/\s+/g, ' ').trim(); var m;
  if ((m = /^bein\s*sports?\s*(\d)/i.exec(n))) return 'beIN SPORTS ' + m[1];
  if ((m = /^bein\s*(?:sports?\s*)?max\s*(\d)/i.exec(n))) return 'beIN SPORTS MAX ' + m[1];
  if (/^bein\s*(?:sports?\s*)?haber/i.test(n)) return 'beIN SPORTS HABER';
  return n;
}
function untag(x) {
  return String(x || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function sxParse(html) {
  var d = trNow(), y = d.getUTCFullYear(), mo = d.getUTCMonth(), da = d.getUTCDate(), out = [], prevH = -1, add = 0;
  String(html || '').split(/<tr[\s>]/i).forEach(function (row) {
    var tm = /class="ch-time"[^>]*>\s*(\d{1,2}):(\d{2})/.exec(row); if (!tm) return;
    var hh = +tm[1];
    if (prevH > -1 && hh < prevH - 6) add = 1;       /* the list runs past midnight */
    prevH = hh;
    var ch = /class="ch-name"[^>]*>([^<]+)/.exec(row), tx = /class="ch-text"[^>]*>([\s\S]*?)<\/span>/.exec(row);
    if (!ch || !tx || !/<span class="ch-type">\s*Canl/i.test(row)) return;
    var text = untag(tx[1]); if (!/\(Futbol\)/i.test(text)) return;
    text = text.replace(/\([^)]*\)/g, '').trim();
    if (/ - /.test(text)) out.push([chName(untag(ch[1])), Date.UTC(y, mo, da + add, hh - 3, +tm[2]), text]);
  });
  return out;
}
function btrLoad() {
  if (btrBusy || Date.now() - btrFail < 10 * 60000) return;
  if (BTR.day === trDay() && Date.now() - BTR.ts < 2 * 3600000) return;
  btrBusy = true;
  var left = BTR_CH.length + 1, list = [], ok = 0;
  BTR_CH.forEach(function (c) {
    O.httpGet('https://www.beinsports.com.tr/yayin-akisi/' + c[0], function (html) {
      try {
        var m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
        var L = JSON.parse(m[1]).props.pageProps.data.listTvGuides || [];
        L.forEach(function (x) {
          if (!/ - /.test(x.name || '')) return;
          var dm = /(\d+)\/(\d+)\/(\d{4})/.exec(x.event_date || ''), tm = /(\d+):(\d+)/.exec(x.event_time || '');
          if (dm && tm) list.push([c[1], Date.UTC(+dm[3], +dm[1] - 1, +dm[2], +tm[1] - 3, +tm[2]), x.name]);
        });
        ok++;
      } catch (e) {}
      fin();
    }, fin);
  });
  O.httpGet('https://www.sporx.com/tvde-bugun-futbol', function (html) {
    var L = []; try { L = sxParse(html); } catch (e) {}
    if (L.length) { list = list.concat(L); ok++; }
    fin();
  }, fin);
  function fin() {
    if (--left > 0) return;
    btrBusy = false;
    if (ok) { BTR = { day: trDay(), ts: Date.now(), list: list }; O.store.gs('btr2', BTR); } else btrFail = Date.now();
    refreshSoon();
  }
}
function trMatch() {
  TRM = {};
  function s(tm, n) { return Math.max(sim(tm.n, n), sim(tm.full, n)); }
  S.ev.forEach(function (e) {
    var out = [];
    (BTR.list || []).forEach(function (x) {
      var dt = x[1] - e.t; if (dt < -40 * 60000 || dt > 10 * 60000) return;
      var p = String(x[2]).split(' - '); if (p.length !== 2) return;
      var a1 = s(e.h, p[0]), b1 = s(e.a, p[1]), a2 = s(e.h, p[1]), b2 = s(e.a, p[0]);
      var ok = (a1 + b1 >= 0.9 && Math.max(a1, b1) >= 0.8) || (a2 + b2 >= 0.9 && Math.max(a2, b2) >= 0.8);
      var c = chName(x[0]);
      if (ok && out.indexOf(c) < 0) out.push(c);
    });
    if (out.length) TRM[e.id] = out;
  });
}
function tvApply() {
  S.ev.forEach(function (e) {
    var m = MAP[e.id], ar = (m && m.id && TVC[m.id]) || [];
    var out = (ar.length ? ar : (e.tvE || [])).slice();
    (TRM[e.id] || []).forEach(function (n) { n = '🇹🇷 ' + n; if (out.indexOf(n) < 0) out.push(n); });
    e.tv = out;
  });
}
MA._tv = { sxParse: sxParse, chName: chName, sim: sim, match: match365, GI: GI, MAP: function () { return MAP; }, TVC: TVC, TRM: function () { return TRM; }, BTR: function () { return BTR; } };

function schedule() {
  clearTimeout(timer);
  if (!shown) return;
  timer = setTimeout(function () { if (shown) load(true); }, 60000);   /* every minute while the screen is open */
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
  else {
    var m = MAP[e.id];
    AL[e.id] = { code: e.code, eid: e.eid, h: e.h.n, a: e.a.n, hs: e.h.s, as: e.a.s, t: e.t, state: e.state, g: (m && m.id) || 0, sw: !!(m && m.sw) };
    O.toast(t('mAlertOn'));
  }
  alSave(); alLoop();
}
function banner(txt) {
  var b = $('mtAlert');
  if (!b) { b = document.createElement('div'); b.id = 'mtAlert'; $('stage').appendChild(b); }
  b.innerHTML = txt; b.classList.add('show');
  clearTimeout(bannerT); bannerT = setTimeout(function () { b.classList.remove('show'); }, 3000);
}
/* home team on the right, its score next to it (as in the list) */
function alLine(h, a, hs, as) {
  return '<div class="ma-l" dir="rtl"><bdi>' + esc(h) + '</bdi><span dir="ltr">' + esc(as) + ' - ' + esc(hs) + '</span><bdi>' + esc(a) + '</bdi></div>';
}
function alStep(id, x) {
  var a = AL[id]; if (!a) return;
  if (x.state === 'up') { a.state = 'up'; alSave(); return; }
  var line = alLine(a.h, a.a, x.hs, x.as), now = (+x.hs || 0) + (+x.as || 0), before = (+a.hs || 0) + (+a.as || 0);
  if (x.state === 'fin') { banner('🏁 ' + esc(t('mEnded')) + line); delete AL[id]; alSave(); return; }
  if (a.state !== 'live' && now === 0) banner('⚽ ' + esc(t('mKick')) + line);
  else if (now > before) banner('⚽ ' + esc(t('mGoal')) + ' <bdi dir="ltr">' + esc(x.clock || '') + '</bdi>' + line);
  a.hs = x.hs; a.as = x.as; a.state = x.state; alSave();
}
function alCheck() {
  var watching = O.pui && O.pui.active && O.pui.kind === 'live';
  var ids = Object.keys(AL); if (!ids.length || !watching) return;
  var by = {}, codes = {};
  ids.forEach(function (id) { var a = AL[id]; if (a.g) by[a.g] = id; else codes[a.code] = 1; });
  var gids = Object.keys(by);
  if (gids.length) O.httpJSON(R365 + 'games/?' + q365(1) + '&games=' + gids.join(','), function (r) {
    ((r && r.games) || []).forEach(function (g) {
      var id = by[g.id], a = AL[id]; if (!a) return;
      var hs = sides(a, g), sg = g.statusGroup;
      alStep(id, { state: sg === 3 ? 'live' : sg === 4 ? 'fin' : 'up', hs: sc(hs[0]), as: sc(hs[1]), clock: g.gameTimeDisplay || '' });
    });
  });
  Object.keys(codes).forEach(function (code) {
    O.getJSON(espnUrl(code), function (d) {
      parse(code, d).forEach(function (e) { if (AL[e.id] && !AL[e.id].g) alStep(e.id, { state: e.state, hs: e.h.s, as: e.a.s, clock: e.clock }); });
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
  if (e.state !== 'up') det365(e);             /* scorers (and channels) fresh from 365Scores */
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
  if (e.off) mid = '<b class="md-time">' + O.fmtHM(e.t) + '</b><span class="mt-fin">' + esc(t(e.off === 'post' ? 'mPostp' : 'mSusp')) + '</span>';
  else if (e.state === 'up') mid = '<b class="md-time">' + O.fmtHM(e.t) + '</b><span class="mt-up">' + esc(t('mToday')) + '</span>';
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
  if (e.off) { mid = '<b class="mt-time">' + hm(e.t) + '</b>'; st = '<span class="mt-fin">' + esc(t(e.off === 'post' ? 'mPostp' : 'mSusp')) + '</span>'; }
  else if (e.state === 'up') { mid = '<b class="mt-time">' + hm(e.t) + '</b>'; st = '<span class="mt-up">' + esc(t('mToday')) + '</span>'; }
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
  $('mtSrc').innerHTML = '<span>' + esc(t('mSrc')) + '</span>' + (S.ts ? '<span class="mt-upd">' + esc(t('mUpdAt')) + ' <b dir="ltr">' + O.fmtHM(S.ts) + '</b></span>' : '');
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
    '<div class="mt-src" id="mtSrc" dir="rtl"></div><div id="mtDet" class="hidden"></div>';
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
  load(!!S.ev.length);                         /* fresh results on every visit, then every minute */
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
MA.resume = function () { if (shown && !document.hidden) load(true); };   /* back in the app: refresh at once */
document.addEventListener('visibilitychange', function () { if (!document.hidden) MA.resume(); });
/* phone, Fire TV and the Windows app */
MA.enabled = function () { return true; };
})();
