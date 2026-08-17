import { wireModalEscape } from './wire-modal-escape.js';
import { FIELD_PICKER_POSITION_COOKIE, wireModalMove } from './wire-modal-move.js';
import {
  FIELD_MODAL_FOOTER_HINT_HTML,
  FIELD_MODAL_OVERLAY_CLASS,
  mountFieldModalOverlay,
  wireFieldModalFocus,
  wireModalConfirmShortcut,
} from './wire-modal-palette.js';

export type FieldFormModalElements = {
  overlay: HTMLElement;
  modal: HTMLElement;
  body: HTMLElement;
  header: HTMLElement;
};

export type FieldFormModalOpenBase = {
  title?: string;
  parent?: HTMLElement | null;
};

export type CreateFieldFormModalOptions<TOpen extends FieldFormModalOpenBase = FieldFormModalOpenBase> = {
  parent?: HTMLElement | null;
  bodyHtml: string;
  modalClass?: string;
  focusSelector?: string;
  /** Submit on plain Enter. Default true. Use false for textarea bodies. */
  submitOnEnter?: boolean;
  selectAll?: boolean | ((opts: TOpen) => boolean);
  getValue: (els: FieldFormModalElements) => string;
  /** Return the value to resolve, or null to keep the dialog open. */
  validate?: (els: FieldFormModalElements, value: string) => string | null;
  onOpen?: (els: FieldFormModalElements, opts: TOpen) => void;
  onClose?: (els: FieldFormModalElements) => void;
};

export type FieldFormModal<TOpen extends FieldFormModalOpenBase = FieldFormModalOpenBase> =
  FieldFormModalElements & {
    open(opts?: TOpen): Promise<string>;
  };

/**
 * Shared fill-mode field dialog (text, integer, date, and plugin form pickers).
 * Position, drag, Esc, and Ctrl+Enter stay on one path.
 */
export function createFieldFormModal<TOpen extends FieldFormModalOpenBase = FieldFormModalOpenBase>(
  options: CreateFieldFormModalOptions<TOpen>,
): FieldFormModal<TOpen> {
  const {
    parent = null,
    bodyHtml,
    modalClass = '',
    focusSelector,
    submitOnEnter = true,
    selectAll = false,
    getValue,
    validate,
    onOpen,
    onClose,
  } = options;

  const overlay = document.createElement('div');
  overlay.className = FIELD_MODAL_OVERLAY_CLASS;
  overlay.hidden = true;

  const extraClass = modalClass.trim();
  overlay.innerHTML = `
    <div class="modal${extraClass ? ` ${extraClass}` : ''}" role="dialog" aria-modal="true">
      <div class="modal__header"></div>
      <div class="modal__body">
        ${bodyHtml}
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

  const modal = overlay.querySelector('.modal') as HTMLElement;
  const header = overlay.querySelector('.modal__header') as HTMLElement;
  const body = overlay.querySelector('.modal__body') as HTMLElement;
  const btnClear = overlay.querySelector('[data-action="clear"]') as HTMLButtonElement;
  const btnOk = overlay.querySelector('[data-action="ok"]') as HTMLButtonElement;
  const btnClose = overlay.querySelector('[data-action="close"]') as HTMLButtonElement;

  wireModalMove(modal, { cookieKey: FIELD_PICKER_POSITION_COOKIE });

  const els: FieldFormModalElements = { overlay, modal, body, header };

  let resolvePromise: ((value: string) => void) | null = null;
  let rejectPromise: ((reason?: unknown) => void) | null = null;
  let releaseFocus: (() => void) | null = null;

  function close() {
    releaseFocus?.();
    releaseFocus = null;
    overlay.hidden = true;
    onClose?.(els);
  }

  function finish(value: string) {
    const resolve = resolvePromise;
    resolvePromise = null;
    rejectPromise = null;
    close();
    resolve?.(value);
  }

  function cancel() {
    const reject = rejectPromise;
    resolvePromise = null;
    rejectPromise = null;
    close();
    reject?.(new Error('cancelled'));
  }

  function submit() {
    const raw = getValue(els);
    const next = validate ? validate(els, raw) : raw;
    if (next === null) return;
    finish(next);
  }

  function open(opts: TOpen = {} as TOpen): Promise<string> {
    return new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
      mountFieldModalOverlay(overlay, opts.parent ?? parent);
      header.textContent = opts.title ?? '';
      onOpen?.(els, opts);
      overlay.hidden = false;
      const focusTarget = focusSelector
        ? (overlay.querySelector(focusSelector) as HTMLElement | null)
        : null;
      if (focusTarget) {
        const shouldSelect = typeof selectAll === 'function' ? selectAll(opts) : selectAll;
        releaseFocus = wireFieldModalFocus(overlay, focusTarget, { selectAll: shouldSelect });
      }
    });
  }

  btnOk.addEventListener('click', () => submit());
  btnClear.addEventListener('click', () => finish(''));
  btnClose.addEventListener('click', () => cancel());

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cancel();
  });

  if (submitOnEnter) {
    body.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      submit();
    });
  }

  wireModalConfirmShortcut(overlay, btnOk);
  wireModalEscape(overlay, () => cancel());

  return { open, ...els };
}
