/* Virtual grid on top of NATIVE scrolling: the element scrolls like any list (fling, inertia, overscroll are done
   by the browser/compositor), but only the rows near the viewport exist in the DOM.
   Remote: cur/move/page keep the focused item visible.  Touch: long-press, drag & drop (opt.onDragStart/onDrop). */
(function () {
'use strict';
var O = window.O;

function VGrid(el, opt) {
  var self = this;
  this.el = el; this.cols = opt.cols || 1; this.itemH = opt.itemH; this.gap = opt.gap || 0;
  this.render = opt.render; this.count = opt.count; this.onClick = opt.onClick || null;
  this.onLong = opt.onLong || null; this.onDragStart = opt.onDragStart || null; this.onDrop = opt.onDrop || null;
  this.cur = 0; this.active = false; this.prev = null; this.r0 = -1; this.r1 = -1; this.n = -1; this.raf = 0;
  el.style.overflowY = 'auto'; el.style.overflowX = 'hidden';
  el.classList.add('vg');
  el.addEventListener('scroll', function () {
    if (self.raf) return;
    self.raf = requestAnimationFrame(function () { self.raf = 0; self.fill(false); });
  }, { passive: true });
  el.addEventListener('click', function (e) {
    var i = itemIndex(el, e.target);
    if (i !== null && self.onClick) { self.cur = i; self.onClick(i, e); }
  });
  el.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.parentNode) { var ini = t.parentNode.getAttribute('data-ini'); if (ini !== null) t.parentNode.textContent = ini; else t.style.display = 'none'; }
  }, true);
  bindTouch(this);
}
function itemIndex(el, t) {
  while (t && t !== el && !(t.getAttribute && t.getAttribute('data-i') !== null)) t = t.parentNode;
  return t && t !== el ? parseInt(t.getAttribute('data-i'), 10) : null;
}
VGrid.prototype.R = function () { return this.itemH + this.gap; };
VGrid.prototype.rows = function () { return Math.ceil(this.count() / this.cols); };
VGrid.prototype.vis = function () {
  var h = this.el.clientHeight || 600;
  return Math.max(1, Math.floor((h + this.gap) / (this.itemH + this.gap)));
};
/* (re)build the spacer + rows around the current scroll position */
VGrid.prototype.fill = function (force) {
  var el = this.el, n = this.count(), cols = this.cols, R = this.R(), rows = Math.ceil(n / cols);
  var h = el.clientHeight || 600, st = el.scrollTop;
  var r0 = Math.max(0, Math.floor(st / R) - 3), r1 = Math.min(rows, Math.ceil((st + h) / R) + 3);
  if (!force && r0 === this.r0 && r1 === this.r1 && n === this.n) return;
  this.r0 = r0; this.r1 = r1; this.n = n;
  var css = 'position:absolute;left:0;right:0;height:' + this.itemH + 'px;grid-template-columns:repeat(' + cols + ',minmax(0,1fr));grid-gap:' + this.gap + 'px;top:';
  var out = '';
  for (var r = r0; r < r1; r++) {
    out += '<div class="vrow" style="' + css + (r * R) + 'px">';
    for (var c = 0; c < cols; c++) { var i = r * cols + c; out += i < n ? this.render(i) : '<div></div>'; }
    out += '</div>';
  }
  var sp = el.firstChild;
  if (!sp || sp.className !== 'vsp') { el.innerHTML = '<div class="vsp"></div>'; sp = el.firstChild; }
  sp.style.height = Math.max(0, rows * R - this.gap) + 'px';
  sp.innerHTML = out;
  this.prev = null; this.paint();
};
/* make sure row r is fully visible (remote navigation) */
VGrid.prototype.reveal = function (r) {
  var el = this.el, R = this.R(), h = el.clientHeight || 600, top = r * R, bot = top + this.itemH;
  if (top < el.scrollTop) el.scrollTop = top;
  else if (bot > el.scrollTop + h) el.scrollTop = bot - h;
};
VGrid.prototype.draw = function () {
  var n = this.count();
  if (this.cur >= n) this.cur = Math.max(0, n - 1);
  var sp = this.el.firstChild;
  if (!sp || sp.className !== 'vsp') { this.el.innerHTML = '<div class="vsp"></div>'; }
  this.fill(true);
};
VGrid.prototype.paint = function () {
  if (this.prev) { this.prev.classList.remove('focus'); this.prev = null; }
  if (this.active) {
    var e = this.el.querySelector('[data-i="' + this.cur + '"]');
    if (e) { e.classList.add('focus'); this.prev = e; }
  }
};
VGrid.prototype.setActive = function (a) { this.active = a; this.paint(); };
VGrid.prototype.reset = function () { this.cur = 0; this.el.scrollTop = 0; this.draw(); };
VGrid.prototype.setCur = function (i) {
  var n = this.count(); if (!n) return;
  i = O.clamp(i, 0, n - 1); this.cur = i;
  this.reveal(Math.floor(i / this.cols));
  this.fill(false); this.paint();
};
/* returns false when the move hits an edge (caller may then change focus area) */
VGrid.prototype.move = function (dx, dy) {
  var n = this.count(), cols = this.cols, cur = this.cur, ni;
  if (!n) return false;
  if (dy) {
    ni = cur + dy * cols;
    if (ni >= n) { if (dy > 0 && Math.floor(cur / cols) < Math.floor((n - 1) / cols)) ni = n - 1; else return false; }
    if (ni < 0) return false;
  } else {
    if ((dx < 0 && cur % cols === 0) || (dx > 0 && cur % cols === cols - 1)) return false;
    ni = cur + dx; if (ni < 0 || ni >= n) return false;
  }
  this.setCur(ni); return true;
};
VGrid.prototype.page = function (dir) { this.setCur(this.cur + dir * this.cols * this.vis()); };
VGrid.prototype.currentEl = function () { return this.el.querySelector('[data-i="' + this.cur + '"]'); };

