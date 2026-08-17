import { createFieldFormModal } from './field-form-modal.js';

export function createIntegerModal({ parent = null }: { parent?: HTMLElement | null } = {}) {
  let currentMin = 0;
  let currentMax = 999;

  function clampValue(raw: unknown) {
    if (raw === '' || raw == null) return '';
    const num = Number(raw);
    if (Number.isNaN(num)) return null;
    return String(Math.min(currentMax, Math.max(currentMin, num)));
  }

  const form = createFieldFormModal<{
    title?: string;
    value?: string;
    min?: number;
    max?: number;
    parent?: HTMLElement | null;
  }>({
    parent,
    bodyHtml: `
      <p class="modal__hint" data-role="hint"></p>
      <input type="number" class="modal__number" inputmode="numeric" />
      <p class="modal__error" data-role="error" hidden></p>
    `,
    focusSelector: '.modal__number',
    selectAll: true,
    getValue: ({ body }) => {
      const input = body.querySelector('.modal__number') as HTMLInputElement | null;
      return input?.value.trim() ?? '';
    },
    validate: ({ body }, raw) => {
      const result = clampValue(raw);
      if (result === null) {
        const error = body.querySelector('[data-role="error"]') as HTMLElement | null;
        const input = body.querySelector('.modal__number') as HTMLInputElement | null;
        if (error) {
          error.textContent = `Enter a number from ${currentMin} to ${currentMax}.`;
          error.hidden = false;
        }
        input?.focus();
        return null;
      }
      return result;
    },
    onOpen: ({ body }, opts) => {
      currentMin = opts.min ?? 0;
      currentMax = opts.max ?? 999;
      const hint = body.querySelector('[data-role="hint"]') as HTMLElement | null;
      const input = body.querySelector('.modal__number') as HTMLInputElement | null;
      const error = body.querySelector('[data-role="error"]') as HTMLElement | null;
      if (hint) hint.textContent = `Enter a value from ${currentMin} to ${currentMax}.`;
      if (input) {
        input.min = String(currentMin);
        input.max = String(currentMax);
        input.value = opts.value != null && opts.value !== '' ? String(opts.value) : '';
      }
      if (error) {
        error.hidden = true;
        error.textContent = '';
      }
    },
    onClose: ({ body }) => {
      const input = body.querySelector('.modal__number') as HTMLInputElement | null;
      const error = body.querySelector('[data-role="error"]') as HTMLElement | null;
      if (input) input.value = '';
      if (error) {
        error.hidden = true;
        error.textContent = '';
      }
    },
  });

  return { open: form.open };
}
