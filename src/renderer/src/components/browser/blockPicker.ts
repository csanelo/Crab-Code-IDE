/**
 * Script injected into the <webview> page to give the user a Cursor-like
 * element picker: hovering highlights a block with a blue overlay, clicking
 * captures that block's real source (outerHTML + the computed CSS of the
 * element and its children) so the model can reproduce it pixel for pixel.
 *
 * The script keeps picked blocks in a queue on `window.__crabPicker`; the panel
 * drains that queue with executeJavaScript.
 */
export const PICKER_SCRIPT = String.raw`(() => {
  if (window.__crabPicker) { window.__crabPicker.enable(); return 'ok'; }

  var PROPS = [
    'display','position','box-sizing','width','height','min-width','min-height','max-width','max-height',
    'margin','padding','border','border-radius','outline','box-shadow','background','background-color',
    'background-image','background-size','background-position','color','font-family','font-size',
    'font-weight','font-style','line-height','letter-spacing','text-align','text-transform','text-decoration',
    'white-space','opacity','overflow','flex-direction','flex-wrap','align-items','justify-content','gap',
    'grid-template-columns','grid-template-rows','transform','transition','z-index','cursor','list-style'
  ];

  var overlay = document.createElement('div');
  overlay.setAttribute('data-crab-picker', 'overlay');
  overlay.style.cssText = [
    'position:fixed','z-index:2147483646','pointer-events:none','display:none',
    'background:rgba(56,139,253,0.22)','outline:2px solid #58a6ff','outline-offset:-1px',
    'border-radius:3px','box-shadow:0 0 0 9999px rgba(0,0,0,0.04)'
  ].join(';');

  var badge = document.createElement('div');
  badge.setAttribute('data-crab-picker', 'badge');
  badge.style.cssText = [
    'position:fixed','z-index:2147483647','pointer-events:none','display:none',
    'padding:2px 6px','border-radius:4px','background:#1f6feb','color:#fff',
    'font:500 11px/1.4 ui-sans-serif,system-ui,sans-serif','white-space:nowrap'
  ].join(';');

  var state = { on: false, queue: [], count: 0, target: null };

  function isOwn(el) {
    return !el || el === overlay || el === badge || (el.getAttribute && el.getAttribute('data-crab-picker'));
  }

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return '#' + el.id;
    var parts = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 5) {
      var part = node.tagName.toLowerCase();
      if (node.classList && node.classList.length) {
        part += '.' + Array.prototype.slice.call(node.classList, 0, 3).join('.');
      }
      var parent = node.parentElement;
      if (parent) {
        var same = Array.prototype.filter.call(parent.children, function (c) { return c.tagName === node.tagName; });
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      if (node.id) { parts[0] = '#' + node.id; break; }
      node = parent;
      depth++;
    }
    return parts.join(' > ');
  }

  function rulesFor(el, label) {
    var cs = window.getComputedStyle(el);
    var lines = [];
    for (var i = 0; i < PROPS.length; i++) {
      var v = cs.getPropertyValue(PROPS[i]);
      if (!v) continue;
      if (v === 'none' || v === 'normal' || v === 'auto' || v === '0px' || v === 'static') continue;
      lines.push('  ' + PROPS[i] + ': ' + v + ';');
    }
    if (!lines.length) return '';
    return label + ' {\n' + lines.join('\n') + '\n}';
  }

  function collectCss(root) {
    var blocks = [rulesFor(root, selectorFor(root) || root.tagName.toLowerCase())];
    var kids = root.querySelectorAll('*');
    var limit = Math.min(kids.length, 60);
    for (var i = 0; i < limit; i++) {
      var k = kids[i];
      var label = k.tagName.toLowerCase() + (k.classList && k.classList.length ? '.' + Array.prototype.slice.call(k.classList, 0, 3).join('.') : ':nth-child(' + (i + 1) + ')');
      var css = rulesFor(k, label);
      if (css) blocks.push(css);
    }
    if (kids.length > limit) blocks.push('/* ' + (kids.length - limit) + ' more descendants omitted */');
    return blocks.filter(Boolean).join('\n\n');
  }

  function fonts() {
    var cs = window.getComputedStyle(document.body);
    return 'body { font-family: ' + cs.fontFamily + '; font-size: ' + cs.fontSize + '; color: ' + cs.color + '; background: ' + cs.backgroundColor + '; }';
  }

  function place(el) {
    var r = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.left = r.left + 'px';
    overlay.style.top = r.top + 'px';
    overlay.style.width = r.width + 'px';
    overlay.style.height = r.height + 'px';
    badge.style.display = 'block';
    badge.textContent = el.tagName.toLowerCase() + (el.classList && el.classList.length ? '.' + el.classList[0] : '') + '  ' + Math.round(r.width) + 'x' + Math.round(r.height);
    var top = r.top - 20;
    badge.style.left = Math.max(2, r.left) + 'px';
    badge.style.top = (top < 2 ? r.top + 2 : top) + 'px';
  }

  function onMove(e) {
    if (!state.on) return;
    var el = e.target;
    if (isOwn(el) || !el || el.nodeType !== 1) return;
    state.target = el;
    place(el);
  }

  function onClick(e) {
    if (!state.on) return;
    e.preventDefault();
    e.stopPropagation();
    var el = state.target || e.target;
    if (!el || el.nodeType !== 1) return;
    var r = el.getBoundingClientRect();
    state.count += 1;
    state.queue.push({
      index: state.count,
      url: location.href,
      title: document.title,
      selector: selectorFor(el),
      tag: el.tagName.toLowerCase(),
      width: Math.round(r.width),
      height: Math.round(r.height),
      html: (el.outerHTML || '').slice(0, 40000),
      css: (fonts() + '\n\n' + collectCss(el)).slice(0, 40000),
      text: (el.innerText || '').trim().slice(0, 4000)
    });
    var flash = overlay.style.background;
    overlay.style.background = 'rgba(56,139,253,0.45)';
    setTimeout(function () { overlay.style.background = flash; }, 140);
  }

  function onKey(e) {
    if (e.key === 'Escape') window.__crabPicker.disable();
  }

  function enable() {
    if (state.on) return;
    state.on = true;
    if (!overlay.isConnected) document.documentElement.appendChild(overlay);
    if (!badge.isConnected) document.documentElement.appendChild(badge);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    document.documentElement.style.cursor = 'crosshair';
  }

  function disable() {
    state.on = false;
    overlay.style.display = 'none';
    badge.style.display = 'none';
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    document.documentElement.style.cursor = '';
  }

  window.__crabPicker = {
    enable: enable,
    disable: disable,
    isOn: function () { return state.on; },
    take: function () { var q = state.queue; state.queue = []; return q; },
    reset: function () { state.count = 0; state.queue = []; }
  };
  enable();
  return 'ok';
})()`

