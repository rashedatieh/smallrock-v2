const MIN_CHARS = 40;
const UNDO_WINDOW_MS = 30000;
const RENDER_THROTTLE_MS = 80;

const MODE_LABELS = { 1: 'Quick', 2: 'Technical', 3: 'Planning' };

let undoState = null;
let inFlight = false;
let lastFocusedEditor = null;

console.log('[SmallRock] content script loaded on', location.href);

document.addEventListener('focusin', (e) => {
  const t = e.target;
  if (!t) return;
  if (
    t.tagName === 'TEXTAREA' ||
    (t.tagName === 'INPUT' && (t.type === 'text' || t.type === 'search' || !t.type)) ||
    t.isContentEditable
  ) {
    lastFocusedEditor = t;
  }
}, true);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'TRIGGER_REWRITE') return;
  console.log('[SmallRock] TRIGGER_REWRITE received, mode:', msg.mode ?? 1);
  const target = findActiveEditor();
  if (!target) {
    toast('Click in the chat input first');
    return;
  }
  handleRewrite(target, msg.mode ?? 1);
});

document.addEventListener('keydown', (e) => {
  if (!undoState || Date.now() > undoState.expiresAt) return;
  const isEsc = e.key === 'Escape';
  const isCtrlZ = (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z');
  if ((isEsc || isCtrlZ) && document.activeElement === undoState.element) {
    e.preventDefault();
    e.stopPropagation();
    replaceText(undoState.element, undoState.original);
    undoState = null;
    toast('Restored');
  }
}, true);

function handleRewrite(el, mode = 1) {
  if (inFlight) {
    console.log('[SmallRock] already in flight, ignoring');
    return;
  }

  const text = readText(el);
  console.log('[SmallRock] captured', text.length, 'chars, mode', mode);

  if (text.trim().length < MIN_CHARS) {
    toast(`Type a bit more first (need ${MIN_CHARS}+ chars)`);
    return;
  }

  const original = text;
  const modeLabel = MODE_LABELS[mode] ?? 'Quick';
  inFlight = true;
  setLoading(el, true);
  const loadingToast = toast(`${modeLabel} rewrite…`, 'info', true);

  const port = chrome.runtime.connect({ name: 'rewrite-stream' });
  let accumulated = '';
  let firstChunkAt = null;
  let lastRenderAt = 0;
  let pendingRenderTimer = null;
  let finished = false;
  const t0 = performance.now();

  const flush = () => {
    if (!accumulated) return;
    if (pendingRenderTimer) {
      clearTimeout(pendingRenderTimer);
      pendingRenderTimer = null;
    }
    lastRenderAt = performance.now();
    replaceText(el, accumulated);
  };

  const scheduleRender = () => {
    const elapsed = performance.now() - lastRenderAt;
    if (elapsed >= RENDER_THROTTLE_MS) {
      flush();
    } else if (!pendingRenderTimer) {
      pendingRenderTimer = setTimeout(() => {
        pendingRenderTimer = null;
        flush();
      }, RENDER_THROTTLE_MS - elapsed);
    }
  };

  const cleanup = () => {
    finished = true;
    if (pendingRenderTimer) {
      clearTimeout(pendingRenderTimer);
      pendingRenderTimer = null;
    }
    inFlight = false;
    setLoading(el, false);
    try { port.disconnect(); } catch {}
  };

  port.onMessage.addListener((msg) => {
    if (finished) return;

    if (msg.type === 'CHUNK') {
      if (firstChunkAt === null) {
        firstChunkAt = performance.now();
        console.log('[SmallRock] first chunk at', Math.round(firstChunkAt - t0), 'ms');
      }
      accumulated += msg.text;
      scheduleRender();
    } else if (msg.type === 'DONE') {
      flush();
      const totalMs = Math.round(performance.now() - t0);
      console.log('[SmallRock] stream done in', totalMs, 'ms,', accumulated.length, 'chars');
      undoState = {
        element: el,
        original,
        expiresAt: Date.now() + UNDO_WINDOW_MS,
      };
      loadingToast.remove();
      toast(`Done in ${totalMs}ms — Esc to undo`);
      cleanup();
    } else if (msg.type === 'ERROR') {
      console.error('[SmallRock] stream error:', msg.message);
      if (accumulated) replaceText(el, original);
      loadingToast.remove();
      toast('Rewrite failed: ' + msg.message, 'error');
      cleanup();
    }
  });

  port.onDisconnect.addListener(() => {
    if (finished) return;
    console.warn('[SmallRock] port disconnected unexpectedly', chrome.runtime.lastError?.message);
    if (accumulated) replaceText(el, original);
    loadingToast.remove();
    toast('Connection lost', 'error');
    cleanup();
  });

  port.postMessage({ type: 'START', text, mode });
}

function getDeepActiveElement() {
  let el = document.activeElement;
  while (el?.shadowRoot?.activeElement) {
    el = el.shadowRoot.activeElement;
  }
  return el;
}

function isEditor(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search' || !el.type)) return true;
  if (el.isContentEditable) return true;
  return false;
}

function findActiveEditor() {
  const deep = getDeepActiveElement();
  if (isEditor(deep)) return deep;
  if (isEditor(lastFocusedEditor) && document.contains(lastFocusedEditor)) return lastFocusedEditor;

  const candidates = [
    ...document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""]'),
  ].filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 100 && rect.height > 20 && rect.bottom > 0 && rect.top < window.innerHeight;
  });

  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return (rb.width * rb.height) - (ra.width * ra.height);
    });
    return candidates[0];
  }
  return null;
}

function readText(el) {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return el.value;
  return el.innerText;
}

function replaceText(el, newText) {
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const proto = el.tagName === 'TEXTAREA'
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, newText);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  if (el.isContentEditable) {
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);

    const ok = document.execCommand('insertText', false, newText);
    if (ok) return;

    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', newText);
      el.dispatchEvent(new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      }));
    } catch {
      el.textContent = newText;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
  }
}

function setLoading(el, loading) {
  const key = 'smallrockPrevOutline';
  if (loading) {
    el.dataset[key] = el.style.outline || '';
    el.style.outline = '2px solid rgba(245, 158, 11, 0.7)';
    el.style.outlineOffset = '2px';
    el.style.transition = 'outline-color 200ms';
  } else {
    el.style.outline = el.dataset[key] || '';
    el.style.outlineOffset = '';
    delete el.dataset[key];
  }
}

function toast(message, kind = 'info', persist = false) {
  const existing = document.getElementById('smallrock-toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.id = 'smallrock-toast';
  t.textContent = message;
  Object.assign(t.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    padding: '10px 16px',
    background: kind === 'error'
      ? 'rgba(220, 38, 38, 0.95)'
      : 'rgba(15, 12, 8, 0.94)',
    color: kind === 'error' ? 'white' : '#f0ebe0',
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    borderRadius: '10px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 1px 0 rgba(245,158,11,0.15) inset',
    border: kind === 'error' ? 'none' : '1px solid rgba(245,158,11,0.2)',
    zIndex: '2147483647',
    pointerEvents: 'none',
    maxWidth: '340px',
    backdropFilter: 'blur(12px)',
  });
  document.body.appendChild(t);

  if (!persist) {
    const timer = setTimeout(() => {
      if (t.parentNode) t.remove();
    }, 2500);
    return { remove: () => { clearTimeout(timer); if (t.parentNode) t.remove(); } };
  }
  return { remove: () => { if (t.parentNode) t.remove(); } };
}
