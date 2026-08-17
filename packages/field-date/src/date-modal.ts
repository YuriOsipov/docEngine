import { createFieldFormModal } from '@docengine/editor/ui/field-form-modal';

export interface DateModalOpenOptions {
  title?: string;
  value?: string;
  parent?: HTMLElement | null;
}

export interface DateModal {
  open(opts?: DateModalOpenOptions): Promise<string>;
}

/**
 * Fill-mode date picker modal for the date field plugin.
 * Uses the shared field-form dialog (position, drag, Esc, Ctrl+Enter).
 */
export function createDateModal({ parent = null }: { parent?: HTMLElement | null } = {}): DateModal {
  const form = createFieldFormModal<DateModalOpenOptions>({
    parent,
    bodyHtml: `<input type="date" class="modal__input" />`,
    focusSelector: '.modal__input',
    getValue: ({ body }) => {
      const input = body.querySelector('.modal__input') as HTMLInputElement | null;
      return input?.value ?? '';
    },
    onOpen: ({ body }, opts) => {
      const input = body.querySelector('.modal__input') as HTMLInputElement | null;
      if (input) input.value = opts.value ?? '';
    },
    onClose: ({ body }) => {
      const input = body.querySelector('.modal__input') as HTMLInputElement | null;
      if (input) input.value = '';
    },
  });

  return {
    open: (opts = {}) => form.open({ title: opts.title ?? 'Date', ...opts }),
  };
}

export interface DatePickerCallbacks {
  openDatePicker(opts?: DateModalOpenOptions): Promise<string>;
}

/** Picker callbacks fragment for `createEditor({ pickers })`. */
export function createDatePickerCallbacks(
  options: { parent?: HTMLElement | null } = {},
): DatePickerCallbacks {
  const modal = createDateModal(options);
  return {
    openDatePicker: (opts) => modal.open(opts),
  };
}
