import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { wireModalEscape } from './wire-modal-escape.js';

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

function dispatchEscape(captureListenerOrder: string[]) {
  const event = new Event('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'key', { value: 'Escape' });
  // Simulate a later bubble listener (e.g. host modal) — must not run when overlay is open.
  window.addEventListener('keydown', () => {
    captureListenerOrder.push('host-bubble');
  });
  window.dispatchEvent(event);
}

describe('wireModalEscape', () => {
  it('closes open overlay and blocks later Escape listeners', () => {
    const document = installDom();
    const overlay = document.createElement('div');
    overlay.hidden = false;
    document.body.appendChild(overlay);

    const order: string[] = [];
    wireModalEscape(overlay, () => {
      order.push('overlay-escape');
      overlay.hidden = true;
    });

    dispatchEscape(order);

    assert.deepEqual(order, ['overlay-escape']);
    assert.equal(overlay.hidden, true);
  });

  it('does not intercept Escape when overlay is hidden', () => {
    const document = installDom();
    const overlay = document.createElement('div');
    overlay.hidden = true;
    document.body.appendChild(overlay);

    let called = false;
    wireModalEscape(overlay, () => {
      called = true;
    });

    const order: string[] = [];
    dispatchEscape(order);

    assert.equal(called, false);
    assert.deepEqual(order, ['host-bubble']);
  });
});
