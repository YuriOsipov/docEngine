import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { FIELD_PICKER_POSITION_COOKIE, writeModalPositionCookie } from './wire-modal-move.js';

function installDom() {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  const view = document.defaultView;
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

describe('createFieldFormModal', () => {
  it('uses the shared field-picker shell and restores the saved position', async () => {
    installDom();
    writeModalPositionCookie(FIELD_PICKER_POSITION_COOKIE, 140, 90);
    const { createFieldFormModal } = await import('./field-form-modal.js');

    const form = createFieldFormModal<{ title?: string; value?: string }>({
      bodyHtml: `<input type="text" class="modal__input" />`,
      focusSelector: '.modal__input',
      getValue: ({ body }) =>
        (body.querySelector('.modal__input') as HTMLInputElement | null)?.value ?? '',
      onOpen: ({ body }, opts) => {
        const input = body.querySelector('.modal__input') as HTMLInputElement | null;
        if (input) input.value = String(opts.value ?? '');
      },
    });

    const pending = form.open({ title: 'Visited', value: '2026-08-13' });
    assert.equal(form.overlay.hidden, false);
    assert.equal(form.header.textContent, 'Visited');
    assert.ok(form.modal.classList.contains('modal--movable'));
    assert.ok(form.modal.classList.contains('modal--moved'));
    assert.equal(form.modal.style.left, '140px');
    assert.equal(form.modal.style.top, '90px');
    assert.ok(form.overlay.className.includes('modal-overlay--palette'));

    (form.overlay.querySelector('[data-action="ok"]') as HTMLButtonElement).click();
    assert.equal(await pending, '2026-08-13');
    assert.equal(form.overlay.hidden, true);
  });

  it('Clear resolves empty and Close rejects', async () => {
    installDom();
    const { createFieldFormModal } = await import('./field-form-modal.js');
    const form = createFieldFormModal<{ title?: string; value?: string }>({
      bodyHtml: `<input type="text" class="modal__input" />`,
      getValue: ({ body }) =>
        (body.querySelector('.modal__input') as HTMLInputElement | null)?.value ?? '',
    });

    const cleared = form.open({ title: 'Notes', value: 'keep' });
    (form.overlay.querySelector('[data-action="clear"]') as HTMLButtonElement).click();
    assert.equal(await cleared, '');

    const closed = form.open({ title: 'Notes' });
    (form.overlay.querySelector('[data-action="close"]') as HTMLButtonElement).click();
    await assert.rejects(closed, /cancelled/);
  });

  it('validate can keep the dialog open', async () => {
    installDom();
    const { createFieldFormModal } = await import('./field-form-modal.js');
    let attempts = 0;
    const form = createFieldFormModal({
      bodyHtml: `<input type="text" class="modal__input" />`,
      getValue: () => 'bad',
      validate: (_els, value) => {
        attempts += 1;
        return attempts === 1 ? null : value;
      },
    });

    const pending = form.open({ title: 'Number' });
    (form.overlay.querySelector('[data-action="ok"]') as HTMLButtonElement).click();
    assert.equal(form.overlay.hidden, false);
    (form.overlay.querySelector('[data-action="ok"]') as HTMLButtonElement).click();
    assert.equal(await pending, 'bad');
  });
});
