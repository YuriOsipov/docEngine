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
