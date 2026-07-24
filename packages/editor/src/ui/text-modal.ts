import { wireModalEscape } from './wire-modal-escape.js';
import { applyFieldFormTextStyle } from '../core/page-setup-styles.js';
import {
  FIELD_MODAL_FOOTER_HINT_HTML,
  FIELD_MODAL_OVERLAY_CLASS,
  mountFieldModalOverlay,
  wireFieldModalFocus,
  wireModalConfirmShortcut,
} from './wire-modal-palette.js';

export function createTextModal({ parent = null }: { parent?: HTMLElement | null } = {}) {
  const overlay = document.createElement('div');
  overlay.className = FIELD_MODAL_OVERLAY_CLASS;
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header"></div>
      <div class="modal__body">
        <textarea class="modal__textarea" rows="5" placeholder="Enter text..."></textarea>
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

  const modalRoot = overlay.querySelector('.modal') as HTMLElement;
  const header = overlay.querySelector('.modal__header') as HTMLElement;
  const textarea = overlay.querySelector('.modal__textarea') as HTMLTextAreaElement;
  const btnClear = overlay.querySelector('[data-action="clear"]') as HTMLButtonElement;
  const btnOk = overlay.querySelector('[data-action="ok"]') as HTMLButtonElement;
  const btnClose = overlay.querySelector('[data-action="close"]') as HTMLButtonElement;

  let resolvePromise: any = null;
  let rejectPromise: any = null;
  let releaseFocus: (() => void) | null = null;

  function close() {
    releaseFocus?.();
    releaseFocus = null;
    overlay.hidden = true;
    textarea.value = '';
  }

  function open({ title, value = '', placeholder = '', selectAll = false, textStyle = null }: any) {
    return new Promise((resolve: any, reject: any) => {
      resolvePromise = resolve;
      rejectPromise = reject;
      mountFieldModalOverlay(overlay, parent);
      header.textContent = title;
      textarea.value = value ?? '';
      textarea.placeholder = placeholder || 'Enter text...';
      applyFieldFormTextStyle(modalRoot, textStyle);
      applyFieldFormTextStyle(textarea, textStyle);
      overlay.hidden = false;
      releaseFocus = wireFieldModalFocus(overlay, textarea, { selectAll });
    });
  }

  btnOk.addEventListener('click', () => {
    const result = textarea.value;
    const resolve = resolvePromise;
    close();
    resolve?.(result);
    resolvePromise = null;
    rejectPromise = null;
  });

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

  textarea.addEventListener('keydown', (e: any) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      btnOk.click();
    }
  });

  wireModalConfirmShortcut(overlay, btnOk);
  wireModalEscape(overlay, () => btnClose.click());

  return { open };
}
