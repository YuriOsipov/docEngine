import { ACTION_ICONS } from './action-icons.js';

/**
 * Optional document action strip. Preview now lives on the format toolbar;
 * this bar is kept for API compatibility (setBusy) when hosts still mount it.
 */
export function createDocumentActions({ onPreview = null }: { onPreview?: (() => void) | null } = {}) {
  const bar = document.createElement('div');
  bar.className = 'document-actions';

  let btnPreview: HTMLButtonElement | null = null;
  if (onPreview) {
    btnPreview = document.createElement('button');
    btnPreview.type = 'button';
    btnPreview.className = 'btn btn-sm document-actions__btn document-actions__btn--icon';
    btnPreview.innerHTML = ACTION_ICONS.preview;
    btnPreview.title = 'Preview';
    btnPreview.setAttribute('aria-label', 'Preview document');
    btnPreview.addEventListener('click', () => onPreview?.());
    bar.appendChild(btnPreview);
  } else {
    bar.hidden = true;
  }

  return {
    element: bar,
    setBusy(busy: any) {
      if (!btnPreview) return;
      btnPreview.disabled = !!busy;
      btnPreview.title = busy ? 'Generating preview…' : 'Preview';
    },
  };
}
