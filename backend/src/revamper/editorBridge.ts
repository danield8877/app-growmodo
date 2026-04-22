/**
 * Script injecté dans l’iframe de l’éditeur visuel (postMessage parent ↔ iframe).
 * Doit rester compatible navigateur sans dépendances.
 */
export const EDITOR_BRIDGE_SCRIPT = `(function(){
  if (window.__rvpBridgeInstalled) return;
  window.__rvpBridgeInstalled = true;
  var OUTLINE = '2px solid #2563eb';
  var selectedEl = null;

  function shouldMark(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = el.tagName.toLowerCase();
    var textTags = {h1:1,h2:1,h3:1,h4:1,h5:1,h6:1,p:1,span:1,a:1,button:1,img:1,section:1};
    if (textTags[tag]) return true;
    if (tag === 'div') {
      var c = (el.className && el.className.toString) ? el.className.toString() : '';
      if (/\\bbg-/.test(c)) return true;
    }
    return false;
  }

  function assignIds() {
    var n = 0;
    var all = document.body ? document.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,button,img,section,div') : [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (!shouldMark(el)) continue;
      if (!el.getAttribute('data-rvp-id')) {
        el.setAttribute('data-rvp-id', 'e_' + (n++));
      }
    }
  }

  function getStyles(el) {
    var s = window.getComputedStyle(el);
    return { color: s.color, backgroundColor: s.backgroundColor };
  }

  function select(el) {
    if (selectedEl) {
      selectedEl.style.outline = selectedEl.__rvpOldOutline != null ? selectedEl.__rvpOldOutline : '';
      selectedEl.style.outlineOffset = '';
    }
    selectedEl = el;
    if (el) {
      el.__rvpOldOutline = el.style.outline;
      el.style.outline = OUTLINE;
      el.style.outlineOffset = '2px';
    }
  }

  function rectPayload(el) {
    var r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }

  document.addEventListener('click', function(ev) {
    var el = ev.target;
    if (!el || el.nodeType !== 1) return;
    var cur = el;
    while (cur && cur !== document.body) {
      if (cur.getAttribute && cur.getAttribute('data-rvp-id')) {
        ev.preventDefault();
        ev.stopPropagation();
        select(cur);
        var id = cur.getAttribute('data-rvp-id') || '';
        var tag = cur.tagName ? cur.tagName.toLowerCase() : '';
        var text = (tag === 'img') ? '' : (cur.textContent || '');
        var src = cur.getAttribute && cur.getAttribute('src') ? cur.getAttribute('src') : '';
        try {
          window.parent.postMessage({
            type: 'rvp:select',
            id: id,
            tag: tag,
            text: text,
            src: src,
            styles: getStyles(cur),
            rect: rectPayload(cur)
          }, '*');
        } catch (e) {}
        return;
      }
      cur = cur.parentElement;
    }
  }, true);

  window.addEventListener('message', function(ev) {
    var d = ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'rvp:update') {
      var id = d.id;
      var patch = d.patch || {};
      var el = document.querySelector('[data-rvp-id=\"' + id + '\"]');
      if (!el) return;
      if (Object.prototype.hasOwnProperty.call(patch, 'text') && el.tagName.toLowerCase() !== 'img') {
        el.textContent = patch.text;
      }
      if (patch.src != null && (el.tagName && el.tagName.toLowerCase() === 'img')) {
        el.setAttribute('src', String(patch.src));
      }
      if (patch.color) el.style.color = patch.color;
      if (patch.backgroundColor) el.style.backgroundColor = patch.backgroundColor;
      if (patch.addClass) {
        (patch.addClass + '').split(/\\s+/).forEach(function(c) { if (c) el.classList.add(c); });
      }
      if (patch.removeClass) {
        (patch.removeClass + '').split(/\\s+/).forEach(function(c) { if (c) el.classList.remove(c); });
      }
    }
    if (d.type === 'rvp:serialize' && ev.source) {
      try {
        var rid = d.rid;
        ev.source.postMessage(
          { type: 'rvp:serialize:result', html: document.documentElement.outerHTML, rid: rid },
          '*'
        );
      } catch (e) {}
    }
  });

  function go() { assignIds(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', go);
  } else {
    go();
  }
})();`;
