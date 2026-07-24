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
    const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    globalThis.document = document;
    globalThis.window = {
      innerWidth: 1200,
      innerHeight: 800,
      document,
    } as any;
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
});