export const PICKER_TAKE = String.raw`(() => {
  if (!window.__crabPicker) return '[]';
  return JSON.stringify(window.__crabPicker.take());
})()`

export const PICKER_DISABLE = String.raw`(() => {
  if (window.__crabPicker) window.__crabPicker.disable();
  if (window.__crabArea) window.__crabArea.disable();
  return 'ok';
})()`

export const PICKER_WHOLE_PAGE = String.raw`(() => {
  var url = location.href;
  var title = document.title || '';
  var html = document.documentElement.outerHTML.slice(0, 120000);
  var text = (document.body ? document.body.innerText : '').slice(0, 8000);
  var css = '';
  try {
    var sheets = Array.from(document.styleSheets);
    for (var i = 0; i < sheets.length; i++) {
      try {
        var rules = Array.from(sheets[i].cssRules || []);
        css += rules.map(function(r){ return r.cssText; }).join('\n');
        if (css.length > 60000) { css = css.slice(0, 60000); break; }
      } catch(e) {}
    }
  } catch(e) {}
  return JSON.stringify([{ tag: 'page', selector: 'html', url: url, title: title, html: html, css: css, text: text }]);
})()`

export const PICKER_AREA_SCRIPT = String.raw`(() => {
  if (window.__crabArea && window.__crabArea.active) return 'ok';
  var queue = [];
  var startX = 0, startY = 0;
  var rect = null;
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #5b9dff;background:rgba(91,157,255,0.12);z-index:2147483647;display:none;';
  document.body.appendChild(box);
  function onDown(e) {
    startX = e.clientX; startY = e.clientY;
    box.style.display = 'block';
    box.style.left = startX+'px'; box.style.top = startY+'px';
    box.style.width = '0'; box.style.height = '0';
    e.stopPropagation();
  }
  function onMove(e) {
    var x = Math.min(e.clientX, startX), y = Math.min(e.clientY, startY);
    var w = Math.abs(e.clientX - startX), h = Math.abs(e.clientY - startY);
    box.style.left=x+'px'; box.style.top=y+'px';
    box.style.width=w+'px'; box.style.height=h+'px';
    rect = {x:x, y:y, w:w, h:h};
    e.stopPropagation();
  }
  function onUp(e) {
    box.style.display = 'none';
    if (!rect || rect.w < 5 || rect.h < 5) { rect = null; e.stopPropagation(); return; }
    var r = rect; rect = null;
    var url = location.href; var title = document.title || '';
    var elements = document.elementsFromPoint(r.x + r.w/2, r.y + r.h/2);
    var html = ''; var text = '';
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      if (el === box || el === document.body || el === document.documentElement) continue;
      html = el.outerHTML.slice(0, 50000);
      text = (el.innerText || '').slice(0, 4000);
      break;
    }
    var css = '';
    queue.push({ tag: 'area', selector: 'selection', url: url, title: title, html: html || document.documentElement.outerHTML.slice(0, 50000), css: css, text: text });
    e.stopPropagation();
    window.__crabArea.disable();
  }
  function enable() {
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
    document.body.style.cursor = 'crosshair';
    window.__crabArea.active = true;
  }
  function disable() {
    document.removeEventListener('mousedown', onDown, true);
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    document.body.style.cursor = '';
    box.style.display = 'none';
    if (box.parentNode) box.parentNode.removeChild(box);
    window.__crabArea.active = false;
  }
  window.__crabArea = { active: false, queue: queue, enable: enable, disable: disable, take: function() { var q = queue.slice(); queue.length=0; return q; } };
  enable();
  return 'ok';
})()`

export const PICKER_AREA_TAKE = String.raw`(() => {
  if (!window.__crabArea) return '[]';
  return JSON.stringify(window.__crabArea.take());
})()`
