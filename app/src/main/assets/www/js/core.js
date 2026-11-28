/* Core: helpers, storage, playlists, API + data layer, parental control. ES6 without ?. / ?? (Chromium 76). */
(function () {
'use strict';
var O = window.O = window.O || {};
O.VERSION = '3.0.0';
var doc = document;

O.$ = function (id) { return doc.getElementById(id); };
O.enc = encodeURIComponent;
O.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
O.esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
};

/* ---------- inline icons ---------- */
O.ic = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.61 3.61 0 0112 15.6z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" class="lk"><path d="M18 8h-1V6A5 5 0 007 6v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zM9 6a3 3 0 016 0v2H9z"/></svg>'
};
O.resLabel = function (r) {
  if (!r || !r.h) return '';
  var w = Math.max(r.w, r.h), q = w >= 3200 ? '4K UHD' : w >= 1800 ? 'FHD' : w >= 1200 ? 'HD' : 'SD';
  return q + ' • ' + r.w + '×' + r.h + (r.fps ? ' • ' + r.fps + 'fps' : '');
};
O.brand = '<div class="brand"><img src="img/logo_s.png" alt="Ossi TV"></div>';
/* inside sections: logo on TV, back button (+ section title) on touch devices */
O.brandBack = function (title) {
  return '<div class="brand sub"><img src="img/logo_s.png" alt="Ossi TV"></div>' +
    '<div class="hback" data-back><span class="hb-ic"><svg viewBox="0 0 24 24"><path d="M15 4.5 7.5 12l7.5 7.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
    (title ? '<span class="hb-t" dir="auto">' + O.esc(title) + '</span>' : '') + '</div>';
};

/* ---------- storage ---------- */
var mem = {};
function rg(k) { try { return localStorage.getItem(k); } catch (e) { return mem.hasOwnProperty(k) ? mem[k] : null; } }
function rs(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
function rd(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
function parse(v, d) { if (v == null) return d; try { return JSON.parse(v); } catch (e) { return d; } }
O.store = {
  g: function (k, d) { return parse(rg('ossi.g.' + k), d); },
  gs: function (k, v) { rs('ossi.g.' + k, JSON.stringify(v)); },
  p: function (k, d) { return parse(rg('ossi.p.' + O.pl.id + '.' + k), d); },
  ps: function (k, v) { rs('ossi.p.' + O.pl.id + '.' + k, JSON.stringify(v)); },
  pd: function (k) { rd('ossi.p.' + O.pl.id + '.' + k); },
  pdPrefix: function (prefix) {
    var full = 'ossi.p.' + O.pl.id + '.' + prefix, keys = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(full) === 0) keys.push(k); } } catch (e) {}
    keys.forEach(rd);
  },
  pdAll: function (id) {
    var full = 'ossi.p.' + id + '.', keys = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(full) === 0) keys.push(k); } } catch (e) {}
    keys.forEach(rd);
  }
};
O.cfg = {
  get: function (k, d) { return O.store.g('cfg.' + k, d); },
  set: function (k, v) { O.store.gs('cfg.' + k, v); }
};

