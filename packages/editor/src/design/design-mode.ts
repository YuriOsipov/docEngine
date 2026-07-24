export function applyDesignMode(enabled: any) {
  document.body.classList.toggle('design-mode', enabled);
}

export function isDesignMode() {
  return document.body.classList.contains('design-mode');
}
