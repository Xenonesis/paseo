/**
 * Lightweight in-page inspector script injected into webview / iframe preview.
 * Listens for messages from parent window or enables element hover highlight,
 * tag name tooltip, and click-to-select.
 */
export const INSPECT_INJECTOR_SCRIPT = `
(function() {
  if (window.__PASEO_INSPECT_INJECTED__) return;
  window.__PASEO_INSPECT_INJECTED__ = true;

  let active = false;
  let overlay = null;
  let label = null;
  let lastTarget = null;

  function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = '__paseo_inspect_overlay__';
    overlay.style.position = 'fixed';
    overlay.style.pointerEvents = 'none';
    overlay.style.border = '2px solid #22c55e';
    overlay.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
    overlay.style.zIndex = '2147483647';
    overlay.style.transition = 'all 0.05s ease-out';
    overlay.style.display = 'none';

    label = document.createElement('div');
    label.style.position = 'absolute';
    label.style.bottom = '100%';
    label.style.left = '0';
    label.style.backgroundColor = '#15803d';
    label.style.color = '#ffffff';
    label.style.fontSize = '11px';
    label.style.fontFamily = 'monospace';
    label.style.padding = '2px 6px';
    label.style.borderRadius = '3px';
    label.style.whiteSpace = 'nowrap';
    label.style.marginBottom = '2px';
    overlay.appendChild(label);

    document.documentElement.appendChild(overlay);
  }

  function onMouseMove(e) {
    if (!active) return;
    const target = e.target;
    if (!target || target === overlay || target === label || target.id === '__paseo_inspect_overlay__') return;
    lastTarget = target;

    createOverlay();
    const rect = target.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    const tag = target.tagName.toLowerCase();
    const id = target.id ? '#' + target.id : '';
    const cls = target.className && typeof target.className === 'string' 
      ? '.' + target.className.trim().split(/\\s+/).slice(0, 2).join('.') 
      : '';
    label.textContent = tag + id + cls + ' (' + Math.round(rect.width) + 'x' + Math.round(rect.height) + ')';
  }

  function onClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();

    if (lastTarget) {
      const tag = lastTarget.tagName.toLowerCase();
      const id = lastTarget.id || '';
      const text = (lastTarget.innerText || lastTarget.textContent || '').slice(0, 100).trim();
      const htmlSnippet = lastTarget.outerHTML ? lastTarget.outerHTML.slice(0, 200) : '';

      window.parent.postMessage({
        type: 'PASEO_INSPECT_ELEMENT_SELECTED',
        payload: {
          tag,
          id,
          text,
          snippet: htmlSnippet
        }
      }, '*');
    }
  }

  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'PASEO_SET_INSPECT_MODE') {
      active = Boolean(event.data.active);
      if (!active && overlay) {
        overlay.style.display = 'none';
      }
    }
  });

  window.addEventListener('mousemove', onMouseMove, true);
  window.addEventListener('click', onClick, true);
})();
`;
