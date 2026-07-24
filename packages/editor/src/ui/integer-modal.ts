import { wireModalEscape } from './wire-modal-escape.js';
import {
  FIELD_MODAL_FOOTER_HINT_HTML,
  FIELD_MODAL_OVERLAY_CLASS,
  mountFieldModalOverlay,
  wireFieldModalFocus,
  wireModalConfirmShortcut,
} from './wire-modal-palette.js';

export function createIntegerModal({ parent = null }: { parent?: HTMLElement | null } = {}) {
  const overlay = document.createElement('div');
  overlay.className = FIELD_MODAL_OVERLAY_CLASS;
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header"></div>
      <div class="modal__body">
        <p class="modal__hint" data-role="hint"></p>
        <input type="number" class="modal__number" inputmode="numeric" />
        <p class="modal__error" data-role="error" hidden></p>
      </div>
      <div class="modal__footer">
        <button type="button" class="btn" data-action="clear">Clear</button>
        <button type="button" class="btn btn-primary" data-action="ok">OK</button>
        ${FIELD_MODAL_FOOTER_HINT_HTML}
        <button type="button" class="btn" data-action="close">Close</button>
      </div>
    </div>
  `;

  mountFieldModalOverlay(overlay, parent);

  const header = overlay.querySelector('.modal__header') as HTMLElement;
  const hint = overlay.querySelector('[data-role="hint"]') as HTMLElement;
  const input = overlay.querySelector('.modal__number') as HTMLInputElement;
  const error = overlay.querySelector('[data-role="error"]') as HTMLElement;
  const btnClear = overlay.querySelector('[data-action="clear"]') as HTMLButtonElement;
  const btnOk = overlay.querySelector('[data-action="ok"]') as HTMLButtonElement;
  const btnClose = overlay.querySelector('[data-action="close"]') as HTMLButtonElement;

  let resolvePromise: any = null;
  let rejectPromise: any = null;
  let currentMin = 0;
  let currentMax = 999;
  let fallbackValue = '';
  let releaseFocus: (() => void) | null = null;

  function close() {
    releaseFocus?.();
    releaseFocus = null;
    overlay.hidden = true;
    input.value = '';
    error.hidden = true;
    error.textContent = '';
  }

  function clampValue(raw: any) {
    if (raw === '' || raw == null) return '';
    const num = Number(raw);
    if (Number.isNaN(num)) return null;
    return String(Math.min(currentMax, Math.max(currentMin, num)));
  }

  function showError(message: any) {
    error.textContent = message;
    error.hidden = false;
  }

  function submit() {
    const result = clampValue(input.value.trim());
    if (result === null) {
      showError(`Enter a number from ${currentMin} to ${currentMax}.`);
      input.focus();
      return;
    }
    const resolve = resolvePromise;
    close();
    resolve?.(result);
    resolvePromise = null;
    rejectPromise = null;
  }

  function open({ title, value = '', min = 0, max = 999 }: any) {
    return new Promise((resolve: any, reject: any) => {
      resolvePromise = resolve;
      rejectPromise = reject;
      currentMin = min;
      currentMax = max;
      fallbackValue = value != null && value !== '' ? String(value) : '';

      mountFieldModalOverlay(overlay, parent);
      header.textContent = title;
      hint.textContent = `Enter a value from ${min} to ${max}.`;
      input.min = String(min);
      input.max = String(max);
      input.value = fallbackValue;
      error.hidden = true;
      overlay.hidden = false;
      releaseFocus = wireFieldModalFocus(overlay, input, { selectAll: true });
    });
  }

  btnOk.addEventListener('click', () => submit());

  btnClear.addEventListener('click', () => {
    const resolve = resolvePromise;
    close();
    resolve?.('');
    resolvePromise = null;
    rejectPromise = null;
  });

  btnClose.addEventListener('click', () => {
    rejectPromise?.(new Error('cancelled'));
    resolvePromise = null;
    rejectPromise = null;
    close();
  });

  overlay.addEventListener('click', (e: any) => {
    if (e.target === overlay) btnClose.click();
  });

  input.addEventListener('keydown', (e: any) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });

  wireModalConfirmShortcut(overlay, btnOk);
  wireModalEscape(overlay, () => btnClose.click());

  return { open };
}
