const COOKIE_PREFIX = 'doc-editor.modal-pos.';

/** Shared position for fill-mode field pickers (tree, list, text, …). */
export const FIELD_PICKER_POSITION_COOKIE = 'field-picker';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function overlayBox(overlay: HTMLElement | null) {
  const view = typeof window !== 'undefined' ? window : null;
  const w = overlay?.clientWidth || view?.innerWidth || 1200;
  const h = overlay?.clientHeight || view?.innerHeight || 800;
  return { w, h };
}

function modalBox(modalEl: HTMLElement) {
  return {
    w: modalEl.offsetWidth || 480,
    h: modalEl.offsetHeight || 320,
  };
}

export function clampModalPosition(
  left: number,
  top: number,
  modalEl: HTMLElement,
  overlay: HTMLElement | null,
) {
  const view = overlayBox(overlay);
  const modal = modalBox(modalEl);
  return {
    left: clamp(left, 0, Math.max(0, view.w - modal.w)),
    top: clamp(top, 0, Math.max(0, view.h - modal.h)),
  };
}

export function readModalPositionCookie(cookieKey: string) {
  if (!cookieKey || typeof document === 'undefined') return null;

  const cookieString = document.cookie ?? '';
  const raw = cookieString
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_PREFIX}${cookieKey}=`));

  if (!raw) return null;

  const value = decodeURIComponent(raw.slice(raw.indexOf('=') + 1));
  const match = /^(-?\d+),(-?\d+)$/.exec(value);
  if (!match) return null;

  const left = Number(match[1]);
  const top = Number(match[2]);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;

  return { left, top };
}

export function writeModalPositionCookie(cookieKey: string, left: number, top: number) {
  if (!cookieKey || typeof document === 'undefined') return;
  if (typeof document.cookie !== 'string') return;

  const x = Math.round(left);
  const y = Math.round(top);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const name = `${COOKIE_PREFIX}${cookieKey}`;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(`${x},${y}`)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function applyModalPosition(modalEl: HTMLElement, left: number, top: number) {
  modalEl.classList.add('modal--moved');
  modalEl.style.position = 'absolute';
  modalEl.style.left = `${Math.round(left)}px`;
  modalEl.style.top = `${Math.round(top)}px`;
  modalEl.style.right = 'auto';
  modalEl.style.bottom = 'auto';
  modalEl.style.margin = '0';
}

function swallowNextClick() {
  function blockBackdropClick(clickEvent: Event) {
    clickEvent.preventDefault();
    clickEvent.stopImmediatePropagation();
    document.removeEventListener('click', blockBackdropClick, true);
  }
  document.addEventListener('click', blockBackdropClick, true);
}

function shouldIgnoreMoveHandle(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    'button, a, input, textarea, select, .modal__resize-handle, .modal__body, .modal__footer',
  );
}

/**
 * Drag a modal by its header and persist left/top in a cookie.
 * Restores the saved position whenever the overlay is shown.
 */
export function wireModalMove(
  modalEl: HTMLElement | Element | null | undefined,
  options: { cookieKey?: string; handle?: HTMLElement | Element | null } = {},
) {
  const cookieKey = options.cookieKey ?? FIELD_PICKER_POSITION_COOKIE;
  if (!modalEl || !cookieKey) return { restore() {} };

  const modal = modalEl as HTMLElement;
  const overlay = modal.closest('.modal-overlay') as HTMLElement | null;
  const header =
    options.handle ??
    (modal.querySelector('.modal__header') as HTMLElement | null);
  if (!header) return { restore() {} };

  const handle = header as HTMLElement;
  modal.classList.add('modal--movable');
  handle.title = handle.title || 'Drag to move';

  function restore() {
    const stored = readModalPositionCookie(cookieKey);
    if (!stored) return;
    const next = clampModalPosition(stored.left, stored.top, modal, overlay);
    applyModalPosition(modal, next.left, next.top);
  }

  restore();

  if (overlay && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(() => {
      if (!overlay.hidden) restore();
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
  }

  // Pointer events cover mouse, finger, and Apple Pencil. iPad Safari does not
  // fire mousemove during a touch drag, so mouse-only listeners never move.
  handle.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (event.isPrimary === false) return;
    if (shouldIgnoreMoveHandle(event.target)) return;

    event.preventDefault();
    event.stopPropagation();

    const overlayRect = overlay?.getBoundingClientRect();
    const modalRect = modal.getBoundingClientRect();
    const startLeft = overlayRect ? modalRect.left - overlayRect.left : modal.offsetLeft;
    const startTop = overlayRect ? modalRect.top - overlayRect.top : modal.offsetTop;
    applyModalPosition(modal, startLeft, startTop);

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    document.body.classList.add('modal-move-active');
    modal.classList.add('modal--dragging');
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      // linkedom / browsers without capture
    }

    function onMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      const next = clampModalPosition(startLeft + dx, startTop + dy, modal, overlay);
      applyModalPosition(modal, next.left, next.top);
    }

    function onUp(upEvent: PointerEvent) {
      if (upEvent.pointerId !== pointerId) return;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('modal-move-active');
      modal.classList.remove('modal--dragging');
      try {
        if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
      } catch {
        // ignore
      }

      const left = Number.parseFloat(modal.style.left) || 0;
      const top = Number.parseFloat(modal.style.top) || 0;
      writeModalPositionCookie(cookieKey, left, top);

      if (moved) swallowNextClick();
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  });

  return { restore };
}
