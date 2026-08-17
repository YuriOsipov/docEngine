import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHTML } from 'linkedom';
import { createDateModal } from './date-modal.js';

function installDom() {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  const view = document.defaultView as Window & typeof globalThis;
  globalThis.document = document;
  globalThis.window = Object.assign(view, {
    innerWidth: 1200,
    innerHeight: 800,
    requestAnimationFrame: (cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number,
  });
  globalThis.requestAnimationFrame = globalThis.window.requestAnimationFrame;
  globalThis.HTMLElement = view.HTMLElement;
  globalThis.Element = view.Element;
  globalThis.Event = view.Event;
  document.cookie = '';
  return document;
}

describe('createDateModal', () => {
  it('uses the shared field-form dialog shell', async () => {
    installDom();
    const modal = createDateModal();
    const pending = modal.open({ title: 'Visited', value: '2026-08-13' });

    const overlay = document.querySelector('.modal-overlay') as HTMLElement | null;
    const dialog = overlay?.querySelector('.modal') as HTMLElement | null;
    const input = overlay?.querySelector('.modal__input') as HTMLInputElement | null;
    assert.ok(overlay);
    assert.ok(dialog?.classList.contains('modal--movable'));
    assert.ok(overlay.className.includes('modal-overlay--palette'));
    assert.equal(overlay.querySelector('.modal__header')?.textContent, 'Visited');
    assert.equal(input?.value, '2026-08-13');

    (overlay.querySelector('[data-action="ok"]') as HTMLButtonElement).click();
    assert.equal(await pending, '2026-08-13');
  });
});