/* ---------------- touch: long-press + drag & drop (scrolling itself is native) ---------------- */
function bindTouch(g) {
  var el = g.el, st = null, lpT = 0, sup = false, drag = null;

  el.addEventListener('touchstart', function (e) {
    sup = false; clearTimeout(lpT);
    if (e.touches.length !== 1) { st = null; return; }
    var t = e.touches[0], it = itemIndex(el, e.target);
    st = { x: t.clientX, y: t.clientY, sc: el.scrollTop, target: e.target };
    if (it !== null && (g.onLong || g.onDragStart)) {
      lpT = setTimeout(function () {
        if (!st || Math.abs(el.scrollTop - st.sc) > 2) return;
        sup = true;
        try { if (navigator.vibrate) navigator.vibrate(25); } catch (x) {}
        if (g.onDragStart && g.onDragStart(it)) startDrag(it, st.y, st.target);
        else if (g.onLong) g.onLong(it);
      }, 500);
    }
  }, { passive: true });

  el.addEventListener('touchmove', function (e) {
    if (drag) { e.preventDefault(); return; }
    if (!st) return;
    var t = e.touches[0];
    if (Math.abs(t.clientY - st.y) > 10 || Math.abs(t.clientX - st.x) > 10) { clearTimeout(lpT); st = null; }
  }, { passive: false });

  function end() {
    clearTimeout(lpT);
    if (drag) { finishDrag(); sup = true; }
    st = null;
  }
  /* safety: never keep auto-scrolling once no finger is on the screen */
  window.addEventListener('touchend', function (e) { if (drag && (!e.touches || !e.touches.length)) { finishDrag(); sup = true; } }, true);
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
  el.addEventListener('scroll', function () { if (!drag) clearTimeout(lpT); }, { passive: true });
  el.addEventListener('click', function (e) { if (sup) { e.stopPropagation(); e.preventDefault(); sup = false; } }, true);
  el.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function dMove(e) { if (!drag) return; e.preventDefault(); if (e.touches && e.touches[0]) { drag.y = e.touches[0].clientY; place(); } }
  function dEnd() { if (drag) { finishDrag(); sup = true; } }
  function startDrag(i, y, target) {
    var host = el.parentNode, src = null, t = target;
    while (t && t !== el && !(t.getAttribute && t.getAttribute('data-i') !== null)) t = t.parentNode;
    if (t && t !== el && t.parentNode) src = t; else src = el.querySelector('[data-i="' + i + '"]');
    drag = { i: i, y: y, slot: i, timer: 0, ind: document.createElement('div'), ghost: null };
    drag.ind.className = 'vdrop';
    host.appendChild(drag.ind);
    if (src && src.parentNode) {
      src.parentNode.replaceChild(src.cloneNode(true), src);      /* a copy stays in the list */
      src.removeAttribute('data-i');
      src.className += ' vghost';
      src.style.position = 'absolute'; src.style.left = el.offsetLeft + 'px'; src.style.width = el.clientWidth + 'px'; src.style.height = g.itemH + 'px';
      host.appendChild(src); drag.ghost = src;                     /* the real touched node moves with the finger */
    }
    document.addEventListener('touchmove', dMove, { passive: false });
    document.addEventListener('touchend', dEnd);
    document.addEventListener('touchcancel', dEnd);
    el.classList.add('dragging');
    el.style.overflowY = 'hidden';
    drag.timer = setInterval(autoScroll, 16);
    place();
  }
  function yIn() { var r = el.getBoundingClientRect(); return (drag.y - r.top) / ((r.height / (el.offsetHeight || 1)) || 1); }
  function place() {
    if (!drag) return;
    var y = yIn(), R = g.R(), n = g.count();
    var slot = O.clamp(Math.round((y + el.scrollTop) / R), 0, Math.ceil(n / g.cols)) * g.cols;
    drag.slot = Math.min(slot, n);
    drag.ind.style.left = el.offsetLeft + 'px'; drag.ind.style.width = el.clientWidth + 'px';
    drag.ind.style.top = (el.offsetTop + (drag.slot / g.cols) * R - el.scrollTop - g.gap / 2 - 3) + 'px';
    if (drag.ghost) drag.ghost.style.top = (el.offsetTop + O.clamp(y, 0, el.clientHeight) - g.itemH / 2) + 'px';
  }
  /* gentle auto-scroll: only after the finger rests ~0.3s near the edge; speed grows with depth (max ~6 rows/s) */
  function autoScroll() {
    if (!drag) return;
    var y = yIn(), h = el.clientHeight, edge = 80, dir = 0, now = Date.now();
    if (y < edge) dir = -1; else if (y > h - edge) dir = 1;
    if (!dir) { drag.zoneT = 0; return; }
    if (!drag.zoneT) { drag.zoneT = now; return; }
    if (now - drag.zoneT < 300) return;
    var depth = dir < 0 ? edge - Math.max(y, 0) : Math.min(y, h) - (h - edge);
    var sp = 1.5 + 8.5 * O.clamp(depth / edge, 0, 1);
    var before = el.scrollTop;
    el.scrollTop += dir * sp;
    if (el.scrollTop !== before) { g.fill(false); place(); }
  }
  function finishDrag() {
    var d = drag; drag = null;
    clearInterval(d.timer);
    document.removeEventListener('touchmove', dMove, { passive: false });
    document.removeEventListener('touchend', dEnd);
    document.removeEventListener('touchcancel', dEnd);
    if (d.ind.parentNode) d.ind.parentNode.removeChild(d.ind);
    if (d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    el.classList.remove('dragging');
    el.style.overflowY = 'auto';
    if (g.onDrop) g.onDrop(d.slot);
  }
}
O.VGrid = VGrid;
})();
