export interface DateModalOpenOptions {
  title?: string;
  value?: string;
}

export interface DateModal {
  open(opts?: DateModalOpenOptions): Promise<string>;
}

/**
 * Fill-mode date picker modal for the date field plugin.
 * Uses the same `.modal-overlay` classes as `@docengine/editor` styles.
 */
export function createDateModal(): DateModal {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay modal-overlay--palette';
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__header"></div>
      <div class="modal__body">
        <input type="date" class="modal__input" />
      </div>
      <div class="modal__footer">
        <button type="button" class="btn" data-action="clear">Clear</button>
        <button type="button" class="btn btn-primary" data-action="ok">OK</button>
        <span class="modal__footer-hint" aria-hidden="true">Ctrl+Enter</span>
        <button type="button" class="btn" data-action="close">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const headerEl = overlay.querySelector('.modal__header');
  const inputEl = overlay.querySelector('.modal__input');
  const btnClearEl = overlay.querySelector('[data-action="clear"]');
  const btnOkEl = overlay.querySelector('[data-action="ok"]');
  const btnCloseEl = overlay.querySelector('[data-action="close"]');

  if (
    !(headerEl instanceof HTMLElement) ||
    !(inputEl instanceof HTMLInputElement) ||
    !(btnClearEl instanceof HTMLButtonElement) ||
    !(btnOkEl instanceof HTMLButtonElement) ||
    !(btnCloseEl instanceof HTMLButtonElement)
  ) {
    throw new Error('createDateModal: failed to mount modal DOM');
  }

  const header = headerEl;
  const input = inputEl;
  const btnClear = btnClearEl;
  const btnOk = btnOkEl;
  const btnClose = btnCloseEl;

  let resolvePromise: ((value: string) => void) | null = null;
  let rejectPromise: ((reason?: unknown) => void) | null = null;

  function close() {
    overlay.hidden = true;
    input.value = '';
  }

  function submit() {
    const result = input.value;
    const resolve = resolvePromise;
    close();
    resolve?.(result);
    resolvePromise = null;
    rejectPromise = null;
  }

  function cancel() {
    const reject = rejectPromise;
    resolvePromise = null;
    rejectPromise = null;
    close();
    reject?.(new Error('cancelled'));
  }

  function open({ title = 'Date', value = '' }: DateModalOpenOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
      header.textContent = title;
      input.value = value ?? '';
      overlay.hidden = false;
      input.focus();
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
  btnClose.addEventListener('click', () => cancel());

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cancel();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      submit();
    }
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) {
      e.preventDefault();
      cancel();
    }
  });

  return { open };
}

export interface DatePickerCallbacks {
  openDatePicker(opts?: DateModalOpenOptions): Promise<string>;
}

/** Picker callbacks fragment for `createEditor({ pickers })`. */
export function createDatePickerCallbacks(): DatePickerCallbacks {
  const modal = createDateModal();
  return {
    openDatePicker: (opts) => modal.open(opts),
  };
}
