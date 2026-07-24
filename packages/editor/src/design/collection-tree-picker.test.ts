import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { renderCollectionTreePicker } from './collection-tree-picker.js';

function installDom() {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.document = document;
  globalThis.window = { document } as any;
  globalThis.HTMLElement = document.defaultView.HTMLElement;
  globalThis.Event = document.defaultView.Event;
  return document;
}

describe('collection-tree-picker', () => {
  it('renders presets under collections and selects a bookmark preset', async () => {
    installDom();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const picker = renderCollectionTreePicker(host, {
      getCatalog: async () => ({
        bookmarks: [],
        tree: [
          {
            id: 'patient',
            label: 'Patient',
            kind: 'collection',
            collectionId: 'patient',
            children: [
              {
                id: 'preset:21',
                label: 'new',
                kind: 'preset',
                collectionId: 'patient',
                presetId: '21',
              },
            ],
          },
          {
            id: 'catalog',
            label: 'Catalog',
            kind: 'folder',
            children: [
              { id: 'encounter', label: 'Encounter', kind: 'collection', collectionId: 'encounter' },
            ],
          },
        ],
      }),
      initialCollectionId: '',
    });

    await new Promise((resolve: any) => setTimeout(resolve, 0));

    assert.ok(host.textContent.includes('Patient'));
    assert.ok(host.textContent.includes('new'));

    const presetLeaf = host.querySelector('.collection-tree-picker__leaf--preset');
    assert.ok(presetLeaf);
    presetLeaf.click();

    assert.equal(picker.getSelectedCollection(), 'patient');
    assert.equal(picker.getSelectedPresetId(), '21');
    assert.equal(picker.hiddenInput.value, 'patient');
  });

  it('restores bookmark label after reload when a preset id is selected', async () => {
    installDom();
    const host = document.createElement('div');
    document.body.appendChild(host);

    const catalog = {
      bookmarks: [],
      tree: [
        {
          id: 'patient',
          label: 'Patient',
          kind: 'collection',
          collectionId: 'patient',
          children: [
            {
              id: 'preset:21',
              label: 'new',
              kind: 'preset',
              collectionId: 'patient',
              presetId: '21',
            },
          ],
        },
      ],
    };

    renderCollectionTreePicker(host, {
      getCatalog: async () => catalog,
      initialCollectionId: 'patient',
      initialPresetId: '21',
    });

    await new Promise((resolve: any) => setTimeout(resolve, 0));

    const selectedRow = host.querySelector('.collection-tree-picker__selected');
    assert.ok(selectedRow);
    assert.equal(selectedRow.textContent, 'new · patient');
  });
});
