let container: any = null;
/** @type {Map<string, () => void>} */
const activeKeyedNotifications = new Map();

function ensureContainer() {
  if (container?.isConnected) return container;
  container = document.createElement('div');
  container.className = 'app-notifications';
  container.setAttribute('aria-live', 'polite');
  document.body.appendChild(container);
  return container;
}

export function showNotification(message: any,{ type = 'error', durationMs = 10000, key = null }: any = {}) {
  if (key && activeKeyedNotifications.has(key)) {
    return activeKeyedNotifications.get(key);
  }

  const root = ensureContainer();
  const el = document.createElement('div');
  el.className = `app-notification app-notification--${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const text = document.createElement('p');
  text.className = 'app-notification__message';
  text.textContent = message;
  el.appendChild(text);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'app-notification__close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = '×';
  el.appendChild(closeBtn);

  function dismiss() {
    if (key) activeKeyedNotifications.delete(key);
    el.classList.add('app-notification--leaving');
    window.setTimeout(() => el.remove(), 200);
  }

  closeBtn.addEventListener('click', dismiss);

  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('app-notification--visible'));

  if (key) activeKeyedNotifications.set(key, dismiss);

  if (durationMs > 0) {
    window.setTimeout(dismiss, durationMs);
  }

  return dismiss;
}
