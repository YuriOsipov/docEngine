import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createFieldMappingModal } from './field-mapping-modal.js';

function installDom() {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  const view = document.defaultView;
  globalThis.document = document;
  globalThis.window = Object.assign(view, {
    innerWidth: 1400,
    innerHeight: 900,
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number,
  });
  globalThis.HTMLElement = view.HTMLElement;
  globalThis.Element = view.Element;
  globalThis.Event = view.Event;
  globalThis.CustomEvent = view.CustomEvent;
  return document;
}

describe('field mapping modal open/close', () => {
  it('can open, cancel, and open again without hanging', async () => {
    installDom();

    const modal = createFieldMappingModal({
      getTemplate: () => ({
        blocks: [
          {
            type: 'documentSection',
            data: {
              name: 'Invoice',
              label: 'Invoice',
              segments: [{ type: 'text', content: 'Hi' }],
              fieldValues: {},
            },
          },
        ],
        fieldSchemas: {},
      }),
    });

    const first = modal.open({
      spec: { kind: 'fieldMapping', version: 1, rules: [] },
    });

    const overlay = document.querySelector('.modal-overlay--field-mapping') as HTMLElement;
    assert.ok(overlay);
    assert.equal(overlay.hidden, false);

    const cancelBtn = overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement;
    cancelBtn.click();

    await assert.rejects(
      first,
      (err: any) => err?.message === 'cancelled' || err?.name === 'AbortError',
    );
    assert.equal(overlay.hidden, true);

    const second = modal.open({
      spec: { kind: 'fieldMapping', version: 1, rules: [] },
    });
    assert.equal(overlay.hidden, false);

    cancelBtn.click();
    await assert.rejects(
      second,
      (err: any) => err?.message === 'cancelled' || err?.name === 'AbortError',
    );
    assert.equal(overlay.hidden, true);
  });
});
