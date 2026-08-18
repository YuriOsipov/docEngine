import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  readModalSizeCookie,
  writeModalSizeCookie,
  wireModalResize,
} from './wire-modal-resize.js';

describe('wire-modal-resize', () => {
  beforeEach(() => {
    const { document, window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    globalThis.document = document;
    globalThis.window = Object.assign(window, {
      innerWidth: 1200,
      innerHeight: 800,
    }) as any;
    globalThis.Event = window.Event;
    document.cookie = '';
  });

  it('readModalSizeCookie returns null when cookie is missing', () => {
    assert.equal(readModalSizeCookie('tree-picker'), null);
  });

  it('writeModalSizeCookie and readModalSizeCookie round-trip dimensions', () => {
    writeModalSizeCookie('tree-picker', 640, 520);
    assert.deepEqual(readModalSizeCookie('tree-picker'), { width: 640, height: 520 });
  });

  it('wireModalResize restores saved size on the modal element', () => {
    writeModalSizeCookie('list-picker', 700, 600);

    const modal = document.createElement('div');
    modal.className = 'modal modal--list';
    document.body.appendChild(modal);

    wireModalResize(modal, { cookieKey: 'list-picker' });

    assert.equal(modal.style.width, '700px');
    assert.equal(modal.style.height, '600px');
    assert.ok(modal.querySelector('.modal__resize-handle'));
  });

  it('resizes the dialog from pointerdown so touch devices can drag the handle', () => {
    const modal = document.createElement('div');
    modal.className = 'modal';
    Object.defineProperty(modal, 'offsetWidth', { configurable: true, get: () => 400 });
    Object.defineProperty(modal, 'offsetHeight', { configurable: true, get: () => 320 });
    document.body.appendChild(modal);

    wireModalResize(modal, { cookieKey: 'list-picker', minWidth: 320, minHeight: 280 });
    const handle = modal.querySelector('.modal__resize-handle');
    assert.ok(handle);

    function fire(target: EventTarget, type: string, clientX: number, clientY: number) {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'button', { value: 0 });
      Object.defineProperty(event, 'isPrimary', { value: true });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      Object.defineProperty(event, 'clientX', { value: clientX });
      Object.defineProperty(event, 'clientY', { value: clientY });
      target.dispatchEvent(event);
    }

    fire(handle as Element, 'pointerdown', 400, 320);
    fire(document, 'pointermove', 480, 400);
    assert.equal(modal.style.width, '480px');
    assert.equal(modal.style.height, '400px');

    Object.defineProperty(modal, 'offsetWidth', { configurable: true, get: () => 480 });
    Object.defineProperty(modal, 'offsetHeight', { configurable: true, get: () => 400 });
    fire(document, 'pointerup', 480, 400);
    assert.deepEqual(readModalSizeCookie('list-picker'), { width: 480, height: 400 });
  });
});
