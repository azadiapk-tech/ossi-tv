/* Radio: Kurdish internet radios (Radio Browser + pinned stations, taken over from the "Ossi FM" TV app).
   Same 3-column layout as Live TV; the preview shows a spinning record with 🎶 and the station name.
   Sound only while this section is open: leaving it (or hiding the app) stops the radio. */
(function () {
'use strict';
var O = window.O, $ = O.$, esc = O.esc, t = O.t, K = O.K;

/* ---------- sources ---------- */
var QUERIES = ['language=kurdish', 'language=sorani', 'language=kurmanji',
  'tag=kurdish', 'tag=kurdi', 'tag=kurmanji', 'tag=sorani', 'name=kurd'];
var RB = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://fi1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info', 'https://all.api.radio-browser.info'];
var MAX = 150;
function GS(d) { return 'https://www.google.com/s2/favicons?domain=' + d + '&sz=128'; }
function RG(id) { return 'https://radio.garden/api/ara/content/listen/' + id + '/channel.mp3'; }
var ARTA = { id: 'ossi-arta-fm', name: 'ARTA FM', url: 'http://edge.mixlr.com/channel/qtgru', alts: [], cc: 'SY', country: 'Syria', codec: 'MP3', br: 0, logos: [], color: '#8a2be2' };
/* pinned stations: several candidate stream URLs are tried one after another until one plays */
var PINNED = [
  { key: 'rudaw', name: 'Rudaw Radio', match: /rudaw/i, not: /\btv\b|television/i, search: 'rudaw', cc: 'IQ', extra: [RG('BSZLTEWg')], logos: [GS('rudaw.net')], color: '#20a9df', rg: true },
  { key: 'waar', name: 'Waar FM', match: /waar/i, not: /\btv\b|television/i, search: 'waar', cc: 'IQ', extra: [], logos: ['https://static2.mytuner.mobi/media/tvos_radios/962/waaradio.bdb14ece.png', GS('waarmedia.com')], color: '#e4a52e', rg: true },
  { key: 'trt-kurdi', name: 'TRT Radyo Kurdî', match: /trt.*(radyo|radio).*kurd|kurd.*trt/i, search: 'TRT Radyo Kurdi', cc: 'TR', extra: ['https://radio-trtradyo6.medya.trt.com.tr/master.m3u8'], logos: [], color: '#d92735' },
  { key: 'duhok', name: 'Radio Duhok', match: /duhok|dohuk|dihok/i, not: /\btv\b|television/i, search: 'duhok', cc: 'IQ', extra: [RG('blqTOwxX')],
    logos: ['https://images.zeno.fm/CeyDDAuv3tT9wNBRLfbaFwtx_J4gT6ydg8ZpJ28ez5U/rs:fill:152:152/q:75/g:ce:0:0/aHR0cHM6Ly9wcm94eS56ZW5vLmZtL2NvbnRlbnQvc3RhdGlvbnMvN2RjMDQyOTUtZmFjOC00OWQ0LWI2OTUtZGMyZTU2MWFmYTllL2ltYWdlLz91PTE3NjEzODY4OTEwMDA', GS('radioduhok.com')], color: '#2477bd', rg: true },
  { key: 'welat', name: 'Welat FM', match: /welat/i, search: 'welat', extra: [], color: '#1f8a5b',
    logos: ['https://images.zeno.fm/pT1pER1x1akdTDd2aVVdfXesbd32MCqmBZKiRUbOB_M/rs:fill:152:152/q:75/g:ce:0:0/aHR0cHM6Ly9wcm94eS56ZW5vLmZtL2NvbnRlbnQvc3RhdGlvbnMvYWd4emZucGxibTh0YzNSaGRITnlNZ3NTQ2tGMWRHaERiR2xsYm5RWWdJQ1FxWXF4aFFvTUN4SU9VM1JoZEdsdmJsQnliMlpwYkdVWWdJQ1E4YnJmeHdvTW9nRUVlbVZ1YncvaW1hZ2UvP3U9MTc0MDM2MjIwNjAwMA'] },
  { key: 'dawat', name: 'Dawat FM', match: /dawat/i, search: 'dawat', extra: [], logos: [], color: '#b5651d' },
  { key: 'tav', name: 'Tav Music Radio', match: /tav\s*music/i, search: 'tav music', extra: [], logos: [], color: '#c2185b' },
  { key: 'kurdsat', name: 'Dengi Kurdsat', match: /deng[ie]?\s*kurd\s*sat/i, search: 'kurdsat', extra: [], logos: [], color: '#00897b' },
  { key: 'zakaria', name: 'Zakaria Abdulla', match: /zakaria\s*abd/i, search: 'zakaria', extra: [], logos: [], color: '#6d4c41' },
  { key: 'ahmetkaya', name: 'Ahmet Kaya', match: /ahmet\s*kaya/i, search: 'ahmet kaya', extra: [], logos: [], color: '#455a64' },
  { key: 'bilind', name: 'Bilind Ibrahim', match: /bilind\s*ibrahim/i, search: 'bilind', extra: [], logos: [], color: '#7b1fa2' },
  { key: 'aysesan', name: 'Ayse San', match: /ay[sş]e\s*[sş]an/i, search: 'ayse san', extra: [], logos: [], color: '#d84315' },
  { key: 'ciwan', name: 'Ciwan Haco', match: /ciwan\s*haco/i, search: 'ciwan haco', extra: [], logos: [], color: '#283593' },
  { key: 'gundi', name: 'Gundi FM', match: /gundi\s*fm/i, search: 'gundi', extra: [], logos: [], color: '#2e7d32' },
  { key: 'rebaz', name: 'Rebaz FM', match: /rebaz/i, search: 'rebaz', extra: [], logos: [], color: '#ad1457' }
];
function norm(x) {
  x = String(x || '').toLowerCase().replace(/ı/g, 'i');
  try { x = x.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
  return x.replace(/[^a-z0-9؀-ۿ]+/g, ' ').replace(/^ +| +$/g, '');
}
/* stations that were removed on purpose in Ossi FM */
var BLOCKED = [/(radio|radyo)\s*firat/, /firat\s*fm/, /zergan/, /(gavas|gevas|gawas)\s*ses/, /\bfpp\b/, /frequence\s*paris/, /\bafro\b/, /(radio|radyo)\s*mori/, /sarikamis/, /bayazit/, /\bradio\s*13\b/];
function blocked(name) { var n = norm(name); return BLOCKED.some(function (r) { return r.test(n); }); }
function pinMatch(p, name) { name = String(name || ''); return p.match.test(name) && !(p.not && p.not.test(name)); }
function isHls(u) { return /\.m3u8(\?|$)/i.test(u || ''); }

var CC = {
  IQ: ['العراق | كردستان', 'Iraq | Kurdistan', 'Irak | Kurdistan'], TR: ['تركيا', 'Türkiye', 'Türkei'], SY: ['سوريا', 'Syria', 'Syrien'],
  IR: ['إيران', 'Iran', 'Iran'], DE: ['ألمانيا', 'Germany', 'Deutschland'], SE: ['السويد', 'Sweden', 'Schweden'],
  NL: ['هولندا', 'Netherlands', 'Niederlande'], FR: ['فرنسا', 'France', 'Frankreich'], GB: ['بريطانيا', 'United Kingdom', 'Großbritannien'],
  US: ['أمريكا', 'USA', 'USA'], AT: ['النمسا', 'Austria', 'Österreich'], BE: ['بلجيكا', 'Belgium', 'Belgien'], CH: ['سويسرا', 'Switzerland', 'Schweiz'],
  NO: ['النرويج', 'Norway', 'Norwegen'], DK: ['الدنمارك', 'Denmark', 'Dänemark'], FI: ['فنلندا', 'Finland', 'Finnland'], ZZ: ['أخرى', 'Other', 'Andere']
};
function ccName(cc, fallback) {
  var v = CC[cc]; if (!v) return fallback || cc || CC.ZZ[0];
  var i = { ar: 0, en: 1, de: 2 }[O.lang()]; return v[i == null ? 0 : i];
}

/* ---------- storage (not tied to the IPTV playlist) ---------- */
function sg(k, d) { var v = O.store.g('radio.' + k, d); return v == null ? d : v; }
function ss(k, v) { O.store.gs('radio.' + k, v); }

/* ---------- state ---------- */
var PSEUDO = 3;
var root, built = false, shown = false, G = {}, searchT = 0, infoT = 0;
var S = { stations: [], cats: [], cur: null, all: [], view: [], area: 'channels', q: '', playing: null, st: 'idle', alt: 0,
  loading: false, err: false, edit: null, tok: 0, ltok: 0, fetched: 0 };
var R = O.radio = {};
var aud = null, srcT = 0, sleepEnd = 0, sleepT = 0;

/* ---------- network ---------- */
function getJ(url, ok, fail) { O.httpJSON(url, ok, fail || function () {}); }
function tryBase(i, ok, fail) {
  if (i >= RB.length) { fail(); return; }
  getJ(RB[i] + '/json/stats', function () { ok(RB[i]); }, function () { tryBase(i + 1, ok, fail); });
}
function rgIds(p, cb) {
  getJ('https://radio.garden/api/search?q=' + encodeURIComponent(p.search), function (j) {
    var hits = (j && j.hits && j.hits.hits) || [], out = [];
    hits.forEach(function (x) {
      var s = x && x._source; if (!s || out.length >= 2) return;
      var m = /\/listen\/[^\/]+\/([A-Za-z0-9_-]+)/.exec(s.url || '');
      if (m && pinMatch(p, s.title || '')) out.push(RG(m[1]));
    });
    cb(out);
  }, function () { cb([]); });
}
function fetchAll(done, fail) {
  tryBase(0, function (base) {
    var jobs = QUERIES.map(function (q) { return base + '/json/stations/search?' + q + '&hidebroken=true&order=clickcount&reverse=true&limit=200'; });
    PINNED.forEach(function (p) { jobs.push(base + '/json/stations/search?name=' + encodeURIComponent(p.search) + '&hidebroken=false&order=clickcount&reverse=true&limit=40'); });
    var left = jobs.length + PINNED.length, all = [], rg = {};
    function fin() { if (--left === 0) done(build(all, rg)); }
    jobs.forEach(function (u) { getJ(u, function (a) { if (Array.isArray(a)) all = all.concat(a); fin(); }, fin); });
    PINNED.forEach(function (p) { if (p.rg) rgIds(p, function (l) { rg[p.key] = l; fin(); }); else fin(); });
  }, fail);
}
/* raw Radio Browser results -> station list (pinned first, then by popularity) */
function build(all, rg) {
  var out = [], seen = {};
  PINNED.forEach(function (p) {
    var c = all.filter(function (x) { return pinMatch(p, x.name) && (x.url_resolved || x.url); });
    c.sort(function (a, b) { var d = (b.lastcheckok === 1) - (a.lastcheckok === 1); return d || (b.clickcount || 0) - (a.clickcount || 0); });
    var urls = [], su = {}, hit = c[0] || null;
    function add(u) { if (u && !su[u]) { su[u] = 1; urls.push(u); } }
    c.forEach(function (x) { var u = x.url_resolved || x.url; if (!isHls(u)) add(u); });
    (p.extra || []).forEach(function (u) { if (!isHls(u)) add(u); });
    (rg[p.key] || []).forEach(add);
    c.forEach(function (x) { var u = x.url_resolved || x.url; if (isHls(u)) add(u); });
    (p.extra || []).forEach(function (u) { if (isHls(u)) add(u); });
    if (!urls.length || blocked(p.name)) return;
    c.forEach(function (x) { seen[x.stationuuid] = 1; });
    out.push({ id: 'ossi-pinned-' + p.key, name: p.name, url: urls[0], alts: urls.slice(1, 7), cc: p.cc || (hit && hit.countrycode) || 'ZZ',
      country: hit ? hit.country : '', codec: hit ? String(hit.codec || 'MP3').toUpperCase() : 'MP3', br: hit ? hit.bitrate || 0 : 0,
      logos: (p.logos || []).concat(hit && hit.favicon ? [hit.favicon] : []), color: p.color, pin: 1 });
  });
  all.sort(function (a, b) { return (b.clickcount || 0) - (a.clickcount || 0); });
  var n = 0;
  for (var i = 0; i < all.length && n < MAX; i++) {
    var s = all[i], u = s.url_resolved || s.url, name = String(s.name || '').replace(/^\s+|\s+$/g, '');
    if (!u || !name || s.hls === 1 || /\.(m3u8|pls|m3u)(\?|$)/i.test(u)) continue;
    var codec = String(s.codec || '').toUpperCase();
    if (codec && !/MP3|AAC|OGG|MPEG/.test(codec)) continue;
    var key = u.replace(/^https?:\/\//, '');
    if (seen[key] || seen[s.stationuuid] || blocked(name) || PINNED.some(function (p) { return pinMatch(p, name); })) continue;
    seen[key] = 1; seen[s.stationuuid] = 1; n++;
    var lg = []; if (s.favicon && /^https?:/i.test(s.favicon)) lg.push(s.favicon);
    var dm = /^(?:https?:\/\/)?(?:www\.)?([^\/:?#]+\.[^\/:?#]+)/i.exec(s.homepage || ''); if (dm) lg.push(GS(dm[1]));
    out.push({ id: s.stationuuid, name: name, url: u, alts: [], cc: s.countrycode || 'ZZ', country: s.country || '', codec: codec, br: s.bitrate || 0, logos: lg });
  }
  if (!out.some(function (x) { return x.id === ARTA.id; })) out.push(ARTA);
  return out;
}

/* ---------- lists ---------- */
function removed() { var l = sg('removed', []); return Array.isArray(l) ? l : []; }
function buildCats() {
  var gone = removed(), by = {}, order = [];
  S.stations = S.stations.filter(function (s) { return gone.indexOf(s.id) < 0; });
  S.stations.forEach(function (s) { var c = s.cc || 'ZZ'; if (!by[c]) { by[c] = 0; order.push(c); } by[c]++; });
  order.sort(function (a, b) { return by[b] - by[a]; });
  S.cats = [
    { id: 'recent', name: t('rRecent'), type: 'recent' },
    { id: 'fav', name: t('favorites'), type: 'fav' },
    { id: 'all', name: t('rAll'), type: 'all', count: S.stations.length }
  ].concat(order.map(function (c) { var s0 = S.stations.filter(function (s) { return (s.cc || 'ZZ') === c; })[0]; return { id: 'cc-' + c, cc: c, name: ccName(c, s0 && s0.country), type: 'cat', count: by[c] }; }));
  counts();
}
function counts() {
  S.cats.forEach(function (c) { if (c.type === 'recent') c.count = sg('recent', []).length; else if (c.type === 'fav') c.count = sg('fav', []).length; });
}
function byId(id) { for (var i = 0; i < S.stations.length; i++) if (S.stations[i].id === id) return S.stations[i]; return null; }
function listFor(c) {
  var l;
  if (c.type === 'recent') l = sg('recent', []).map(byId);
  else if (c.type === 'fav') l = sg('fav', []).map(byId);
  else if (c.type === 'all') l = S.stations.slice();
  else l = S.stations.filter(function (s) { return (s.cc || 'ZZ') === c.cc; });
  l = l.filter(function (x) { return !!x; });
  return c.type === 'recent' || c.type === 'fav' ? l : O.applyOrder(l, sg('order.' + c.id, []), 'id');
}
function openCat(c, toList, keepId) {
  S.cur = c; ss('lastCat', c.id);
  S.all = listFor(c); applyView();
  G.ch.reset();
  if (keepId) { for (var i = 0; i < S.view.length; i++) if (S.view[i].id === keepId) { G.ch.setCur(i); break; } }
  drawCh(); G.cats.draw(); drawInfo();
  if (toList && S.view.length) setArea('channels');
}
function applyView() {
  var q = S.q;
  S.view = q ? S.stations.filter(function (s) { return norm(s.name).indexOf(norm(q)) > -1; }) : S.all;
}
function drawCh() {
  var el = $('rdChs');
  if (S.loading && !S.stations.length) { el.innerHTML = '<div class="loading">' + esc(t('loading')) + '</div>'; return; }
  if (S.err && !S.stations.length) { el.innerHTML = '<div class="loading">' + esc(t('loadFail')) + '<br>' + esc(t('retryHint')) + '</div>'; return; }
  if (!S.view.length) { el.innerHTML = '<div class="loading">' + esc(t('empty')) + '</div>'; return; }
  G.ch.draw();
}

/* ---------- rows ---------- */
function ini(n) { var s = String(n).replace(/[^\w؀-ۿ]/g, ''); return (s || 'FM').slice(0, 2).toUpperCase(); }
function catRow(i) {
  var c = S.cats[i], act = S.cur && S.cur.id === c.id, real = c.type === 'cat';
  return '<div class="cat' + (!real ? ' pseudo' : '') + (act && !S.q ? ' act' : '') + '" data-i="' + i + '">' +
    (real ? '<span class="no">' + (i - PSEUDO + 1) + '</span>' : '') + '<span class="nm" dir="auto">' + esc(c.name) + '</span><b>' + (c.count != null ? c.count : '') + '</b></div>';
}
function chRow(i) {
  var s = S.view[i], fav = isFav(s.id), now = S.playing && S.playing.id === s.id, mv = S.edit && S.edit.id === s.id;
  var sub = [ccName(s.cc, s.country), s.codec, s.br ? s.br + 'k' : ''].filter(function (x) { return x; }).join(' · ');
  var lg = s.logos && s.logos[0], i2 = esc(ini(s.name));
  return '<div class="ch rd-ch' + (now ? ' now' : '') + (mv ? ' sel' : '') + '" data-i="' + i + '"><span class="no">' + (now && S.st === 'playing' ? '<i class="rd-dot"></i>' : (i + 1)) + '</span>' +
    '<span class="lg" data-ini="' + i2 + '"' + (s.color && !lg ? ' style="background:' + esc(s.color) + '"' : '') + '>' + (lg ? '<img src="' + esc(lg) + '" decoding="async">' : i2) + '</span>' +
    '<span class="chx"><span class="nm" dir="auto">' + esc(s.name) + '</span><span class="np" dir="auto">' + esc(sub) + '</span></span>' +
    (S.edit ? '<span class="ck' + (mv ? ' on' : '') + '"></span>' : '<span class="hrt' + (fav ? ' on' : '') + '">' + O.ic.heart + '</span>') + '</div>';
}

/* ---------- build ---------- */
function buildUi() {
  root = $('radio');
  root.innerHTML =
    '<div class="lv-shadow"></div><div class="hdr"></div>' + O.brandBack(t('radio')) +
    '<div class="hbtn" id="rdHome" style="left:1790px;margin-left:var(--X,0px)">' + O.ic.home + '</div>' +
    '<div class="pane lv-cats"></div><div class="pane lv-chs"></div>' +
    '<div class="sbox" id="rdS" style="left:20px;top:140px;width:520px">' + O.ic.search + '<input id="rdQ" class="srch" placeholder="' + esc(t('rSearch')) + '"></div>' +
    '<div class="lv-list" id="rdCats"></div><div class="lv-list" id="rdChs"></div>' +
    '<div class="lv-prev rd-prev" id="rdPrev"></div><div class="lv-info" id="rdInfo"></div>' +
    '<div class="hints lv-hint" id="rdHint"><span><i class="kd w"></i>OK</span><span>☰ ' + esc(t('hMenu')) + '</span><span>' + esc(t('hLongSort')) + '</span></div>' +
    '<div class="editbar tbar hidden" id="rdEditT"><span class="et" dir="auto">' + esc(t('rDragHint')) + '</span><b class="ebtn on" id="rdEdDone">' + esc(t('eDone')) + '</b></div>' +
    '<div class="editbar hidden" id="rdEdit"><span>▲ ▼  ' + esc(t('eMoveUD')) + '</span><span><i class="kd w"></i>' + esc(t('eOkDrop')) + '</span><span>↩  ' + esc(t('eBackCancel')) + '</span></div>';
  G.cats = new O.VGrid($('rdCats'), { cols: 1, itemH: 74, gap: 8, render: catRow, count: function () { return S.cats.length; },
    onClick: function (i) { setArea('cats'); catOk(); } });
  G.ch = new O.VGrid($('rdChs'), { cols: 1, itemH: 104, gap: 10, render: chRow, count: function () { return S.view.length; },
    onClick: function (i, e) {
      if (S.edit) return;
      setArea('channels');
      if (e.target.closest && e.target.closest('.hrt')) toggleFav(S.view[i]); else activate(i);
    },
    onLong: function (i) { if (S.edit) return; G.ch.cur = i; G.ch.paint(); menu(); },
    onDragStart: function (i) { return !!(S.edit && S.view[i] && S.view[i].id === S.edit.id); },
    onDrop: function (slot) { dropAt(slot); } });
  $('rdPrev').onclick = function () { toggle(); };
  $('rdEdDone').onclick = function () { endEdit(true); };
  $('rdHome').onclick = function () { O.app.go('home'); };
  $('rdQ').addEventListener('input', function () {
    clearTimeout(searchT); searchT = setTimeout(function () { S.q = $('rdQ').value.replace(/^\s+|\s+$/g, ''); applyView(); G.ch.reset(); drawCh(); G.cats.draw(); }, 250);
  });
  built = true;
}

/* ---------- preview + info ---------- */
var EQ = (function () { var h = ''; for (var i = 0; i < 10; i++) h += '<i style="animation-delay:-' + (i * 0.13).toFixed(2) + 's"></i>'; return h; })();
function stLabel() {
  if (S.st === 'playing') return '● ' + t('rLive');
  if (S.st === 'loading') return t('rConnecting');
  if (S.st === 'error') return t('rFail');
  if (S.st === 'paused') return t('rStopped');
  return t('rPick');
}
function drawPrev() {
  var p = $('rdPrev'), s = S.playing;
  p.className = 'lv-prev rd-prev rd-' + S.st + (S.area === 'preview' ? ' focus' : '');
  p.innerHTML = '<div class="rd-disc"><div class="rd-lbl">🎶</div></div><div class="rd-txt"><b dir="auto">' + esc(s ? s.name : 'Ossi Radio') + '</b>' +
    '<span>' + esc(stLabel()) + '</span><div class="rd-eq">' + EQ + '</div></div>';
}
function drawInfo() {
  var s = S.playing || S.view[G.ch ? G.ch.cur : 0], el = $('rdInfo');
  if (!s) { el.innerHTML = ''; return; }
  var meta = [ccName(s.cc, s.country), s.codec, s.br ? s.br + ' kbps' : ''].filter(function (x) { return x; }).join(' · ');
  var sl = sleepEnd ? Math.max(0, Math.ceil((sleepEnd - Date.now()) / 60000)) : 0;
  el.innerHTML = '<h2 dir="auto">' + esc(s.name) + '</h2><hr><p dir="auto">' + esc(meta) + '</p>' +
    (sl ? '<p class="rd-sleep">⏾ ' + esc(t('sleepLeft')) + ' ' + sl + ' ' + esc(t('minShort')) + '</p>' : '') +
    '<p class="lvhint">' + esc(t(O.isTouch() ? 'rHintT' : 'rHint')) + '</p>';
}
function paintNow() { drawPrev(); drawInfo(); G.ch.draw(); }

/* ---------- areas ---------- */
function setArea(a) {
  S.area = a;
  G.cats.setActive(a === 'cats'); G.ch.setActive(a === 'channels');
  $('rdS').classList.toggle('focus', a === 'search');
  drawPrev();
}

/* ---------- playback (HTML5 audio) ---------- */
function audio() {
  if (aud) return aud;
  aud = new Audio(); aud.preload = 'none';
  aud.addEventListener('playing', function () { clearTimeout(srcT); S.st = 'playing'; if (shown) paintNow(); });
  aud.addEventListener('pause', function () { if (S.st === 'playing') { S.st = 'paused'; if (shown) paintNow(); } });
  aud.addEventListener('waiting', function () { if (S.st === 'playing') { S.st = 'loading'; if (shown) drawPrev(); } });
  aud.addEventListener('error', function () { if (aud.getAttribute('src')) nextSrc(); });
  aud.addEventListener('ended', function () { if (S.playing) startSrc(); });     /* a live stream that "ends" is reconnected */
  return aud;
}
function srcs(s) { return [s.url].concat(s.alts || []); }
function startSrc() {
  var s = S.playing; if (!s) return;
  var a = audio(), list = srcs(s), my = S.tok, alt = S.alt;
  clearTimeout(srcT);
  S.st = 'loading'; if (shown) drawPrev();
  a.src = list[S.alt];
  var p = a.play(); if (p && p.catch) p.catch(function () {});
  srcT = setTimeout(function () { if (S.tok === my && S.alt === alt && S.st === 'loading') nextSrc(); }, 15000);
}
function nextSrc() {
  var s = S.playing; if (!s) return;
  clearTimeout(srcT);
  if (S.alt + 1 < srcs(s).length) { S.alt++; O.toast(t('rAlt')); startSrc(); return; }
  stopAudio(); S.st = 'error'; if (shown) paintNow();
}
function stopAudio() {
  clearTimeout(srcT);
  if (aud) { try { aud.pause(); aud.removeAttribute('src'); aud.load(); } catch (e) {} }
}
function play(s) {
  S.tok++; S.playing = s; S.alt = 0;
  ss('last', s.id);
  var r = sg('recent', []).filter(function (id) { return id !== s.id; }); r.unshift(s.id); ss('recent', r.slice(0, 20));
  counts(); G.cats.draw();
  startSrc(); paintNow();
}
function toggle() {
  if (!S.playing) { var s = S.view[G.ch.cur]; if (s) play(s); return; }
  if (S.st === 'playing' || S.st === 'loading') { S.tok++; stopAudio(); S.st = 'paused'; paintNow(); }
  else play(S.playing);
}
function stop() { S.tok++; stopAudio(); S.st = S.playing ? 'paused' : 'idle'; }
function step(d) {
  var L = S.view; if (!L.length) return;
  var i = S.playing ? L.indexOf(S.playing) : G.ch.cur; if (i < 0) i = G.ch.cur;
  i = (i + d + L.length) % L.length; G.ch.setCur(i); play(L[i]);
}
function activate(i) {
  var s = S.view[i]; if (!s) return;
  if (S.playing && S.playing.id === s.id) toggle(); else play(s);
}

/* ---------- favourites / delete ---------- */
function isFav(id) { return sg('fav', []).indexOf(id) > -1; }
function toggleFav(s) {
  if (!s) return;
  var l = sg('fav', []), on = l.indexOf(s.id) < 0;
  l = l.filter(function (x) { return x !== s.id; }); if (on) l.push(s.id);
  ss('fav', l); O.toast(t(on ? 'favAdded' : 'favRemoved')); counts();
  if (S.cur && S.cur.type === 'fav') openCat(S.cur, false); else { G.ch.draw(); G.cats.draw(); }
}
function askDelete(s) {
  if (!s) return;
  O.modal.confirm(t('rDelTitle'), t('rDelMsg').replace('%s', s.name), function () {
    var g = removed(); if (g.indexOf(s.id) < 0) g.push(s.id); ss('removed', g);
    ss('fav', sg('fav', []).filter(function (x) { return x !== s.id; }));
    ss('recent', sg('recent', []).filter(function (x) { return x !== s.id; }));
    if (S.playing && S.playing.id === s.id) { stop(); S.playing = null; S.st = 'idle'; }
    var keep = G.ch.cur, c = S.cur;
    buildCats(); S.cats.forEach(function (x) { if (c && x.id === c.id) c = x; });
    openCat(c || S.cats[2], false); G.ch.setCur(Math.min(keep, S.view.length - 1));
    drawPrev(); O.toast(t('rDeleted'));
  }, null, true);
}
function restore() {
  ss('removed', []); O.toast(t('rRestored'));
  var c = S.cur ? S.cur.id : 'all'; S.stations = sg('cache', []); buildCats();
  var e = null; S.cats.forEach(function (x) { if (x.id === c) e = x; }); openCat(e || S.cats[2], false);
}

/* ---------- sleep timer ---------- */
var SLEEP = [15, 30, 60, 90, 180];
function setSleep(m) {
  clearInterval(sleepT); sleepEnd = 0;
  if (m) {
    sleepEnd = Date.now() + m * 60000;
    sleepT = setInterval(function () {
      if (Date.now() >= sleepEnd) { clearInterval(sleepT); sleepEnd = 0; stop(); if (shown) paintNow(); O.toast(t('sleepDone')); }
      else if (shown) drawInfo();
    }, 30000);
    O.toast(t('sleepSet') + ' ' + m + ' ' + t('minShort'));
  } else O.toast(t('sleepOff'));
  drawInfo();
}
function sleepMenu() {
  O.modal.list(t('sleep'), function () {
    return SLEEP.map(function (m) { return { label: m + ' ' + t('minShort'), onOk: function () { O.modal.closeAll(); setSleep(m); } }; })
      .concat([{ label: t('sleepOff'), onOk: function () { O.modal.closeAll(); setSleep(0); } }]);
  }, { light: true });
}

/* ---------- ☰ menu ---------- */
function menu() {
  var s = S.area === 'channels' ? S.view[G.ch.cur] : null, rows = [];
  if (s) {
    if (canOrder(false)) rows.push({ label: t('mMoveOne'), onOk: function () { O.modal.close(); startEdit(); } });
    rows.push({ label: t(isFav(s.id) ? 'mFavDel' : 'mFavAdd'), onOk: function () { O.modal.close(); toggleFav(s); } });
    rows.push({ label: t('rDelTitle'), onOk: function () { O.modal.close(); askDelete(s); } });
  }
  rows.push({ label: t('sleep') + (sleepEnd ? '  (' + Math.ceil((sleepEnd - Date.now()) / 60000) + ' ' + t('minShort') + ')' : ''), onOk: function () { O.modal.close(); sleepMenu(); } });
  rows.push({ label: t('rReload'), onOk: function () { O.modal.close(); load(true); } });
  if (removed().length) rows.push({ label: t('rRestore') + ' (' + removed().length + ')', onOk: function () { O.modal.close(); restore(); } });
  O.modal.list(s ? s.name : t('options'), function () { return rows; }, { light: true });
}

/* ---------- re-ordering: hold OK (remote) / hold + drag (touch) ---------- */
function canOrder(quiet) {
  if (!S.cur || S.cur.type === 'recent') { if (!quiet) O.toast(t('editRecent')); return false; }
  if (S.q) { if (!quiet) O.toast(t('clearSearch')); return false; }
  return S.view.length > 1;
}
function startEdit() {
  var s = S.view[G.ch.cur]; if (!s || S.edit) return;
  S.edit = { id: s.id, orig: S.all.slice() };
  $('rdEdit').classList.toggle('hidden', O.isTouch()); $('rdEditT').classList.toggle('hidden', !O.isTouch()); $('rdHint').style.display = 'none';
  G.ch.draw();
}
function endEdit(save) {
  if (!S.edit) return;
  if (save) {
    var ids = S.all.map(function (x) { return x.id; });
    if (S.cur.type === 'fav') ss('fav', ids); else ss('order.' + S.cur.id, ids);
    O.toast(t('orderSaved'));
  } else { S.all = S.edit.orig; }
  S.edit = null; applyView();
  $('rdEdit').classList.add('hidden'); $('rdEditT').classList.add('hidden'); $('rdHint').style.display = '';
  G.ch.draw();
}
function moveBy(d) {
  var i = G.ch.cur, j = i + d; if (j < 0 || j >= S.all.length) return;
  var x = S.all[i]; S.all[i] = S.all[j]; S.all[j] = x; S.view = S.all;
  G.ch.draw(); G.ch.setCur(j);
}
function dropAt(slot) {
  if (!S.edit) return;
  var from = -1; S.all.forEach(function (x, i) { if (x.id === S.edit.id) from = i; });
  if (from < 0) { endEdit(false); return; }
  var x = S.all.splice(from, 1)[0], to = slot > from ? slot - 1 : slot;
  S.all.splice(O.clamp(to, 0, S.all.length), 0, x); S.view = S.all;
  endEdit(true);
}

/* ---------- loading ---------- */
function load(force) {
  var my = ++S.ltok;
  if (!S.stations.length) { S.loading = true; drawCh(); }
  else if (force) O.toast(t('loading'));
  fetchAll(function (list) {
    S.loading = false; S.err = false; S.fetched = Date.now();
    if (!list.length) { if (force) O.toast(t('loadFail')); return; }
    ss('cache', list); ss('cacheTs', Date.now());
    if (!shown) return;
    var keep = S.view[G.ch.cur], c = S.cur ? S.cur.id : sg('lastCat', 'all');
    S.stations = list; buildCats();
    var e = null; S.cats.forEach(function (x) { if (x.id === c) e = x; });
    if (S.playing) { var np = byId(S.playing.id); if (np) S.playing = np; }
    openCat(e || S.cats[2], false, keep && keep.id);
    if (force && my === S.ltok) O.toast(t('rUpdated'));
  }, function () {
    S.loading = false;
    if (!S.stations.length) { S.err = true; drawCh(); } else if (force) O.toast(t('loadFail'));
  });
}

/* ---------- keys ---------- */
R.onKey = function (e, k) {
  var a = S.area, used = true;
  if (S.edit) {
    if (k === K.UP) moveBy(-1); else if (k === K.DOWN) moveBy(1);
    else if (k === K.ENTER || k === K.RED) endEdit(true);
    else if (k === K.BACK || k === K.ESC) endEdit(false);
    e.preventDefault(); return true;
  }
  if (k === K.BACK || k === K.ESC) { O.app.back(); e.preventDefault(); return true; }
  if (k === K.MENU) menu();
  else if (k === K.PLAYPAUSE || k === K.PLAY || k === K.PAUSE) { if (k === K.PLAYPAUSE || (k === K.PLAY) !== (S.st === 'playing')) toggle(); }
  else if (k === K.STOP) { stop(); paintNow(); }
  else if (k === K.FF) step(1);
  else if (k === K.RW) step(-1);
  else if (k === K.YELLOW) { if (a === 'channels') toggleFav(S.view[G.ch.cur]); }
  else if (k === K.GREEN) { if (a === 'channels') askDelete(S.view[G.ch.cur]); }
  else if (k === K.BLUE) sleepMenu();
  else if (k === K.RED) { if (a === 'channels' && canOrder(false)) startEdit(); }
  else if (a === 'search') {
    if (k === K.DOWN) setArea('cats');
    else if (k === K.RIGHT) { if (S.view.length) setArea('channels'); }
    else if (k === K.ENTER) O.searchKb($('rdQ'));
    else used = false;
  } else if (a === 'cats') {
    if (k === K.UP) { if (!G.cats.move(0, -1)) setArea('search'); }
    else if (k === K.DOWN) G.cats.move(0, 1);
    else if (k === K.RIGHT) { if (S.view.length) setArea('channels'); }
    else if (k === K.ENTER) catOk();
    else if (k === K.PGUP || k === K.CHDN) G.cats.page(-1);
    else if (k === K.PGDN || k === K.CHUP) G.cats.page(1);
    else used = false;
  } else if (a === 'channels') {
    if (k === K.UP) { if (!G.ch.move(0, -1)) setArea('search'); }
    else if (k === K.DOWN) G.ch.move(0, 1);
    else if (k === K.LEFT) setArea('cats');
    else if (k === K.RIGHT) setArea('preview');
    else if (k === K.ENTER) { if (S.err && !S.stations.length) load(true); else activate(G.ch.cur); }
    else if (k === K.PGUP || k === K.CHDN) G.ch.page(-1);
    else if (k === K.PGDN || k === K.CHUP) G.ch.page(1);
    else used = false;
    if (used && !S.playing && (k === K.UP || k === K.DOWN)) { clearTimeout(infoT); infoT = setTimeout(drawInfo, 160); }
  } else if (a === 'preview') {
    if (k === K.LEFT) setArea('channels');
    else if (k === K.ENTER) toggle();
    else used = false;
  } else used = false;
  if (used) e.preventDefault();
  return used;
};
function catOk() {
  var c = S.cats[G.cats.cur]; if (!c) return;
  if (S.q) { S.q = ''; $('rdQ').value = ''; }
  openCat(c, true);
}
R.canLongOk = function () { return !S.edit && S.area === 'channels' && S.view.length > 1 && !(S.cur && S.cur.type === 'recent') && !S.q; };
R.onLongOk = function () { if (canOrder(false)) startEdit(); };
R.editing = function () { return !!S.edit; };

/* ---------- lifecycle ---------- */
R.show = function () {
  if (!built) buildUi();
  shown = true; root.classList.remove('hidden');
  if (!S.stations.length) {
    S.stations = sg('cache', []);
    if (!Array.isArray(S.stations)) S.stations = [];
  }
  if (S.stations.length) {
    buildCats();
    var want = S.cur ? S.cur.id : sg('lastCat', 'all'), e = null;
    S.cats.forEach(function (x) { if (x.id === want) e = x; });
    if (!e || (e.type !== 'cat' && e.type !== 'all' && !listFor(e).length)) e = S.cats[2];
    G.cats.setCur(S.cats.indexOf(e));
    openCat(e, false, S.playing ? S.playing.id : sg('last', null));
    setArea('channels');
  } else { S.cats = []; G.cats.draw(); setArea('channels'); }
  drawPrev(); drawInfo();
  /* fresh list at most every 6 hours (or when nothing is cached yet) */
  if (!S.stations.length || Date.now() - sg('cacheTs', 0) > 6 * 3600000) load(false);
};
R.hide = function () {
  shown = false;
  if (S.edit) endEdit(false);
  stop(); S.playing = null; S.st = 'idle';
  clearInterval(sleepT); sleepEnd = 0;
  if (root) root.classList.add('hidden');
};
R.relang = function () { built = false; S.cats = []; S.cur = null; };
document.addEventListener('visibilitychange', function () {
  if (document.hidden && shown && S.playing) { stop(); paintNow(); }
});
})();
