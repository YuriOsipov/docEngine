import { FORMAT_ICONS } from '../ui/format-icons.js';
import { normalizeFontSize } from '../fields/rich-text.js';

export const FONT_SIZE_SPIN_MIN = 6;
export const FONT_SIZE_SPIN_MAX = 96;
export const FONT_SIZE_SPIN_STEP = 1;

export const STYLE_FONT_SUGGESTIONS = [
  'Inter',
  'Tahoma',
  'Times New Roman',
  'Arial',
  'Calibri',
  'Georgia',
  'Courier New',
  'Verdana',
  'Segoe UI',
];

/**
 * @param {{ command: string, title: string }} options
 */
export function createStyleIconButton({ command, title }: any) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'rich-text-toolbar__btn rich-text-toolbar__btn--icon';
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.dataset.command = command;
  btn.innerHTML = FORMAT_ICONS[command] ?? '';
  return btn;
}

/**
 * @param {HTMLSelectElement | null} fontSelect
 * @param {HTMLInputElement | null} fontCustomInput
 * @param {string} fontFamily
 */
export function setFontSelectValue(fontSelect: any,fontCustomInput: any,fontFamily: any) {
  if (!fontSelect || !fontCustomInput) return;

  if (!fontFamily) {
    fontSelect.value = '';
    fontCustomInput.hidden = true;
    fontCustomInput.disabled = true;
    fontCustomInput.value = '';
    return;
  }

  const knownExact = [...fontSelect.options].some((opt: any) => opt.value === fontFamily);
  if (knownExact) {
    fontSelect.value = fontFamily;
    fontCustomInput.hidden = true;
    fontCustomInput.disabled = true;
    fontCustomInput.value = '';
    return;
  }

  // Match stacks like `Inter, ui-sans-serif, …` to the primary family option.
  const primary = String(fontFamily)
    .split(',')[0]
    .trim()
    .replace(/^["']|["']$/g, '');
  const knownPrimary = [...fontSelect.options].some((opt: any) => opt.value === primary);
  if (knownPrimary) {
    fontSelect.value = primary;
    fontCustomInput.hidden = true;
    fontCustomInput.disabled = true;
    fontCustomInput.value = '';
    return;
  }

  fontSelect.value = '__custom__';
  fontCustomInput.hidden = false;
  fontCustomInput.disabled = false;
  fontCustomInput.value = fontFamily;
}

/**
 * @param {string} hex
 */
export function toColorPickerValue(hex: any) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex ?? '');
  if (!match) return '#000000';
  let value = match[1].toLowerCase();
  if (value.length === 3) {
    value = value
      .split('')
      .map((ch: any) => ch + ch)
      .join('');
  }
  return `#${value}`;
}

/**
 * @param {import('../types.js').FieldDisplayStyle} style
 * @param {string} command
 */
export function applyPageSetupStyleCommand(style: any,command: any) {
  const next = { ...style };

  if (command === 'removeFormat') {
    return {};
  }

  if (command === 'bold') {
    if (next.fontWeight === 'bold') next.fontWeight = 'normal';
    else next.fontWeight = 'bold';
    return next;
  }

  if (command === 'italic') {
    if (next.fontStyle === 'italic') next.fontStyle = 'normal';
    else next.fontStyle = 'italic';
    return next;
  }

  if (command === 'underline') {
    if (next.textDecoration === 'underline') next.textDecoration = 'none';
    else next.textDecoration = 'underline';
    return next;
  }

  if (command === 'strikeThrough') {
    if (next.textDecoration === 'line-through') next.textDecoration = 'none';
    else next.textDecoration = 'line-through';
    return next;
  }

  return next;
}

/**
 * @param {import('../types.js').FieldDisplayStyle} style
 * @param {Map<string, HTMLButtonElement>} commandButtons
 */
export function refreshStyleCommandButtons(style: any,commandButtons: any) {
  commandButtons.get('bold')?.classList.toggle(
    'rich-text-toolbar__btn--active',
    style.fontWeight === 'bold',
  );
  commandButtons.get('italic')?.classList.toggle(
    'rich-text-toolbar__btn--active',
    style.fontStyle === 'italic',
  );
  commandButtons.get('underline')?.classList.toggle(
    'rich-text-toolbar__btn--active',
    style.textDecoration === 'underline',
  );
  commandButtons.get('strikeThrough')?.classList.toggle(
    'rich-text-toolbar__btn--active',
    style.textDecoration === 'line-through',
  );
}

/**
 * @param {string | null | undefined} value
 * @returns {number | null}
 */
export function parseFontSizeNumber(value: any) {
  const normalized = normalizeFontSize(value);
  if (!normalized) return null;
  const match = normalized.match(/^([\d.]+)/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return Number.isNaN(num) ? null : num;
}

/**
 * @param {number | null | undefined} num
 * @returns {string}
 */
export function formatFontSizePx(num: any) {
  if (num == null || Number.isNaN(num)) return '';
  const clamped = Math.min(FONT_SIZE_SPIN_MAX, Math.max(FONT_SIZE_SPIN_MIN, num));
  return `${clamped}px`;
}

/**
 * @param {{ ariaLabel?: string, placeholder?: string, disabled?: boolean }} [options]
 */
export function createFontSizeSpinInput({
  ariaLabel = 'Font size',
  placeholder = '16',
  disabled = false,
}: any = {}) {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'rich-text-toolbar__input rich-text-toolbar__input--size';
  input.min = String(FONT_SIZE_SPIN_MIN);
  input.max = String(FONT_SIZE_SPIN_MAX);
  input.step = String(FONT_SIZE_SPIN_STEP);
  input.placeholder = placeholder;
  input.setAttribute('aria-label', ariaLabel);
  input.disabled = disabled;
  return input;
}

/**
 * @param {HTMLInputElement} input
 * @param {string | null | undefined} fontSize
 */
export function setFontSizeSpinValue(input: any,fontSize: any) {
  const num = parseFontSizeNumber(fontSize);
  input.value = num != null ? String(num) : '';
}

/**
 * @param {HTMLInputElement} input
 * @returns {string}
 */
export function readFontSizeSpinValue(input: any) {
  const raw = input.value.trim();
  if (!raw) return '';
  const num = parseFloat(raw);
  if (Number.isNaN(num)) return '';
  return formatFontSizePx(num);
}
