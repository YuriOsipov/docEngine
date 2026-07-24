/**
 * Mount a 3-column design-mode shell around the editor holder.
 * @param {HTMLElement} holder
 */
export function createDesignShell(holder: any) {
  const shell = document.createElement('div');
  shell.className = 'design-shell';

  const left = document.createElement('aside');
  left.className = 'design-panel design-panel--left';
  left.setAttribute('aria-label', 'Source');

  const center = document.createElement('div');
  center.className = 'design-panel design-panel--center';

  const right = document.createElement('aside');
  right.className = 'design-panel design-panel--right';
  right.setAttribute('aria-label', 'Properties');

  const parent = holder.parentElement;
  if (!parent) throw new Error('createDesignShell: holder has no parent');

  parent.insertBefore(shell, holder);
  shell.append(left, center, right);
  center.appendChild(holder);

  return {
    element: shell,
    leftPanel: left,
    centerPanel: center,
    rightPanel: right,
    show() {
      shell.classList.add('design-shell--active');
      document.body.classList.add('design-mode--panels');
    },
    hide() {
      shell.classList.remove('design-shell--active');
      document.body.classList.remove('design-mode--panels');
    },
    destroy() {
      this.hide();
      if (holder.parentElement === center) {
        parent.insertBefore(holder, shell);
      }
      shell.remove();
    },
  };
}
