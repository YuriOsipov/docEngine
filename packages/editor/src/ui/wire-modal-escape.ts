/**
 * Close a modal when Escape is pressed while it is visible.
 *
 * Uses window capture + stopImmediatePropagation so host shells
 * (e.g. Salesforce LightningModal) do not also dismiss when a nested
 * field dialog is open — including when focus moved to modal chrome
 * outside the editor body.
 *
 * @param {HTMLElement} overlay
 * @param {() => void} onEscape
 */
export function wireModalEscape(overlay: any, onEscape: any) {
  const onKeydown = (e: any) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (overlay.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    onEscape();
  };
  // window capture runs before Lightning modal / document bubble handlers.
  window.addEventListener('keydown', onKeydown, true);
}
