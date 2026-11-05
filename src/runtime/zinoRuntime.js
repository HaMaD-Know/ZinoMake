/* ZinoMake preview runtime.
 * Injected into the sandboxed preview iframe before the user's code.
 * Provides the beginner-friendly functions that blocks generate (say, move, onStart, ...).
 * This file is plain JavaScript on purpose: it is inserted verbatim into the preview document.
 */
(function () {
  'use strict';
  var SOURCE = 'zinomake-preview';
  var running = true;
  var startHandlers = [];
  var timers = [];
  var keysDown = Object.create(null);
  var keyHandlers = [];
  var reportedMissing = Object.create(null);
  var lastYield = Date.now();
  var guardCount = 0;
  var audioCtx = null;
  var assets = window.__ZM_ASSETS || {};
  var homes = new WeakMap();
  var clickHandlers = [];
  var removed = Object.create(null);
  var mouse = { x: 0, y: 0 };
  var moving = [];          // elements with speed, gravity or bounce
  var copyCount = 0;
  var pressedEls = [];      // elements under a finger / mouse button right now
  var messageHandlers = [];
  var changeHandlers = [];
  var saved = window.__ZM_SAVED || {};
  // In the ZinoMake preview, saved values come from (and go back to) ZinoMake; in an exported page they live in localStorage.
  var standalone = !window.__ZM_SAVED && (function () { try { return window.parent === window; } catch (e) { return false; } })();
  if (standalone) { try { saved = JSON.parse(localStorage.getItem('zinomake-data') || '{}') || {}; } catch (e) { saved = {}; } }
  function persist(key, value) {
    if (standalone) { try { localStorage.setItem('zinomake-data', JSON.stringify(saved)); } catch (e) { /* storage full or blocked */ } }
    else post('save', { key: key, value: value === undefined ? null : value });
  }
  var screenHandlers = [];

  function post(type, data) {
    try {
      var msg = { source: SOURCE, type: type };
      for (var k in data) msg[k] = data[k];
      parent.postMessage(msg, '*');
    } catch (e) { /* ignore */ }
  }

  function text(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6);
    if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return String(v); } }
    return String(v);
  }

  // ---------- friendly errors ----------
  function friendly(err) {
    var m = (err && err.message) ? String(err.message) : String(err);
    var mm;
    if (m === 'ZM_STOPPED') return null;
    if (m === 'ZM_LOOP') return 'A loop ran for too long without a pause, so ZinoMake stopped it. Add a “wait” block inside the loop.';
    if ((mm = /^(\w+) is not defined/.exec(m))) return 'ZinoMake doesn’t know what “' + mm[1] + '” is. Check the spelling, or create it first.';
    if ((mm = /(\w+) is not a function/.exec(m))) return '“' + mm[1] + '” can’t be used like a block. Check the spelling.';
    if (/Maximum call stack/.test(m)) return 'A block keeps calling itself forever. Check your “My blocks”.';
    if (/Cannot read propert/.test(m)) return 'Something you used doesn’t exist yet: ' + m;
    return m;
  }
  function lineOf(err) {
    var st = err && err.stack ? String(err.stack) : '';
    var m = /main\.js:(\d+)/.exec(st);
    return m ? Math.max(1, Number(m[1]) - (window.__ZM_LINE_OFFSET || 0)) : null;
  }
  function reportError(err) {
    var f = friendly(err);
    if (!f) return;
    post('error', { message: f, technical: String(err && err.message ? err.message : err).slice(0, 500), line: lineOf(err) });
  }
  window.addEventListener('error', function (e) { reportError(e.error || e.message); });
  window.addEventListener('unhandledrejection', function (e) { reportError(e.reason); });

  // ---------- console capture ----------
  ['log', 'info', 'warn', 'error'].forEach(function (level) {
    var orig = console[level];
    console[level] = function () {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) parts.push(text(arguments[i]));
      post('log', { level: level, message: parts.join(' ').slice(0, 2000) });
      try { orig.apply(console, arguments); } catch (e) { /* ignore */ }
    };
  });

  // ---------- runaway loop guard (calls are inserted into loops before running) ----------
  setInterval(function () { lastYield = Date.now(); }, 50);
  window.__zmGuard = function () {
    if (!running) throw new Error('ZM_STOPPED');
    if (++guardCount % 2000 === 0 && Date.now() - lastYield > 3000) {
      running = false;
      throw new Error('ZM_LOOP');
    }
  };

  // ---------- elements ----------
  function find(name) {
    var n = String(name);
    var el = document.getElementById(n);
    if (!el) { try { el = document.querySelector('[data-name="' + n.replace(/"/g, '') + '"]'); } catch (e) { el = null; } }
    if (!el && !reportedMissing[n] && !removed[n]) {
      reportedMissing[n] = true;
      post('error', { message: 'There’s nothing called “' + n + '” on the page. Check the name in your block, or add it first with a “Make things” block.', line: null });
    }
    return el;
  }
  function home(el) {
    var h = homes.get(el);
    if (!h) { h = { tx: 0, ty: 0, display: '', rot: 0 }; homes.set(el, h); }
    return h;
  }
  function applyPos(el, h) { el.style.translate = h.tx + 'px ' + h.ty + 'px'; }
  function baseX(el) { return el.offsetLeft; }
  function baseY(el) { return el.offsetTop; }

  function checkRunning() { if (!running) throw new Error('ZM_STOPPED'); }

  // ---------- making things (blocks in the “Make things” category) ----------
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
  function px(v) { var s = text(v).trim(); return s !== '' && !isNaN(Number(s)) ? Number(s) + 'px' : s; }
  function findQuiet(name) {
    var n = String(name);
    var el = document.getElementById(n);
    if (!el) { try { el = document.querySelector('[data-name="' + n.replace(/"/g, '') + '"]'); } catch (e) { el = null; } }
    return el;
  }
  function pageBox() {
    return document.getElementById('page') || document.querySelector('main') || document.body;
  }
  function getStage() {
    return document.getElementById('stage') || document.querySelector('.stage');
  }
  function makeStage(w, h, color) {
    var st = getStage();
    if (!st) {
      st = document.createElement('div');
      st.id = 'stage';
      st.className = 'stage';
      st.style.cssText = 'position:relative;overflow:hidden;border-radius:14px;border:3px solid #1d2433;background:#bfe3ff;margin:0 auto;max-width:100%;';
      var box = pageBox();
      box.insertBefore(st, box.firstChild);
    }
    if (window.getComputedStyle(st).position === 'static') st.style.position = 'relative';
    if (w !== undefined) st.style.width = num(w, 360) + 'px';
    if (h !== undefined) st.style.height = num(h, 280) + 'px';
    if (color !== undefined && text(color)) st.style.background = text(color);
    return st;
  }
  function stage() { return getStage() || makeStage(360, 280); }
  /** Create (or re-create) a named thing. Adding a name again replaces the old one. */
  function make(name, tag, parent) {
    var n = String(name).trim() || 'thing';
    var old = findQuiet(n);
    if (old) old.remove();
    delete removed[n];
    delete reportedMissing[n];
    var el = document.createElement(tag);
    el.id = n;
    el.setAttribute('data-name', n);
    parent.appendChild(el);
    return el;
  }
  function onStage(name, tag, x, y, cls) {
    var el = make(name, tag, stage());
    el.className = cls;
    el.style.position = 'absolute';
    el.style.left = num(x, 0) + 'px';
    el.style.top = num(y, 0) + 'px';
    el.style.boxSizing = 'border-box';
    return el;
  }
  function bindKeyButton(el) {
    if (el.__zmKey) return;
    el.__zmKey = true;
    var k = el.getAttribute('data-key');
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } keyDown(k); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { el.addEventListener(t, function () { keyUp(k); }); });
  }


  // ---------- designed things (Design view): screens, “When tapped” actions, inputs ----------
  /** A designed text box is a <label> holding the real <input>; blocks use the label's name. */
  function control(el) {
    if (!el) return el;
    if (/^(INPUT|SELECT|TEXTAREA|PROGRESS)$/.test(el.tagName)) return el;
    var inner = el.querySelector && el.querySelector('input, select, textarea, progress');
    return inner || el;
  }
  function screens() { return Array.prototype.slice.call(document.querySelectorAll('.zm-screen[data-screen]')); }
  var currentScreen = null;
  function showScreen(name, announce) {
    var list = screens();
    var target = null;
    list.forEach(function (s) { if (s.getAttribute('data-screen') === name) target = s; });
    if (!target) {
      if (!reportedMissing['screen:' + name]) {
        reportedMissing['screen:' + name] = true;
        post('error', { message: 'There’s no screen called “' + name + '”. Check the name in the Design view.', line: null });
      }
      return;
    }
    list.forEach(function (s) { s.hidden = s !== target; });
    currentScreen = name;
    Array.prototype.forEach.call(document.querySelectorAll('[data-zm-tap="screen"]'), function (b) {
      b.classList.toggle('zm-active', b.getAttribute('data-zm-value') === name);
    });
    if (announce) { try { window.scrollTo(0, 0); } catch (e) { /* ignore */ } }
    if (announce) screenHandlers.forEach(function (h) { if (h.name === name) run(h.fn); });
  }
  function tapAction(el) {
    var kind = el.getAttribute('data-zm-tap'), v = el.getAttribute('data-zm-value') || '';
    if (kind === 'screen') showScreen(v, true);
    else if (kind === 'say') api.say(v);
    else if (kind === 'sound') api.playSound(v || 'beep');
    else if (kind === 'link') {
      var w = null;
      try { w = window.open(v, '_blank', 'noopener'); } catch (e) { w = null; }
      if (!w) post('log', { level: 'warn', message: 'Links open in your exported web page. The preview stays offline to keep you safe.' });
    }
  }
  function changed(e) {
    if (!running) return;
    var t = e.target;
    var isPick = t && (t.type === 'checkbox' || t.tagName === 'SELECT');
    if ((e.type === 'change') !== !!isPick) return; // text and sliders: every change; ticks and dropdowns: once
    var under = chain(t);
    changeHandlers.forEach(function (h) {
      for (var i = 0; i < under.length; i++) if (isThing(under[i], h.name)) { run(h.fn); return; }
    });
  }

  // ---------- groups: a thing plus all its copies ----------
  function q(v) { return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }
  function isThing(el, name) {
    return !!el && el.nodeType === 1 && (el.id === name || el.getAttribute('data-group') === name);
  }
  /** The thing called `name` and every copy of it. */
  function all(name) {
    var n = String(name);
    var list = [];
    var el = findQuiet(n);
    if (el) list.push(el);
    try { Array.prototype.forEach.call(document.querySelectorAll('[data-group="' + q(n) + '"]'), function (c) { if (list.indexOf(c) < 0) list.push(c); }); } catch (e) { /* ignore */ }
    if (!list.length) find(n); // reports a friendly “nothing called …” once
    return list;
  }
  function visible(el) { return el.isConnected && el.style.display !== 'none' && el.getClientRects().length > 0; }
  function overlap(ra, rb) { return ra.left < rb.right && ra.right > rb.left && ra.top < rb.bottom && ra.bottom > rb.top; }
  function stageRect() {
    var st = getStage();
    if (!st) return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    var r = st.getBoundingClientRect();
    var l = r.left + st.clientLeft, t = r.top + st.clientTop;
    return { left: l, top: t, right: l + st.clientWidth, bottom: t + st.clientHeight };
  }

  // ---------- speed, gravity, bounce (runs every frame while playing) ----------
  function phys(el) {
    var h = home(el);
    if (!h.phys) { h.phys = { vx: 0, vy: 0, g: 0, bounce: false }; moving.push(el); }
    return h.phys;
  }
  var lastTick = 0;
  function tick(now) {
    if (!running) return;
    var dt = lastTick ? Math.min(3, (now - lastTick) / (1000 / 60)) : 1;
    lastTick = now;
    var sr = null;
    for (var i = moving.length - 1; i >= 0; i--) {
      var el = moving[i];
      if (!el.isConnected) { moving.splice(i, 1); continue; }
      var h = home(el), p = h.phys;
      p.vy += p.g * dt;
      if (p.vx || p.vy) { h.tx += p.vx * dt; h.ty += p.vy * dt; applyPos(el, h); }
      if (!p.bounce && !el.classList.contains('zm-copy')) continue;
      if (!visible(el)) continue;
      sr = sr || stageRect();
      var r = el.getBoundingClientRect();
      if (p.bounce) {
        if (r.left < sr.left && p.vx < 0) { p.vx = -p.vx; h.tx += sr.left - r.left; }
        if (r.right > sr.right && p.vx > 0) { p.vx = -p.vx; h.tx -= r.right - sr.right; }
        if (r.top < sr.top && p.vy < 0) { p.vy = -p.vy; h.ty += sr.top - r.top; }
        if (r.bottom > sr.bottom && p.vy > 0) { p.vy = -p.vy * (p.g ? 0.8 : 1); h.ty -= r.bottom - sr.bottom; }
        applyPos(el, h);
      } else if (r.right < sr.left - 20 || r.left > sr.right + 600 || r.top > sr.bottom + 400 || r.bottom < sr.top - 400) {
        el.remove(); // copies that leave the stage tidy themselves up
      }
    }
    requestAnimationFrame(tick);
  }

  var cursorStyle = null;
  function pointerCursor(name) {
    try {
      if (!cursorStyle) { cursorStyle = document.createElement('style'); document.head.appendChild(cursorStyle); }
      var n = String(name);
      var sel = (window.CSS && CSS.escape) ? '#' + CSS.escape(n) : '[id="' + n.replace(/"/g, '') + '"]';
      cursorStyle.textContent += sel + ',[data-name="' + q(n) + '"],[data-group="' + q(n) + '"]{cursor:pointer}\n';
    } catch (e) { /* cosmetic only */ }
  }

  var api = {
    saveValue: function (key, value) {
      checkRunning();
      var k = String(key).slice(0, 100);
      var v = typeof value === 'number' || typeof value === 'boolean' ? value : text(value).slice(0, 20000);
      saved[k] = v;
      persist(k, v);
    },
    loadValue: function (key) { var v = saved[String(key)]; return v === undefined || v === null ? '' : v; },
    forgetSaved: function () {
      checkRunning();
      var keys = Object.keys(saved);
      saved = {};
      if (standalone) persist(); else keys.forEach(function (k) { post('save', { key: k, value: null }); });
    },
    addItem: function (target, value) {
      checkRunning();
      var el = find(target); if (!el) return;
      var li = document.createElement(/^(UL|OL)$/.test(el.tagName) ? 'li' : 'div');
      li.textContent = text(value);
      el.appendChild(li);
    },
    removeItem: function (target, index) {
      checkRunning();
      var el = find(target); if (!el) return;
      var kids = el.children, i = Math.round(num(index, 1)) - 1;
      if (i >= 0 && i < kids.length) kids[i].remove();
    },
    clearItems: function (target) { checkRunning(); var el = find(target); if (el) el.innerHTML = ''; },
    countItems: function (target) { var el = find(target); return el ? el.children.length : 0; },
    itemsOf: function (target) {
      var el = find(target); if (!el) return '';
      return Array.prototype.map.call(el.children, function (c) { return c.textContent; }).join('\n');
    },
    setItems: function (target, value) {
      checkRunning();
      var el = find(target); if (!el) return;
      el.innerHTML = '';
      text(value).split('\n').forEach(function (line) { if (line.trim()) api.addItem(target, line); });
    },
    setSpeed: function (target, vx, vy) {
      checkRunning();
      var el = find(target); if (!el) return;
      var p = phys(el); p.vx = num(vx, 0); p.vy = num(vy, 0);
    },
    setGravity: function (target, g) { checkRunning(); var el = find(target); if (el) phys(el).g = num(g, 0); },
    bounceOnEdges: function (target) { checkRunning(); var el = find(target); if (el) phys(el).bounce = true; },
    getSpeedY: function (target) { var el = findQuiet(target); var h = el && homes.get(el); return h && h.phys ? Math.round(h.phys.vy * 100) / 100 : 0; },
    touchingEdge: function (target) {
      var el = find(target); if (!el || !visible(el)) return false;
      var r = el.getBoundingClientRect(), s = stageRect();
      return r.left <= s.left || r.right >= s.right || r.top <= s.top || r.bottom >= s.bottom;
    },
    setAngle: function (target, degrees) {
      checkRunning();
      var el = find(target); if (!el) return;
      var h = home(el); h.rot = num(degrees, 0); el.style.rotate = h.rot + 'deg';
    },
    makeCopy: function (target, x, y) {
      checkRunning();
      var n = String(target);
      var orig = find(n); if (!orig) return;
      var c = orig.cloneNode(true);
      var cs = window.getComputedStyle(orig);
      ['width', 'height', 'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundRepeat', 'backgroundPosition', 'borderRadius', 'color', 'fontSize', 'lineHeight'].forEach(function (prop) {
        if (!c.style[prop] && cs[prop] && cs[prop] !== 'auto') c.style[prop] = cs[prop];
      });
      copyCount += 1;
      c.id = n + '-copy-' + copyCount;
      c.setAttribute('data-name', c.id);
      c.setAttribute('data-group', n);
      c.classList.add('zm-copy');
      c.style.position = 'absolute';
      c.style.left = num(x, 0) + 'px';
      c.style.top = num(y, 0) + 'px';
      c.style.translate = '';
      var oh = home(orig);
      c.style.display = oh.display || '';
      (orig.parentElement || stage()).appendChild(c);
      var ch = home(c);
      ch.rot = oh.rot;
      if (oh.phys) { var p = phys(c); p.vx = oh.phys.vx; p.vy = oh.phys.vy; p.g = oh.phys.g; p.bounce = oh.phys.bounce; }
      else phys(c); // so it is tidied up when it leaves the stage
    },
    removeCopies: function (target) {
      checkRunning();
      try { Array.prototype.forEach.call(document.querySelectorAll('[data-group="' + q(String(target)) + '"]'), function (c) { c.remove(); }); } catch (e) { /* ignore */ }
    },
    isPressed: function (target) {
      var n = String(target);
      for (var i = 0; i < pressedEls.length; i++) if (isThing(pressedEls[i], n)) return true;
      return false;
    },
    sendMessage: function (message) {
      checkRunning();
      var m = String(message);
      messageHandlers.forEach(function (h) { if (h.msg === m) run(h.fn); });
    },
    onMessage: function (message, fn) { messageHandlers.push({ msg: String(message), fn: fn }); },
    setStage: function (w, h, color) { checkRunning(); makeStage(w, h, color); },
    addCharacter: function (name, look, x, y, size) {
      checkRunning();
      var el = onStage(name, 'div', x, y, 'zm-thing zm-character');
      var s = num(size, 48);
      el.textContent = text(look);
      el.style.fontSize = s + 'px';
      el.style.lineHeight = '1';
      el.style.whiteSpace = 'nowrap';
      el.style.userSelect = 'none';
    },
    addBox: function (name, x, y, w, h, color) {
      checkRunning();
      var el = onStage(name, 'div', x, y, 'sprite zm-thing');
      el.style.width = num(w, 60) + 'px';
      el.style.height = num(h, 40) + 'px';
      el.style.backgroundColor = text(color);
      el.style.borderRadius = '8px';
    },
    addCircle: function (name, x, y, size, color) {
      checkRunning();
      var el = onStage(name, 'div', x, y, 'sprite zm-thing');
      var s = num(size, 40);
      el.style.width = s + 'px';
      el.style.height = s + 'px';
      el.style.backgroundColor = text(color);
      el.style.borderRadius = '50%';
    },
    addPicture: function (name, assetName, x, y, size) {
      checkRunning();
      var url = assets[String(assetName)];
      var el = onStage(name, url ? 'img' : 'div', x, y, 'zm-thing zm-picture');
      el.style.width = num(size, 80) + 'px';
      if (url) { el.src = url; el.alt = String(name); el.draggable = false; }
      else {
        el.style.height = num(size, 80) + 'px';
        el.style.background = '#e9ecef';
        el.style.border = '2px dashed #868e96';
        post('error', { message: 'The picture “' + assetName + '” could not be found. Add it in Pictures & sounds, or choose another picture.', line: null });
      }
    },
    addLabel: function (name, words, x, y, size) {
      checkRunning();
      var el = onStage(name, 'div', x, y, 'zm-thing zm-label');
      el.textContent = text(words);
      el.style.fontSize = num(size, 20) + 'px';
      el.style.fontWeight = '700';
      el.style.whiteSpace = 'nowrap';
    },
    addTitle: function (name, words) { checkRunning(); make(name, 'h1', pageBox()).textContent = text(words); },
    addParagraph: function (name, words) { checkRunning(); make(name, 'p', pageBox()).textContent = text(words); },
    addButton: function (name, words) { checkRunning(); var el = make(name, 'button', pageBox()); el.type = 'button'; el.textContent = text(words); },
    addInput: function (name, hint) { checkRunning(); var el = make(name, 'input', pageBox()); el.type = 'text'; el.placeholder = text(hint); },
    addArrowButtons: function () {
      checkRunning();
      var pad = make('arrow-buttons', 'div', pageBox());
      pad.className = 'pad';
      pad.style.cssText = 'display:flex;gap:8px;justify-content:center;margin:10px auto;';
      [['ArrowLeft', '◀', 'Left'], ['ArrowUp', '▲', 'Up'], ['ArrowDown', '▼', 'Down'], ['ArrowRight', '▶', 'Right']].forEach(function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-key', b[0]);
        btn.setAttribute('aria-label', b[2]);
        btn.textContent = b[1];
        btn.style.cssText = 'font-size:22px;width:56px;height:48px;border-radius:12px;border:2px solid #1d2433;background:#fff;color:#1d2433;';
        pad.appendChild(btn);
        bindKeyButton(btn);
      });
    },
    removeThing: function (target) {
      checkRunning();
      var n = String(target);
      var el = findQuiet(n);
      removed[n] = true;
      if (el) el.remove();
    },
    turnBy: function (target, degrees) {
      checkRunning();
      var el = find(target); if (!el) return;
      var h = home(el); h.rot = (h.rot + num(degrees, 0)) % 360; el.style.rotate = h.rot + 'deg';
    },
    getMouseX: function () { var st = getStage(); return Math.round(st ? mouse.x - st.getBoundingClientRect().left - st.clientLeft : mouse.x); },
    getMouseY: function () { var st = getStage(); return Math.round(st ? mouse.y - st.getBoundingClientRect().top - st.clientTop : mouse.y); },
    setSize: function (target, w, h) {
      checkRunning();
      var el = find(target); if (!el) return;
      if (el.classList.contains('zm-character') || el.classList.contains('zm-label')) { el.style.fontSize = num(h, 48) + 'px'; return; }
      el.style.width = num(w, 60) + 'px';
      el.style.height = num(h, 60) + 'px';
      if (el.tagName === 'IMG') el.style.objectFit = 'fill';
    },
    setStyle: function (target, style, value) {
      checkRunning();
      var el = find(target); if (!el) return;
      var v = text(value);
      switch (String(style)) {
        case 'fill': el.style.backgroundColor = v; break;
        case 'textColor': el.style.color = v; break;
        case 'textSize': el.style.fontSize = px(v); break;
        case 'roundness': el.style.borderRadius = px(v); break;
        case 'border': el.style.border = v ? '3px solid ' + v : 'none'; break;
        case 'seeThrough': el.style.opacity = String(Math.max(0, Math.min(100, 100 - num(value, 0))) / 100); break;
        case 'layer': el.style.zIndex = String(Math.round(num(value, 0))); if (window.getComputedStyle(el).position === 'static') el.style.position = 'relative'; break;
        case 'font': el.style.fontFamily = v; break;
        default: break;
      }
    },
    roundNumber: function (v) { return Math.round(num(v, 0)); },
    say: function (message) {
      checkRunning();
      var t = text(message);
      post('say', { message: t.slice(0, 500) });
      var box = document.getElementById('__zm_say');
      if (!box) {
        box = document.createElement('div');
        box.id = '__zm_say';
        box.setAttribute('role', 'status');
        box.setAttribute('aria-live', 'polite');
        box.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);max-width:90%;background:#fff;color:#1d2433;border:2px solid #1d2433;border-radius:16px;padding:8px 14px;font:600 16px/1.3 system-ui,sans-serif;box-shadow:0 4px 0 rgba(0,0,0,.15);z-index:2147483647;pointer-events:none;text-align:center;';
        document.body.appendChild(box);
      }
      box.textContent = t;
      box.style.display = t ? 'block' : 'none';
    },
    setText: function (target, value) { checkRunning(); var el = find(target); if (el) el.textContent = text(value); },
    move: function (target, dx, dy) {
      checkRunning();
      var el = find(target); if (!el) return;
      var h = home(el); h.tx += Number(dx) || 0; h.ty += Number(dy) || 0; applyPos(el, h);
    },
    moveTo: function (target, x, y) {
      checkRunning();
      var el = find(target); if (!el) return;
      var h = home(el); h.tx = (Number(x) || 0) - baseX(el); h.ty = (Number(y) || 0) - baseY(el); applyPos(el, h);
    },
    getX: function (target) { var el = find(target); return el ? Math.round(baseX(el) + home(el).tx) : 0; },
    getY: function (target) { var el = find(target); return el ? Math.round(baseY(el) + home(el).ty) : 0; },
    touching: function (a, b) {
      // Each side may be a thing with copies: true if any one of them overlaps any other.
      var la = all(a).filter(visible), lb = all(b).filter(visible);
      for (var i = 0; i < la.length; i++) {
        var ra = la[i].getBoundingClientRect();
        for (var j = 0; j < lb.length; j++) if (la[i] !== lb[j] && overlap(ra, lb[j].getBoundingClientRect())) return true;
      }
      return false;
    },
    setColor: function (target, color) {
      checkRunning();
      var el = find(target); if (!el) return;
      var useBg = el.classList.contains('sprite') || el.tagName === 'BUTTON' || !el.textContent.trim();
      if (useBg) el.style.backgroundColor = text(color); else el.style.color = text(color);
    },
    setBackground: function (color) {
      checkRunning();
      var stage = document.getElementById('stage') || document.querySelector('.stage') || document.body;
      stage.style.background = text(color);
    },
    setImage: function (target, assetName) {
      checkRunning();
      var el = find(target); if (!el) return;
      var url = assets[String(assetName)];
      if (!url) { post('error', { message: 'The picture “' + assetName + '” could not be loaded. Add it in Assets, or choose another picture.', line: null }); return; }
      if (el.tagName === 'IMG') { el.src = url; return; }
      if (el.classList.contains('zm-placeholder')) {
        // An empty Picture from the Design view: turn it into a real picture (no border, no hint text).
        var img = document.createElement('img');
        Array.prototype.forEach.call(el.attributes, function (a) { img.setAttribute(a.name, a.value); });
        img.classList.remove('zm-placeholder');
        img.alt = el.getAttribute('data-name') || '';
        img.draggable = false;
        img.src = url;
        var h = homes.get(el);
        if (h) homes.set(img, h);
        el.parentNode.replaceChild(img, el);
        return;
      }
      { el.style.backgroundImage = 'url("' + url + '")'; el.style.backgroundSize = 'contain'; el.style.backgroundRepeat = 'no-repeat'; el.style.backgroundPosition = 'center'; el.style.backgroundColor = 'transparent'; }
    },
    show: function (target) { checkRunning(); var el = find(target); if (el) { el.style.display = home(el).display; } },
    hide: function (target) {
      checkRunning();
      var el = find(target); if (!el) return;
      var h = home(el); if (el.style.display !== 'none') h.display = el.style.display; el.style.display = 'none';
    },
    playSound: function (name) {
      checkRunning();
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtx = audioCtx || new AC();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        var presets = {
          beep: [[660, 0, 0.12]], coin: [[988, 0, 0.08], [1319, 0.08, 0.2]], jump: [[300, 0, 0.05], [600, 0.05, 0.12]],
          hit: [[140, 0, 0.18]], win: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.25]], lose: [[392, 0, 0.18], [262, 0.18, 0.35]]
        };
        var notes = presets[String(name)] || presets.beep;
        var now = audioCtx.currentTime;
        notes.forEach(function (n) {
          var o = audioCtx.createOscillator(), g = audioCtx.createGain();
          o.type = name === 'hit' ? 'sawtooth' : 'square';
          o.frequency.value = n[0];
          g.gain.setValueAtTime(0.08, now + n[1]);
          g.gain.exponentialRampToValueAtTime(0.0001, now + n[1] + n[2]);
          o.connect(g); g.connect(audioCtx.destination);
          o.start(now + n[1]); o.stop(now + n[1] + n[2] + 0.02);
        });
      } catch (e) { /* sound is optional */ }
    },
    playAudio: function (assetName) {
      checkRunning();
      var url = assets[String(assetName)];
      if (!url) { post('error', { message: 'The audio file “' + assetName + '” could not be found. Add it in Assets.', line: null }); return; }
      try { var a = new Audio(url); a.play().catch(function () { post('log', { level: 'warn', message: 'Click or tap the preview first to allow sound.' }); }); } catch (e) { /* ignore */ }
    },
    wait: function (seconds) {
      checkRunning();
      var ms = Math.max(0, (Number(seconds) || 0) * 1000);
      return new Promise(function (resolve, reject) {
        var id = setTimeout(function () { running ? resolve() : reject(new Error('ZM_STOPPED')); }, ms);
        timers.push(id);
      });
    },
    random: function (from, to) {
      var a = Number(from) || 0, b = Number(to) || 0;
      if (a > b) { var t = a; a = b; b = t; }
      if (Number.isInteger(a) && Number.isInteger(b)) return a + Math.floor(Math.random() * (b - a + 1));
      return a + Math.random() * (b - a);
    },
    join: function (a, b) { return text(a) + text(b); },
    getValue: function (target) {
      var el = control(find(target)); if (!el) return '';
      if (el.type === 'checkbox') return !!el.checked;
      var v = 'value' in el ? el.value : el.textContent;
      var s = String(v == null ? '' : v);
      return s.trim() !== '' && !isNaN(Number(s)) ? Number(s) : s;
    },
    setValue: function (target, value) {
      checkRunning();
      var el = control(find(target)); if (!el) return;
      if (el.type === 'checkbox') el.checked = value === true || value === 'true' || value === 1;
      else if ('value' in el && el.tagName !== 'BUTTON' && el.tagName !== 'LI') el.value = text(value);
      else el.textContent = text(value);
    },
    onChange: function (target, fn) { changeHandlers.push({ name: String(target), fn: fn }); },
    goToScreen: function (name) { checkRunning(); showScreen(String(name), true); },
    onScreen: function (name, fn) { screenHandlers.push({ name: String(name), fn: fn }); },
    isKeyDown: function (key) { return !!keysDown[String(key)]; },
    onStart: function (fn) { startHandlers.push(fn); },
    onClick: function (target, fn) {
      // Delegated, so it also works for things made later by “Make things” blocks.
      clickHandlers.push({ name: String(target), fn: fn });
      pointerCursor(target);
    },
    onKey: function (key, fn) { keyHandlers.push({ key: String(key), fn: fn }); },
    every: function (seconds, fn) {
      var busy = false;
      var id = setInterval(function () {
        if (!running || busy) return;
        busy = true;
        Promise.resolve(run(fn)).then(function () { busy = false; });
      }, Math.max(16, (Number(seconds) || 1) * 1000));
      timers.push(id);
    },
    forever: function (fn) {
      (async function loop() {
        while (running) {
          try { await fn(); } catch (e) { if (e && e.message !== 'ZM_STOPPED') reportError(e); return; }
          await new Promise(function (r) { requestAnimationFrame(function () { r(); }); });
        }
      })();
    },
    stop: function () { stopAll(); },
    log: function () { console.log.apply(console, arguments); }
  };

  function run(fn) {
    try {
      var r = fn();
      if (r && typeof r.then === 'function') return r.catch(function (e) { reportError(e); });
      return r;
    } catch (e) { reportError(e); }
  }

  function normKey(k) { return k === ' ' ? 'Space' : (k.length === 1 ? k.toLowerCase() : k); }
  function keyDown(k) {
    if (!running) return;
    var first = !keysDown[k];
    keysDown[k] = true;
    if (first) keyHandlers.forEach(function (h) { if (h.key === k) run(h.fn); });
  }
  function keyUp(k) { keysDown[k] = false; }
  window.addEventListener('keydown', function (e) {
    var k = normKey(e.key);
    if (/^Arrow|^Space$/.test(k) && !(e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) e.preventDefault();
    if (e.repeat) { keyHandlers.forEach(function (h) { if (h.key === k && running) run(h.fn); }); return; }
    keyDown(k);
  });
  window.addEventListener('keyup', function (e) { keyUp(normKey(e.key)); });
  window.addEventListener('blur', function () { keysDown = Object.create(null); });

  // On-screen buttons: <button data-key="ArrowLeft"> behave like keyboard keys (for phones and tablets).
  function bindTouchKeys() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-key]'), bindKeyButton);
  }

  function chain(start) {
    var list = [];
    for (var el = start; el && el.nodeType === 1; el = el.parentElement) list.push(el);
    return list;
  }
  document.addEventListener('input', changed);
  document.addEventListener('change', changed);
  document.addEventListener('click', function (e) {
    if (!running) return;
    var under = chain(e.target);
    for (var t = 0; t < under.length; t++) {
      if (under[t].hasAttribute && under[t].hasAttribute('data-zm-tap')) {
        if (under[t].tagName === 'A') e.preventDefault();
        tapAction(under[t]);
        break;
      }
    }
    clickHandlers.forEach(function (h) {
      for (var i = 0; i < under.length; i++) if (isThing(under[i], h.name)) { run(h.fn); return; }
    });
  });
  document.addEventListener('pointerdown', function (e) { pressedEls = chain(e.target); }, true);
  ['pointerup', 'pointercancel'].forEach(function (t) { document.addEventListener(t, function () { pressedEls = []; }, true); });
  window.addEventListener('blur', function () { pressedEls = []; });
  ['pointermove', 'pointerdown'].forEach(function (t) {
    document.addEventListener(t, function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, true);
  });
  function checkClickTargets() {
    clickHandlers.forEach(function (h) { if (!findQuiet(h.name)) find(h.name); });
  }

  function stopAll() {
    running = false;
    timers.forEach(function (t) { clearTimeout(t); clearInterval(t); });
    timers = [];
    post('stopped', {});
  }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (e.source !== parent || !d || d.source !== 'zinomake-host') return;
    if (d.type === 'stop') stopAll();
  });

  document.addEventListener('pointerdown', function () {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }, true);

  window.__zm = {
    api: api,
    reportError: reportError,
    start: function () {
      bindTouchKeys();
      post('started', {});
      var first = screens()[0];
      if (first) showScreen(first.getAttribute('data-screen'), false);
      requestAnimationFrame(tick);
      startHandlers.forEach(function (fn) { run(fn); });
      if (currentScreen) screenHandlers.forEach(function (h) { if (h.name === currentScreen) run(h.fn); });
      // Things can be made by blocks after Play, so only warn about unknown click names a moment later.
      timers.push(setTimeout(function () { if (running) checkClickTargets(); }, 1500));
    }
  };
  for (var name in api) window[name] = api[name];
  post('ready', {});
})();
