import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

function installDom() {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  const view = document.defaultView;
  globalThis.document = document;
  globalThis.window = Object.assign(view, {
    innerWidth: 1200,
    innerHeight: 800,
  });
  globalThis.HTMLElement = view.HTMLElement;
  globalThis.Element = view.Element;
  globalThis.Event = view.Event;
  return document;
}

function dispatchKey(_target: Element | null, key: string) {
  const event = new Event('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'key', { value: key });
  // Pickers listen on window (capture) so the editor behind cannot scroll.
  window.dispatchEvent(event);
}

describe('createListModal manual edit visibility', () => {
  it('shows Custom entries when allowManualEdit is true', async () => {
    installDom();
    const { createListModal } = await import('./list-modal.js');

    createListModal().open({
      title: 'List',
      items: [{ id: 'item1', label: 'Option 1' }],
      allowManualEdit: true,
      initialText: 'Custom value',
    });

    assert.equal(document.querySelector('.modal__custom-entries')?.hidden, false);
    assert.equal(document.querySelector('.modal__selection-pills')?.hidden, true);
    assert.equal(document.querySelector('.modal__edit-manually'), null);
  });

  it('shows selection pills when allowManualEdit is false and values are selected', async () => {
    installDom();
    const { createListModal } = await import('./list-modal.js');

    createListModal().open({
      title: 'List',
      items: [{ id: 'item1', label: 'Option 1' }],
      allowManualEdit: false,
      selected: ['Option 1'],
    });

    assert.equal(document.querySelector('.modal__custom-entries')?.hidden, true);
    assert.equal(document.querySelector('.modal__selection-pills')?.hidden, false);
  });

  it('navigates visible rows with arrow keys and toggles with Space', async () => {
    installDom();
    const { createListModal } = await import('./list-modal.js');

    createListModal().open({
      title: 'List',
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      multi: true,
      allowManualEdit: false,
      selected: [],
    });

    const overlay = document.querySelector('.modal-overlay');
    assert.ok(overlay);

    dispatchKey(overlay, 'ArrowDown');
    const rows = [...document.querySelectorAll('.list-item')];
    assert.ok(rows[0]?.classList.contains('modal-picker-row--active'));

    dispatchKey(overlay, 'ArrowDown');
    assert.ok(rows[1]?.classList.contains('modal-picker-row--active'));

    dispatchKey(overlay, ' ');
    const checkbox = rows[1]?.querySelector('input');
    assert.equal(checkbox?.checked, true);
  });

  it('Enter toggles highlighted row in multi-select mode', async () => {
    installDom();
    const { createListModal } = await import('./list-modal.js');

    createListModal().open({
      title: 'List',
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      multi: true,
      allowManualEdit: false,
      selected: [],
    });

    const overlay = document.querySelector('.modal-overlay');
    dispatchKey(overlay, 'ArrowDown');
    dispatchKey(overlay, 'ArrowDown');

    const searchInput = document.querySelector('.modal__search');
    const enterEvent = new Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(enterEvent, 'key', { value: 'Enter' });
    searchInput?.dispatchEvent(enterEvent);

    const rows = [...document.querySelectorAll('.list-item')];
    assert.equal(rows[1]?.querySelector('input')?.checked, true);
  });

  it('clicking a row sets keyboard highlight', async () => {
    installDom();
    const { createListModal } = await import('./list-modal.js');

    createListModal().open({
      title: 'List',
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      multi: true,
      allowManualEdit: false,
      selected: [],
    });

    const row = document.querySelectorAll('.list-item')[1];
    row?.dispatchEvent(new Event('click', { bubbles: true }));
    assert.ok(row?.classList.contains('modal-picker-row--active'));
  });

  it('search highlights the first matching row', async () => {
    installDom();
    const { createListModal } = await import('./list-modal.js');

    createListModal().open({
      title: 'List',
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'glaucoma' },
        { id: 'c', label: 'trauma' },
      ],
      multi: true,
      allowManualEdit: false,
      selected: [],
    });

    const searchInput = document.querySelector('.modal__search') as HTMLInputElement;
    searchInput.value = 'oma';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    const rows = [...document.querySelectorAll('.list-item')];
    assert.equal(rows.length, 1);
    assert.ok(rows[0]?.classList.contains('modal-picker-row--active'));
    assert.match(rows[0]?.textContent ?? '', /glaucoma/);
  });

  it('navigates down with ArrowDown in choice (single-select) mode', async () => {
    installDom();
    const { createListModal } = await import('./list-modal.js');

    createListModal().open({
      title: 'OS',
      items: [
        { id: 'a', label: 'normal' },
        { id: 'b', label: 'pathology' },
        { id: 'c', label: 'clouding' },
        { id: 'd', label: 'clear' },
      ],
      multi: false,
      allowManualEdit: false,
      selected: ['clouding'],
    });

    const overlay = document.querySelector('.modal-overlay');
    const rows = [...document.querySelectorAll('.list-item')];
    rows[1]?.dispatchEvent(new Event('click', { bubbles: true }));
    assert.ok(rows[1]?.classList.contains('modal-picker-row--active'));

    dispatchKey(overlay, 'ArrowDown');
    assert.ok(rows[2]?.classList.contains('modal-picker-row--active'));
    assert.equal(overlay?.hidden, false);

    dispatchKey(overlay, 'ArrowDown');
    assert.ok(rows[3]?.classList.contains('modal-picker-row--active'));
    assert.equal(overlay?.hidden, false);
  });

  it('auto-closes single-select choice on catalog pick even with allowManualEdit', async () => {
    installDom();
    const { createListModal } = await import('./list-modal.js');

    const modal = createListModal();
    const promise = modal.open({
      title: 'Choice',
      items: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ],
      multi: false,
      allowManualEdit: true,
      initialText: '',
    });

    const overlay = document.querySelector('.modal-overlay');
    assert.equal(overlay?.hidden, false);

    const radio = document.querySelector('.list-item input');
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));

    const result = await promise;
    assert.deepEqual(result, ['Alpha']);
    assert.equal(overlay?.hidden, true);
  });
});
