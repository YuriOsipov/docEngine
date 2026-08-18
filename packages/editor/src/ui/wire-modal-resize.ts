const COOKIE_PREFIX = 'doc-editor.modal-size.';

function resolveLimit(limit: any) {
  return typeof limit === 'function' ? limit() : limit;
}

function defaultMaxWidth() {
  const viewport = typeof window !== 'undefined' ? window.innerWidth : 1200;
  return Math.min(viewport * 0.94, 960);
}

function defaultMaxHeight() {
  const viewport = typeof window !== 'undefined' ? window.innerHeight : 900;
  return Math.min(viewport * 0.9, 900);
}

function clamp(value: any,min: any,max: any) {
  return Math.min(Math.max(value, min), max);
}

/**
 * @param {string} cookieKey
 * @returns {{ width: number, height: number } | null}
 */
export function readModalSizeCookie(cookieKey: any) {
  if (!cookieKey || typeof document === 'undefined') return null;

  const cookieString = document.cookie ?? '';
  const raw = cookieString
    .split(';')
    .map((part: any) => part.trim())
    .find((part: any) => part.startsWith(`${COOKIE_PREFIX}${cookieKey}=`));

  if (!raw) return null;

  const value = decodeURIComponent(raw.slice(raw.indexOf('=') + 1));
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) return null;

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

/**
 * @param {string} cookieKey
 * @param {number} width
 * @param {number} height
 */
export function writeModalSizeCookie(cookieKey: any,width: any,height: any) {
  if (!cookieKey || typeof document === 'undefined') return;
  if (typeof document.cookie !== 'string') return;

  const w = Math.round(width);
  const h = Math.round(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;

  const name = `${COOKIE_PREFIX}${cookieKey}`;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(`${w}x${h}`)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function applyModalSize(modalEl: any,width: any,height: any) {
  modalEl.style.width = `${Math.round(width)}px`;
  modalEl.style.height = `${Math.round(height)}px`;
  modalEl.style.maxWidth = '94vw';
  modalEl.style.maxHeight = '90vh';
}

/**
 * Add a drag handle to resize a modal and persist dimensions in a cookie.
 * @param {HTMLElement | null | undefined} modalEl
 * @param {{
 *   cookieKey: string,
 *   minWidth?: number,
 *   minHeight?: number,
 *   maxWidth?: number | (() => number),
 *   maxHeight?: number | (() => number),
 * }} options
 */
export function wireModalResize(modalEl: any,options: any) {
  const {
    cookieKey,
    minWidth = 320,
    minHeight = 280,
    maxWidth = defaultMaxWidth,
    maxHeight = defaultMaxHeight,
  } = options ?? {};

  if (!modalEl || !cookieKey) return;

  modalEl.classList.add('modal--resizable');

  const stored = readModalSizeCookie(cookieKey);
  if (stored) {
    applyModalSize(
      modalEl,
      clamp(stored.width, minWidth, resolveLimit(maxWidth)),
      clamp(stored.height, minHeight, resolveLimit(maxHeight)),
    );
  }

  const handle = document.createElement('div');
  handle.className = 'modal__resize-handle';
  handle.setAttribute('aria-hidden', 'true');
  handle.title = 'Resize';
  modalEl.appendChild(handle);

  handle.addEventListener('pointerdown', (event: any) => {
    if (event.button != null && event.button !== 0) return;
    if (event.isPrimary === false) return;
    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = modalEl.offsetWidth;
    const startHeight = modalEl.offsetHeight;

    document.body.classList.add('modal-resize-active');
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      // linkedom / browsers without capture
    }

    function onMove(moveEvent: any) {
      if (moveEvent.pointerId !== pointerId) return;
      const nextWidth = clamp(
        startWidth + moveEvent.clientX - startX,
        minWidth,
        resolveLimit(maxWidth),
      );
      const nextHeight = clamp(
        startHeight + moveEvent.clientY - startY,
        minHeight,
        resolveLimit(maxHeight),
      );
      applyModalSize(modalEl, nextWidth, nextHeight);
    }

    function onUp(upEvent: any) {
      if (upEvent.pointerId !== pointerId) return;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('modal-resize-active');
      try {
        if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }
      writeModalSizeCookie(cookieKey, modalEl.offsetWidth, modalEl.offsetHeight);

      // Drag ends on the backdrop; browsers then synthesize a click on the overlay
      // which would close the modal. Swallow that one click.
      function blockBackdropClick(clickEvent: any) {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
        document.removeEventListener('click', blockBackdropClick, true);
      }

      document.addEventListener('click', blockBackdropClick, true);
      upEvent?.preventDefault();
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });
}
