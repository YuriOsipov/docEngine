export function renderSelectionPills(
  container: Element | null,
  lines: string[],
  onRemove: (line: string) => void,
) {
  if (!container) return;
  container.innerHTML = '';
  for (const line of lines) {
    const pill = document.createElement('span');
    pill.className = 'modal__selection-pill';

    const label = document.createElement('span');
    label.className = 'modal__selection-pill-label';
    label.textContent = line;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'modal__selection-pill-remove';
    removeBtn.setAttribute('aria-label', `Remove ${line}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove(line);
    });

    pill.appendChild(label);
    pill.appendChild(removeBtn);
    container.appendChild(pill);
  }
  container.hidden = lines.length === 0;
}
