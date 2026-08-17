import { applyFieldFormTextStyle } from '../core/page-setup-styles.js';
import { createFieldFormModal } from './field-form-modal.js';

export function createTextModal({ parent = null }: { parent?: HTMLElement | null } = {}) {
  const form = createFieldFormModal<{
    title?: string;
    value?: string;
    placeholder?: string;
    selectAll?: boolean;
    textStyle?: unknown;
    parent?: HTMLElement | null;
  }>({
    parent,
    bodyHtml: `<textarea class="modal__textarea" rows="5" placeholder="Enter text..."></textarea>`,
    focusSelector: '.modal__textarea',
    submitOnEnter: false,
    selectAll: (opts) => !!opts.selectAll,
    getValue: ({ body }) => {
      const textarea = body.querySelector('.modal__textarea') as HTMLTextAreaElement | null;
      return textarea?.value ?? '';
    },
    onOpen: ({ modal, body }, opts) => {
      const textarea = body.querySelector('.modal__textarea') as HTMLTextAreaElement | null;
      if (!textarea) return;
      textarea.value = opts.value ?? '';
      textarea.placeholder = opts.placeholder || 'Enter text...';
      applyFieldFormTextStyle(modal, opts.textStyle);
      applyFieldFormTextStyle(textarea, opts.textStyle);
    },
    onClose: ({ body }) => {
      const textarea = body.querySelector('.modal__textarea') as HTMLTextAreaElement | null;
      if (textarea) textarea.value = '';
    },
  });

  return { open: form.open };
}
