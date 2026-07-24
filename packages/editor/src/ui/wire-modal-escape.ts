/**
 * Close a modal when Escape is pressed while it is visible.
 * @param {HTMLElement} overlay
 * @param {() => void} onEscape
 */
export function wireModalEscape(overlay: any,onEscape: any) {
  document.addEventListener('keydown', (e: any) => {
    if (e.key === 'Escape' && !overlay.hidden) {
      e.preventDefault();
      onEscape();
    }
  });
}
