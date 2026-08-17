import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { parseHTML } from 'linkedom';
import { migrateFieldIds } from '../core/field-id.js';
import { SchemaRegistry } from '../registry/schema-registry.js';
import { formatManualEditText } from '../fields/manual-field-values.js';

function installDom() {
  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  const view = document.defaultView;
  globalThis.document = document;
  globalThis.window = view;
  globalThis.HTMLElement = view.HTMLElement;
  globalThis.Element = view.Element;
  globalThis.Event = view.Event;
  return document;
}

function dispatchKey(_target: Element | null, key: string) {
  const event = new Event('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'key', { value: key });
  window.dispatchEvent(event);
}

function loadMammologyStLocalisTree() {
  const tpl = JSON.parse(
    readFileSync(new URL('../../../../examples/mammology-document-template.json', import.meta.url), 'utf8'),
  );
  const { fieldSchemas } = migrateFieldIds(tpl.blocks, tpl.fieldSchemas);
  const registry = new SchemaRegistry();
  registry.setFieldSchemas(fieldSchemas);
  return registry.getFieldDef('mammologyexam_st_localis');
}

describe('createTreeModal manual edit sync', () => {
  it('merges checked catalog paths into Custom entries on checkbox change', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');

    const tree = [
      {
        label: 'Parent',
        children: [{ label: 'Child A' }, { label: 'Child B' }],
      },
    ];

    const modal = createTreeModal();
    const openPromise = modal.open({
      title: 'Test',
      tree,
      allowManualEdit: true,
      initialText: 'nothing',
    });

    document.querySelector('.tree-node__toggle')?.click();

    const checkbox = document.querySelector('.tree-node__checkbox:not(:disabled)');
    assert.ok(checkbox);
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    const textarea = document.querySelector('.modal__custom-entries-input');
    assert.equal(textarea?.value, 'nothing; Parent Child A');

    document.querySelector('[data-action="ok"]')?.click();
    assert.deepEqual(await openPromise, ['nothing', 'Parent Child A']);
  });

  it('merges checked catalog paths when clicking the row label', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');

    const tree = [
      {
        label: 'Parent',
        children: [{ label: 'Child A' }],
      },
    ];

    const modal = createTreeModal();
    modal.open({
      title: 'Test',
      tree,
      allowManualEdit: true,
      initialText: 'nothing',
    });

    document.querySelector('.tree-node__toggle')?.click();
    const rows = [...document.querySelectorAll('.tree-node__row')];
    rows[rows.length - 1]?.click();

    const textarea = document.querySelector('.modal__custom-entries-input');
    assert.equal(textarea?.value, 'nothing; Parent Child A');
  });

  it('mammology: open with existing value keeps textarea after expand', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');
    const def = loadMammologyStLocalisTree();
    const currentValue = [
      'Права грудна залоза бугристі структури різної величини',
      'Ліва грудна залоза тканина однорідна',
    ];

    createTreeModal().open({
      title: def.label,
      tree: def.tree,
      allowManualEdit: true,
      initialText: formatManualEditText(currentValue, 'tree'),
    });

    const expected = formatManualEditText(currentValue, 'tree');
    const textarea = document.querySelector('.modal__custom-entries-input');
    assert.equal(textarea?.value, expected);

    const parentToggles = [...document.querySelectorAll('.tree-node__toggle:not(.tree-node__toggle--leaf)')];
    parentToggles[0]?.click();
    parentToggles[1]?.click();

    assert.equal(textarea?.value, expected);
  });

  it('mammology: open empty then check two leaves fills textarea', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');
    const def = loadMammologyStLocalisTree();

    createTreeModal().open({
      title: def.label,
      tree: def.tree,
      allowManualEdit: true,
      initialText: '',
    });

    const parentToggles = [...document.querySelectorAll('.tree-node__toggle:not(.tree-node__toggle--leaf)')];
    parentToggles[0]?.click();
    parentToggles[1]?.click();

    const leaves = [...document.querySelectorAll('.tree-node__checkbox:not(:disabled)')];
    leaves[1].checked = true;
    leaves[1].dispatchEvent(new Event('change', { bubbles: true }));
    leaves[5].checked = true;
    leaves[5].dispatchEvent(new Event('change', { bubbles: true }));

    const textarea = document.querySelector('.modal__custom-entries-input');
    assert.equal(
      textarea?.value,
      'Права грудна залоза бугристі структури різної величини; Ліва грудна залоза бугристі структури різної величини',
    );
  });

  it('preserves free-text line when checking and unchecking catalog items', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');

    const tree = [
      {
        label: 'Parent',
        children: [{ label: 'Child A' }, { label: 'Child B' }],
      },
    ];

    createTreeModal().open({
      title: 'Test',
      tree,
      allowManualEdit: true,
      initialText: 'nothing',
    });

    document.querySelector('.tree-node__toggle')?.click();
    const checkbox = document.querySelector('.tree-node__checkbox:not(:disabled)');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    assert.equal(
      document.querySelector('.modal__custom-entries-input')?.value,
      'nothing; Parent Child A',
    );

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    assert.equal(document.querySelector('.modal__custom-entries-input')?.value, 'nothing');
  });

  it('preserves mixed free-text and catalog order on open', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');
    const def = loadMammologyStLocalisTree();
    const savedText =
      'Checking /// Права грудна залоза тканина однорідна; Без особливостей';

    createTreeModal().open({
      title: def.label,
      tree: def.tree,
      allowManualEdit: true,
      initialText: savedText,
    });

    const textarea = document.querySelector('.modal__custom-entries-input');
    assert.equal(textarea?.value, savedText);

    const parentToggles = [...document.querySelectorAll('.tree-node__toggle:not(.tree-node__toggle--leaf)')];
    parentToggles[0]?.click();
    assert.equal(textarea?.value, savedText);
  });

  it('shows custom entries when allowManualEdit is true and selection pills when false', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');
    const def = loadMammologyStLocalisTree();

    createTreeModal().open({
      title: def.label,
      tree: def.tree,
      allowManualEdit: true,
      initialText: 'Без особливостей',
    });

    assert.equal(document.querySelector('.modal__custom-entries')?.hidden, false);
    assert.equal(document.querySelector('.modal__selection-pills')?.hidden, true);
    assert.equal(document.querySelector('.modal__edit-manually'), null);

    installDom();
    const { createTreeModal: createTreeModal2 } = await import('./tree-modal.js');

    createTreeModal2().open({
      title: def.label,
      tree: def.tree,
      allowManualEdit: false,
      selected: ['Без особливостей'],
    });

    assert.equal(document.querySelector('.modal__custom-entries')?.hidden, true);
    assert.equal(document.querySelector('.modal__selection-pills')?.hidden, false);
  });

  it('navigates visible rows with arrow keys and toggles with Space', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');

    const tree = [
      {
        label: 'Parent',
        children: [{ label: 'Child A' }, { label: 'Child B' }],
      },
    ];

    createTreeModal().open({
      title: 'Test',
      tree,
      allowManualEdit: false,
      selected: [],
    });

    document.querySelector('.tree-node__toggle')?.click();

    const overlay = document.querySelector('.modal-overlay');
    const rows = [...document.querySelectorAll('.tree-node__row')];
    assert.ok(rows[0]?.classList.contains('modal-picker-row--active'));

    dispatchKey(overlay, 'ArrowDown');
    assert.ok(rows[1]?.classList.contains('modal-picker-row--active'));

    dispatchKey(overlay, ' ');
    const checkbox = rows[1]?.querySelector('.tree-node__checkbox:not(:disabled)');
    assert.equal(checkbox?.checked, true);
  });

  it('Enter toggles highlighted row instead of always picking the first', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');

    const tree = [
      {
        label: 'Parent',
        children: [{ label: 'Child A' }, { label: 'Child B' }],
      },
    ];

    createTreeModal().open({
      title: 'Test',
      tree,
      allowManualEdit: false,
      selected: [],
    });

    document.querySelector('.tree-node__toggle')?.click();
    const overlay = document.querySelector('.modal-overlay');
    dispatchKey(overlay, 'ArrowDown');
    dispatchKey(overlay, 'ArrowDown');
    dispatchKey(overlay, 'ArrowDown');

    const searchInput = document.querySelector('.modal__search');
    const enterEvent = new Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(enterEvent, 'key', { value: 'Enter' });
    searchInput?.dispatchEvent(enterEvent);

    const rows = [...document.querySelectorAll('.tree-node__row')];
    const childB = rows[2]?.querySelector('.tree-node__checkbox:not(:disabled)');
    assert.equal(childB?.checked, true);
  });

  it('ArrowRight expands highlighted parent row', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');

    createTreeModal().open({
      title: 'Test',
      tree: [{ label: 'Parent', children: [{ label: 'Child A' }] }],
      allowManualEdit: false,
      selected: [],
    });

    const overlay = document.querySelector('.modal-overlay');
    dispatchKey(overlay, 'ArrowDown');
    dispatchKey(overlay, 'ArrowRight');

    assert.equal(document.querySelectorAll('.tree-node__row').length, 2);
  });

  it('clicking a row sets keyboard highlight', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');

    createTreeModal().open({
      title: 'Test',
      tree: [{ label: 'Parent', children: [{ label: 'Child A' }] }],
      allowManualEdit: false,
      selected: [],
    });

    document.querySelector('.tree-node__toggle')?.click();
    const rows = [...document.querySelectorAll('.tree-node__row')];
    rows[1]?.dispatchEvent(new Event('click', { bubbles: true }));
    assert.ok(rows[1]?.classList.contains('modal-picker-row--active'));
  });

  it('search highlights the first matching leaf', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');

    createTreeModal().open({
      title: 'Life history',
      tree: [
        {
          label: 'Family history',
          children: [{ label: 'glaucoma' }, { label: 'diabetes' }],
        },
        {
          label: 'Past illnesses',
          children: [{ label: 'trauma' }],
        },
      ],
      allowManualEdit: false,
      selected: [],
    });

    const searchInput = document.querySelector('.modal__search') as HTMLInputElement;
    searchInput.value = 'oma';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    const active = document.querySelector('.modal-picker-row--active');
    assert.ok(active);
    assert.match(active?.textContent ?? '', /glaucoma/);
    assert.ok(active?.querySelector('.tree-node__checkbox:not(:disabled)'));
  });

  it('search skips visible non-matching leaves', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');

    createTreeModal().open({
      title: 'Life history',
      tree: [
        {
          label: 'Chronic conditions',
          children: [
            { label: 'diabetes mellitus' },
            { label: 'hypertension' },
            { label: 'thyroid disease' },
          ],
        },
      ],
      allowManualEdit: false,
      selected: [],
    });

    const searchInput = document.querySelector('.modal__search') as HTMLInputElement;
    searchInput.value = 'o';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));

    const active = document.querySelector('.modal-picker-row--active');
    assert.ok(active);
    assert.match(active?.textContent ?? '', /hypertension/);
    assert.doesNotMatch(active?.textContent ?? '', /diabetes mellitus/);
  });

  it('unchecking catalog entry removes only that segment and preserves free-text order', async () => {
    installDom();
    const { createTreeModal } = await import('./tree-modal.js');
    const def = loadMammologyStLocalisTree();
    const savedText =
      'Checking /// Права грудна залоза тканина однорідна; Без особливостей';

    createTreeModal().open({
      title: def.label,
      tree: def.tree,
      allowManualEdit: true,
      initialText: savedText,
    });

    const bezCheckbox = [...document.querySelectorAll('.tree-node__checkbox:not(:disabled)')]
      .find((input: any) => input.closest('.tree-node')?.querySelector('.tree-node__label')?.textContent === 'Без особливостей');
    assert.ok(bezCheckbox?.checked);

    bezCheckbox.checked = false;
    bezCheckbox.dispatchEvent(new Event('change', { bubbles: true }));

    const textarea = document.querySelector('.modal__custom-entries-input');
    assert.equal(textarea?.value, 'Checking /// Права грудна залоза тканина однорідна');

    bezCheckbox.checked = true;
    bezCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    assert.equal(textarea?.value, savedText);
  });

  it('does not remove a parent mapping overlay that contains a leftover nested tree dialog', async () => {
    const doc = installDom();
    const mappingOverlay = doc.createElement('div');
    mappingOverlay.className = 'modal-overlay modal-overlay--field-mapping';
    mappingOverlay.innerHTML = `
      <div class="modal modal--field-mapping">
        <div class="modal-overlay modal-overlay--palette">
          <div class="modal modal--tree"></div>
        </div>
      </div>
    `;
    doc.body.appendChild(mappingOverlay);

    const { createTreeModal } = await import('./tree-modal.js');
    createTreeModal();

    assert.ok(
      doc.body.contains(mappingOverlay),
      'field-mapping overlay must survive tree-modal remount',
    );
    assert.equal(doc.querySelectorAll('.modal-overlay--field-mapping').length, 1);
  });
});
