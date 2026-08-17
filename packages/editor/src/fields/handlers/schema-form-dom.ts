/** Shared DOM helpers for field handler schema forms. */

export function escapeAttr(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function readInputValue(host: ParentNode, field: string): string {
  const el = host.querySelector(`[data-field="${field}"]`) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement
    | null;
  return el?.value ?? '';
}

export function readCheckbox(host: ParentNode, field: string): boolean {
  const el = host.querySelector(`[data-field="${field}"]`) as HTMLInputElement | null;
  return !!el?.checked;
}

export function normalizeIntegerDisplayFormat(value: unknown): 'plain' | 'number' | 'currency' {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'number' || raw === 'currency') return raw;
  return 'plain';
}

export function readOptionalInteger(host: ParentNode, field: string): number | '' {
  const raw = readInputValue(host, field).trim();
  if (!raw) return '';
  const num = Number(raw);
  return Number.isInteger(num) && num >= 0 && num <= 20 ? num : '';
}

/**
 * Display format / currency / fraction digits / suffix controls shared by Number and Computed.
 * @param options.append When true, append into `host` instead of replacing `innerHTML`.
 * @param options.hint Override the help text under the controls.
 */
export function renderNumericDisplayFormatFields(
  host: ParentNode & { innerHTML?: string; insertAdjacentHTML?: Function; appendChild?: Function; querySelector?: Function },
  schema: { displayFormat?: unknown; currencyCode?: unknown; fractionDigits?: unknown; suffix?: unknown },
  options: { append?: boolean; hint?: string } = {},
) {
  const displayFormat = normalizeIntegerDisplayFormat(schema.displayFormat);
  const fractionDigits =
    schema.fractionDigits == null || schema.fractionDigits === ''
      ? ''
      : String(schema.fractionDigits);
  const hint =
    options.hint ??
    'Stored value stays a plain number. Format applies in the document, preview, and PDF.';
  const html = `
        <label class="schema-form__row">
          <span>Display format</span>
          <select data-field="displayFormat">
            <option value="plain"${displayFormat === 'plain' ? ' selected' : ''}>Plain</option>
            <option value="number"${displayFormat === 'number' ? ' selected' : ''}>Number</option>
            <option value="currency"${displayFormat === 'currency' ? ' selected' : ''}>Currency</option>
          </select>
        </label>
        <label class="schema-form__row" data-role="currency-code-row">
          <span>Currency</span>
          <input type="text" data-field="currencyCode" value="${escapeAttr(schema.currencyCode ?? 'EUR')}" placeholder="EUR" maxlength="3" />
        </label>
        <label class="schema-form__row" data-role="fraction-digits-row">
          <span>Fraction digits</span>
          <input type="number" data-field="fractionDigits" min="0" max="20" value="${escapeAttr(fractionDigits)}" placeholder="auto" />
        </label>
        <label class="schema-form__row" data-role="suffix-row">
          <span>Suffix</span>
          <input type="text" data-field="suffix" value="${escapeAttr(schema.suffix ?? '')}" placeholder="e.g. mmHg" />
        </label>
        <p class="schema-form__hint" data-role="display-format-hint">${hint}</p>
      `;

  if (options.append && typeof (host as Element).insertAdjacentHTML === 'function') {
    (host as Element).insertAdjacentHTML('beforeend', html);
  } else {
    (host as { innerHTML: string }).innerHTML = html;
  }

  const formatSelect = (host as Element).querySelector('[data-field="displayFormat"]');
  const currencyRow = (host as Element).querySelector('[data-role="currency-code-row"]');
  const fractionRow = (host as Element).querySelector('[data-role="fraction-digits-row"]');
  const suffixRow = (host as Element).querySelector('[data-role="suffix-row"]');
  const setHidden = (el: Element | null, hidden: boolean) => {
    if (el && 'hidden' in el) (el as HTMLElement).hidden = hidden;
  };
  const syncRows = (mode: string) => {
    setHidden(currencyRow, mode !== 'currency');
    setHidden(fractionRow, mode === 'plain');
    setHidden(suffixRow, mode === 'currency');
  };
  syncRows(displayFormat);
  formatSelect?.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLSelectElement | null;
    if (!target) return;
    syncRows(normalizeIntegerDisplayFormat(target.value));
  });
}

export function readNumericDisplayFormatFields(host: ParentNode): {
  displayFormat: 'plain' | 'number' | 'currency';
  currencyCode: string;
  fractionDigits: number | '';
  suffix: string;
} {
  return {
    displayFormat: normalizeIntegerDisplayFormat(readInputValue(host, 'displayFormat')),
    currencyCode: readInputValue(host, 'currencyCode').trim().toUpperCase() || 'EUR',
    fractionDigits: readOptionalInteger(host, 'fractionDigits'),
    suffix: readInputValue(host, 'suffix'),
  };
}