/* ---------- playlists ---------- */
function normHost(h) {
  h = String(h || '').replace(/^\s+|\s+$/g, '');
  if (!/^https?:\/\//i.test(h)) h = 'http://' + h;
  return h.replace(/\/+$/, '');
}
O.normHost = normHost;
O.plList = function () {
  var l = O.store.g('playlists', null);
  if (!l || !l.length) {
    var C = window.OSSI_CONFIG || {};
    l = [{ id: 'p1', name: C.name || 'Ossi', host: normHost(C.host), user: C.username || '', pass: C.password || '' }];
    O.store.gs('playlists', l);
  }
  var fh = O.fixedHost && O.fixedHost();
  if (fh) l.forEach(function (p) { p.host = fh; });     /* the server is fixed for every account */
  return l;
};
O.plSave = function (l) { O.store.gs('playlists', l); };
O.fixedHost = function () { var C = window.OSSI_CONFIG || {}; return C.fixedHost && C.host ? normHost(C.host) : ''; };
O.plSetActive = function (id) {
  var l = O.plList(), f = l[0];
  l.forEach(function (x) { if (x.id === id) f = x; });
  O.pl = f; O.store.gs('activePl', f.id);
};
O.plInit = function () { O.plSetActive(O.store.g('activePl', null)); };

/* ---------- formatting ---------- */
O.fmtClock = function (d) {
  var h = d.getHours(), m = d.getMinutes(), mm = (m < 10 ? '0' : '') + m;
  if (O.cfg.get('time', '24') === '12') { var ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + mm + ' ' + ap; }
  return (h < 10 ? '0' : '') + h + ':' + mm;
};
O.fmtDate = function (d) {
  var loc = { ar: 'ar', en: 'en-GB', de: 'de-DE' }[O.lang()] || 'en-GB';
  try { return d.toLocaleDateString(loc, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return d.toDateString(); }
};
O.fmtDur = function (ms) {
  var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x;
};

/* ---------- ordering helper: saved id order first, unknown items keep original order after ---------- */
O.applyOrder = function (arr, saved, key) {
  if (!saved || !saved.length) return arr.slice();
  var map = {}, out = [], used = {};
  arr.forEach(function (x) { map[x[key]] = x; });
  saved.forEach(function (id) { if (map[id] !== undefined && !used[id]) { out.push(map[id]); used[id] = 1; } });
  arr.forEach(function (x) { if (!used[x[key]]) out.push(x); });
  return out;
};

/* ---------- network ---------- */
O.api = {
  url: function (action, extra) {
    var p = O.pl;
    return p.host + '/player_api.php?username=' + O.enc(p.user) + '&password=' + O.enc(p.pass) +
      (action ? '&action=' + action : '') + (extra || '');
  },
  get: function (action, extra, ok, fail, tries) { return O.getJSON(O.api.url(action, extra), ok, fail, tries); },
  stream: function (kind, id, ext) {
    var p = O.pl;
    return p.host + '/' + kind + '/' + O.enc(p.user) + '/' + O.enc(p.pass) + '/' + O.enc(id) + '.' + ext;
  }
};
O.getJSON = function (url, ok, fail, tries, ms) {
  var ctl = { x: null, dead: false, abort: function () { ctl.dead = true; try { ctl.x.abort(); } catch (e) {} } };
  (function attempt(n) {
    var x = new XMLHttpRequest(), fin = false;
    function snip(r) { var s = String(r.responseText || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); return s ? ': ' + s.slice(0, 120) : ''; }
    ctl.x = x;
    function bad(msg) {
      if (fin || ctl.dead) return; fin = true;
      if (n > 0) setTimeout(function () { if (!ctl.dead) attempt(n - 1); }, 1200);
      else if (fail) fail(msg);
    }
    x.open('GET', url, true);
    x.timeout = ms || 60000;
    x.onload = function () {
      if (fin || ctl.dead) return;
      if (x.status < 200 || x.status >= 300) { bad('HTTP ' + x.status + snip(x)); return; }
      var d;
      try { d = JSON.parse(x.responseText); } catch (e) { bad('HTTP ' + x.status + ' (no JSON)' + snip(x)); return; }
      fin = true; ok(d);
    };
    x.onerror = function () { bad(x.status ? 'HTTP ' + x.status : 'network'); };
    x.ontimeout = function () { bad('timeout'); };
    x.send();
  })(tries == null ? 2 : tries);
  return ctl;
};

/* GET from an outside site (translation, match data, TV guide). On Android the request runs natively
   (no WebView/CORS limits); elsewhere a normal request. ok(text) / ok(json) */
O.httpGet = (function () {
  var seq = 0, wait = {};
  /* bytes -> text in the page's own character set (some Turkish sites are not UTF-8) */
  function decode(u, ctype) {
    var cs = (/charset=["']?([\w-]+)/i.exec(ctype || '') || [])[1];
    if (!cs) {
      var head = '', n = Math.min(u.length, 4096);
      for (var i = 0; i < n; i++) head += String.fromCharCode(u[i]);
      cs = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(head) || [])[1];
    }
    cs = String(cs || 'utf-8').toLowerCase();
    if (window.TextDecoder) {
      try { return new TextDecoder(cs).decode(u); } catch (e) { return new TextDecoder('utf-8').decode(u); }
    }
    var s = ''; for (var j = 0; j < u.length; j++) s += String.fromCharCode(u[j]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  }
  window.__ossiFetch = function (id, status, b64, ctype) {
    var w = wait[id]; if (!w) return; delete wait[id]; clearTimeout(w.t);
    if (!(status >= 200 && status < 300)) { w.fail('HTTP ' + status); return; }
    var txt = '';
    try {
      var bin = atob(b64 || ''), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      txt = decode(u, ctype);
    } catch (e) { w.fail('decode'); return; }
    w.ok(txt);
  };
  function xhr(url, ok, fail) {
    var x = new XMLHttpRequest(), fin = false;
    function bad(m) { if (!fin) { fin = true; fail(m); } }
    x.open('GET', url, true); x.timeout = 30000;
    try { x.responseType = 'arraybuffer'; } catch (e) {}
    x.onload = function () {
      if (fin) return;
      if (!(x.status >= 200 && x.status < 300)) { bad('HTTP ' + x.status); return; }
      var txt;
      try { txt = x.response instanceof ArrayBuffer ? decode(new Uint8Array(x.response), x.getResponseHeader('content-type')) : x.responseText; }
      catch (e) { bad('decode'); return; }
      fin = true; ok(txt);
    };
    x.onerror = function () { bad('network'); }; x.ontimeout = function () { bad('timeout'); };
    try { x.send(); } catch (e) { bad('network'); }
  }
  return function (url, ok, fail) {
    fail = fail || function () {};
    var N = window.OssiNative;
    if (N && N.fetch) {
      var id = 'f' + (++seq);
      wait[id] = { ok: ok, fail: fail, t: setTimeout(function () { if (wait[id]) { delete wait[id]; fail('timeout'); } }, 40000) };
      try { N.fetch(url, id); return; } catch (e) { clearTimeout(wait[id].t); delete wait[id]; }
    }
    xhr(url, ok, fail);
  };
})();
O.httpJSON = function (url, ok, fail) {
  fail = fail || function () {};
  O.httpGet(url, function (txt) { var d; try { d = JSON.parse(txt); } catch (e) { fail('no JSON'); return; } ok(d); }, fail);
};

/* ---------- data layer ---------- */
var D = O.data = {};
var ACT = {
  live: ['get_live_categories', 'get_live_streams'],
  movie: ['get_vod_categories', 'get_vod_streams'],
  series: ['get_series_categories', 'get_series']
};
D.reset = function () {
  D.info = null; D.server = null;
  D.cats = { live: null, movie: null, series: null };
  D.liveAll = null; D.byCat = null; D.allLoading = false; D.allCbs = [];
  D.cache = {}; D.cacheKeys = []; D.vodAll = {};
  D.epgC = {}; D.epgQ = []; D.epgWait = {}; D.epgRun = 0;
};
D.reset();
function normCats(d) {
  return Array.isArray(d) ? d.map(function (c) { return { id: String(c.category_id), name: c.category_name || '?' }; }) : [];
}
function norm(type, c) {
  if (type === 'live') return { id: c.stream_id, name: c.name || '?', icon: c.stream_icon || '', cat: String(c.category_id || ''),
    arch: +c.tv_archive === 1 ? (+c.tv_archive_duration || 1) : 0 };
  if (type === 'movie') return { id: c.stream_id, name: c.name || '?', icon: c.stream_icon || '', cat: String(c.category_id || ''), rating: c.rating, ext: c.container_extension || 'mp4' };
  return { id: c.series_id, name: c.name || '?', icon: c.cover || '', cat: String(c.category_id || ''), rating: c.rating };
}
D.loadInfo = function (ok, fail) {
  O.api.get('', null, function (d) {
    D.info = d && d.user_info ? d.user_info : null; D.server = d && d.server_info ? d.server_info : null;
    if (O.onInfo) { try { O.onInfo(D.info); } catch (e) {} }
    if (ok) ok(D.info);
  }, function (e) { if (fail) fail(e); }, 1);
};
D.getCats = function (type, ok, fail) {
  if (D.cats[type]) { ok(D.cats[type]); return null; }
  return O.api.get(ACT[type][0], null, function (d) { D.cats[type] = normCats(d); ok(D.cats[type]); }, fail);
};
D.loadAllLive = function (ok, fail) {
  if (D.liveAll) { if (ok) ok(D.liveAll); return; }
  if (ok || fail) D.allCbs.push([ok, fail]);
  if (D.allLoading) return;
  D.allLoading = true;
  O.api.get(ACT.live[1], null, function (d) {
    var arr = Array.isArray(d) ? d : [], all = new Array(arr.length), by = {};
    for (var i = 0; i < arr.length; i++) {
      var it = norm('live', arr[i]); all[i] = it;
      (by[it.cat] || (by[it.cat] = [])).push(it);
    }
    D.liveAll = all; D.byCat = by; D.allLoading = false;
    var cbs = D.allCbs; D.allCbs = [];
    cbs.forEach(function (c) { if (c[0]) c[0](all); });
  }, function (e) {
    D.allLoading = false;
    var cbs = D.allCbs; D.allCbs = [];
    cbs.forEach(function (c) { if (c[1]) c[1](e); });
  }, 1);
};
D.getItems = function (type, cat, ok, fail) {
  if (type === 'live') {
    if (cat === 'all') { D.loadAllLive(ok, fail); return null; }
    if (D.byCat) { ok(D.byCat[cat] || []); return null; }
  }
  var key = type + ':' + cat;
  if (D.cache[key]) { ok(D.cache[key]); return null; }
  return O.api.get(ACT[type][1], '&category_id=' + O.enc(cat), function (d) {
    var l = Array.isArray(d) ? d.map(function (c) { return norm(type, c); }) : [];
    D.cache[key] = l; D.cacheKeys.push(key);
    while (D.cacheKeys.length > 8) delete D.cache[D.cacheKeys.shift()];
    ok(l);
  }, fail);
};
/* every movie / every series (for the search) — loaded once, kept until the data is refreshed */
D.getAllVod = function (type, ok, fail) {
  D.vodAll = D.vodAll || {};
  if (D.vodAll[type]) { ok(D.vodAll[type]); return null; }
  return O.api.get(ACT[type][1], null, function (d) {
    D.vodAll[type] = Array.isArray(d) ? d.map(function (c) { return norm(type, c); }) : [];
    ok(D.vodAll[type]);
  }, fail);
};
/* machine translation of a text (movie / series story) into the app language; cached on the device */
D.translate = function (text, ok, fail) {
  var tl = O.lang(), key = 'tr.' + tl + '.' + text.length + '.' + text.slice(0, 40);
  var hit = O.store.g(key, null); if (hit) { ok(hit); return; }
  var q = encodeURIComponent(text.slice(0, 4000));
  function done(out, src) {
    if (!out) return false;
    if (src && src === tl) { ok(null); return true; }        /* already in this language */
    O.store.gs(key, out); ok(out); return true;
  }
  /* two public Google endpoints: if one refuses (e.g. "too many requests"), the other is tried */
  function gtx() {
    O.httpJSON('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + tl + '&dt=t&q=' + q, function (d) {
      var out = '';
      try { (d[0] || []).forEach(function (seg) { if (seg && seg[0]) out += seg[0]; }); } catch (e) {}
      if (!done(out, d && d[2])) fail();
    }, fail);
  }
  O.httpJSON('https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=' + tl + '&q=' + q, function (d) {
    var out = '', src = '';
    try {
      var r = Array.isArray(d) ? d : (d.sentences ? [d.sentences.map(function (s) { return s.trans || ''; }).join('')] : []);
      if (Array.isArray(r[0])) { out = String(r[0][0] || ''); src = r[0][1] || ''; } else out = String(r[0] || '');
    } catch (e) {}
    if (!done(out, src)) gtx();
  }, gtx);
};
D.seriesInfo = function (id, ok, fail) {
  return O.api.get('get_series_info', '&series_id=' + O.enc(id), function (d) {
    var inf = (d && d.info) || {}, eps = (d && d.episodes) || {};
    var keys = Array.isArray(eps) ? eps.map(function (_, i) { return String(i + 1); }) : Object.keys(eps);
    keys.sort(function (a, b) { return (parseFloat(a) || 0) - (parseFloat(b) || 0); });
    var seasons = keys.map(function (k) {
      var list = Array.isArray(eps[k]) ? eps[k] : [];
      return {
        num: k,
        eps: list.map(function (e) {
          var i2 = e.info || {};
          return { id: e.id, title: e.title || ('E' + e.episode_num), num: e.episode_num, ext: e.container_extension || 'mp4', dur: i2.duration || '', plot: i2.plot || '' };
        })
      };
    }).filter(function (s) { return s.eps.length; });
    ok({
      name: inf.name || '', plot: inf.plot || '', cover: inf.cover || '', genre: inf.genre || '',
      year: (inf.releaseDate || inf.releasedate || '').slice(0, 4), rating: inf.rating || '', seasons: seasons,
      cast: inf.cast || '', director: inf.director || '', trailer: inf.youtube_trailer || '',
      backdrop: Array.isArray(inf.backdrop_path) ? (inf.backdrop_path[0] || '') : (inf.backdrop_path || '')
    });
  }, fail);
};

D.movieInfo = function (id, ok, fail) {
  return O.api.get('get_vod_info', '&vod_id=' + O.enc(id), function (d) {
    var inf = (d && d.info) || {}, md = (d && d.movie_data) || {};
    var bd = inf.backdrop_path;
    ok({
      name: inf.name || md.name || '', plot: inf.plot || inf.description || '', cover: inf.movie_image || inf.cover_big || '',
      backdrop: Array.isArray(bd) ? (bd[0] || '') : (bd || ''), genre: inf.genre || '', cast: inf.cast || inf.actors || '',
      director: inf.director || '', year: String(inf.releasedate || inf.release_date || inf.year || '').slice(0, 4),
      rating: inf.rating || '', dur: inf.duration || '', trailer: inf.youtube_trailer || '', ext: md.container_extension || ''
    });
  }, fail);
};

/* ---------- EPG (now / next), queued + cached ---------- */
O.b64 = function (s) {
  if (!s) return '';
  try { return decodeURIComponent(escape(atob(s))); } catch (e) { try { return atob(s); } catch (e2) { return String(s); } }
};
function epgParse(d) {
  var l = (d && d.epg_listings) || [];
  return l.map(function (x) {
    return { title: O.b64(x.title), desc: O.b64(x.description), s: (+x.start_timestamp || 0) * 1000, e: (+x.stop_timestamp || 0) * 1000,
      start: x.start || '', arch: +x.has_archive === 1 };
  }).filter(function (x) { return x.s && x.e && x.e > x.s; }).sort(function (a, b) { return a.s - b.s; });
}
D.epgNow = function (id) {
  var c = D.epgC[id]; if (!c) return null;
  var now = Date.now(), cur = null, nxt = null;
  c.list.forEach(function (x) { if (x.s <= now && x.e > now) cur = x; else if (x.s > now && !nxt) nxt = x; });
  return { cur: cur, nxt: nxt };
};
D.epg = function (id, cb) {
  if (id == null) return;
  var c = D.epgC[id], now = Date.now();
  if (c && now - c.ts < 600000 && (!c.list.length || c.list[c.list.length - 1].e > now)) { if (cb) cb(D.epgNow(id)); return; }
  if (!cb && D.epgWait[id]) return;
  var w = D.epgWait[id] || (D.epgWait[id] = []);
  w.push(cb || null);
  if (w.length > 1) return;
  D.epgQ.push(id);
  if (D.epgQ.length > 40) { var drop = D.epgQ.shift(); delete D.epgWait[drop]; }
  epgPump();
};
function epgPump() {
  while (D.epgRun < 3 && D.epgQ.length) {
    var id = D.epgQ.pop(); D.epgRun++;
    (function (id) {
      O.api.get('get_short_epg', '&stream_id=' + O.enc(id) + '&limit=10', function (d) { epgDone(id, epgParse(d)); }, function () { epgDone(id, []); }, 0);
    })(id);
  }
}
function epgDone(id, list) {
  D.epgRun = Math.max(0, D.epgRun - 1);
  D.epgC[id] = { ts: Date.now(), list: list };
  var w = D.epgWait[id] || []; delete D.epgWait[id];
  var now = D.epgNow(id);
  w.forEach(function (cb) { if (cb) { try { cb(now); } catch (e) {} } });
  if (O.onEpg) { try { O.onEpg(id, now); } catch (e) {} }
  epgPump();
}
O.fmtHM = function (ms) { return O.fmtClock(new Date(ms)); };
O.epgPct = function (x) { var n = Date.now(); return x ? O.clamp((n - x.s) / (x.e - x.s) * 100, 0, 100) : 0; };

/* ---------- catch-up (archive) ---------- */
D.archive = function (id, ok, fail) {
  return O.api.get('get_simple_data_table', '&stream_id=' + O.enc(id), function (d) { ok(epgParse(d)); }, fail);
};
O.api.timeshift = function (id, startStr, durMin) {
  var p = O.pl, m = String(startStr).match(/(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return '';
  return p.host + '/timeshift/' + O.enc(p.user) + '/' + O.enc(p.pass) + '/' + durMin + '/' + m[1] + ':' + m[2] + '-' + m[3] + '/' + O.enc(id) + '.ts';
};
O.trailerUrl = function (t) {
  t = String(t || '').replace(/^\s+|\s+$/g, '');
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return 'https://www.youtube.com/watch?v=' + encodeURIComponent(t);
};

/* ---------- favourites / recents (per playlist) ---------- */
O.fav = {
  list: function (type) { return O.store.p('fav.' + type, []); },
  has: function (type, id) { return O.fav.list(type).some(function (x) { return String(x.id) === String(id); }); },
  toggle: function (type, item) {
    var l = O.fav.list(type), on = false, out = l.filter(function (x) { return String(x.id) !== String(item.id); });
    if (out.length === l.length) { out.push(item); on = true; }
    O.store.ps('fav.' + type, out);
    return on;
  }
};
O.recent = {
  list: function (type) { return O.store.p('recent.' + type, []); },
  push: function (type, item) {
    var l = O.recent.list(type).filter(function (x) { return String(x.id) !== String(item.id); });
    item.ts = Date.now();
    l.unshift(item); O.store.ps('recent.' + type, l.slice(0, 20));
  },
  remove: function (type, id) {
    O.store.ps('recent.' + type, O.recent.list(type).filter(function (x) { return String(x.id) !== String(id); }));
  }
};
O.pos = {
  get: function (key) { return O.store.p('pos.' + key, null); },
  set: function (key, t, d) { O.store.ps('pos.' + key, { t: t, d: d, ts: Date.now() }); }
};

/* ---------- parental control ---------- */
var sess = {};
var ADULT = /(adult|xxx|porn|\+18|18\+|erotic|\bsex\b|للكبار|بالغين|اباح|إباح)/i;
O.par = {
  get: function () { return O.store.g('par', { pin: null, on: false, auto: true, locks: { live: [], movie: [], series: [] } }); },
  save: function (p) { O.store.gs('par', p); },
  active: function () { var p = O.par.get(); return !!(p.on && p.pin); },
  isLocked: function (type, cat) {
    var p = O.par.get();
    if (!p.on || !p.pin || cat.id === 'all' || cat.type === 'recent' || cat.type === 'fav') return false;
    if (sess[type + ':' + cat.id]) return false;
    if ((p.locks[type] || []).indexOf(cat.id) > -1) return true;
    return !!(p.auto && ADULT.test(cat.name || ''));
  },
  unlock: function (type, cat) { sess[type + ':' + cat.id] = 1; },
  check: function (pin) { return O.par.get().pin === pin; },
  /* ask for the PIN if the category is locked, then run proceed() */
  guard: function (type, cat, proceed) {
    if (!O.par.isLocked(type, cat)) { proceed(); return; }
    (function ask() {
      O.modal.pin(O.t('enterPin'), function (pin) {
        if (O.par.check(pin)) { O.par.unlock(type, cat); proceed(); }
        else { O.toast(O.t('wrongPin')); }
      });
    })();
  }
};
})();
