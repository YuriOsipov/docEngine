import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { parseHTML } from 'linkedom';
import {
  readPanelSplitCookie,
  writePanelSplitCookie,
  wirePanelSplitter,
} from './wire-panel-splitter.js';

describe('wire-panel-splitter', () => {
  beforeEach(() => {
    const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
    globalThis.document = document;
    document.cookie = '';
  });

  it('readPanelSplitCookie returns null when cookie is missing', () => {
    assert.equal(readPanelSplitCookie('field-mapping-panels'), null);
  });

  it('writePanelSplitCookie and readPanelSplitCookie round-trip sizes', () => {
    writePanelSplitCookie('field-mapping-panels', [25, 50, 25]);
    assert.deepEqual(readPanelSplitCookie('field-mapping-panels'), [25, 50, 25]);
  });

  it('wirePanelSplitter applies default sizes to panels', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <section class="field-mapping-panel"></section>
      <div class="field-mapping-splitter"></div>
      <section class="field-mapping-panel"></section>
      <div class="field-mapping-splitter"></div>
      <section class="field-mapping-panel"></section>
    `;
    document.body.appendChild(container);

    wirePanelSplitter(container, {
      cookieKey: 'field-mapping-panels',
      defaultSizes: [25, 50, 25],
    });

    const panels = [...container.querySelectorAll('.field-mapping-panel')];
    assert.equal(panels[0].style.width, '25%');
    assert.equal(panels[1].style.width, '50%');
    assert.equal(panels[2].style.width, '25%');
  });
});
