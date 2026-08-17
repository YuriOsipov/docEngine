import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { parseHTML } from 'linkedom';

let isDocEngineProseDropTarget: any;
let isDocEngineCustomDrag: any;
let shouldBlockEditorJsDrop: any;
let wireEditorJsNativeDropGuard: any;
let applyNativeProseTextDrop: any;
let rangeContainsSelector: any;

before(async () => {
  const { window } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.Node = window.Node;
  globalThis.Range = window.Range;
  globalThis.InputEvent = (window as any).InputEvent || Event;
  globalThis.CSS = {
    escape: (value: string) => String(value).replace(/"/g, '\\"'),
  } as typeof CSS;

  if (!window.getSelection) {
    const win = window as any;
    win._testSelection = null;
    window.getSelection = () => {
      if (!win._testSelection) {
        win._testSelection = {
          _ranges: [] as any[],
          isCollapsed: true,
          get rangeCount() {
            return this._ranges.length;
          },
          get anchorNode() {
            return this._ranges[0]?.startContainer ?? null;
          },
          removeAllRanges() {
            this._ranges = [];
            this.isCollapsed = true;
          },
          addRange(range: any) {
            this._ranges = [range];
            this.isCollapsed = !!range.collapsed;
          },
          getRangeAt(index: any) {
            return this._ranges[index];
          },
        };
      }
      return win._testSelection;
    };
  }

  const mod = await import('./wire-editorjs-native-drop-guard.js');
  isDocEngineProseDropTarget = mod.isDocEngineProseDropTarget;
  isDocEngineCustomDrag = mod.isDocEngineCustomDrag;
  shouldBlockEditorJsDrop = mod.shouldBlockEditorJsDrop;
  wireEditorJsNativeDropGuard = mod.wireEditorJsNativeDropGuard;
  applyNativeProseTextDrop = mod.applyNativeProseTextDrop;
  rangeContainsSelector = mod.rangeContainsSelector;
});

function mockCaretAt(node: any, offset = 0) {
  (document as any).caretRangeFromPoint = () => {
    const range = document.createRange() as any;
    if (typeof range.setStart === 'function') {
      if (node.nodeType === Node.TEXT_NODE) {
        range.setStart(node, Math.min(offset, node.textContent?.length ?? 0));
      } else {
        range.setStart(node, Math.min(offset, node.childNodes.length));
      }
      range.collapse(true);
      return range;
    }
    // linkedom fallback: synthesize a collapsed range object
    return {
      collapsed: true,
      startContainer: node,
      endContainer: node,
      startOffset: offset,
      endOffset: offset,
      commonAncestorContainer: node,
      cloneRange() {
        return this;
      },
      collapse() {},
      insertNode(n: any) {
        if (node.nodeType === Node.TEXT_NODE) {
          node.parentNode?.insertBefore(n, node);
        } else if (node.childNodes[offset]) {
          node.insertBefore(n, node.childNodes[offset]);
        } else {
          node.appendChild(n);
        }
      },
      setStart() {},
      setEnd() {},
      compareBoundaryPoints() {
        return -1;
      },
    };
  };
}

function buildSectionWithColumns() {
  const section = document.createElement('div');
  section.className = 'document-section';
  const body = document.createElement('div');
  body.className = 'document-section__body';
  body.contentEditable = 'true';

  const label = document.createTextNode('Patient: ');
  const token = document.createElement('span');
  token.className = 'field-token field-token--design';
  token.dataset.fieldId = 'patientName';
  token.textContent = 'Jon Gibson';
  body.appendChild(label);
  body.appendChild(token);

  const columns = document.createElement('div');
  columns.className = 'document-columns';
  const col0 = document.createElement('div');
  col0.className = 'document-columns__col';
  col0.dataset.column = '0';
  col0.contentEditable = 'true';
  const col1 = document.createElement('div');
  col1.className = 'document-columns__col';
  col1.dataset.column = '1';
  col1.contentEditable = 'true';
  columns.appendChild(col0);
  columns.appendChild(col1);
  body.appendChild(columns);

  section.appendChild(body);
  document.body.appendChild(section);
  return { section, body, token, col0, col1, label };
}

describe('wireEditorJsNativeDropGuard', () => {
  it('detects prose drop targets inside section bodies', () => {
    const body = document.createElement('div');
    body.className = 'document-section__body';
    const span = document.createElement('span');
    body.appendChild(span);
    document.body.appendChild(body);

    assert.equal(isDocEngineProseDropTarget(span), true);
    assert.equal(isDocEngineProseDropTarget(document.body), false);
  });

  it('detects column cells as prose drop targets', () => {
    const col = document.createElement('div');
    col.className = 'document-columns__col';
    const text = document.createTextNode('x');
    col.appendChild(text);
    document.body.appendChild(col);
    assert.equal(isDocEngineProseDropTarget(text), true);
  });

  it('blocks native text drops in prose, not custom DocEngine drags', () => {
    const body = document.createElement('div');
    body.className = 'document-section__body';

    assert.equal(
      shouldBlockEditorJsDrop(body, { types: ['text/plain', 'text/html'] }),
      true,
    );
    assert.equal(
      shouldBlockEditorJsDrop(body, { types: ['application/x-doc-editor-dnd', 'text/plain'] }),
      false,
    );
    assert.equal(
      shouldBlockEditorJsDrop(body, { types: ['application/x-doc-editor-palette'] }),
      false,
    );
    assert.equal(
      shouldBlockEditorJsDrop(document.createElement('div'), { types: ['text/plain'] }),
      false,
    );
    assert.equal(isDocEngineCustomDrag({ types: ['text/html'] }), false);
  });

  it('wires a capture drop listener once per holder', () => {
    const holder = document.createElement('div');
    const unwire = wireEditorJsNativeDropGuard(holder);
    assert.equal(holder.dataset.editorJsDropGuardWired, 'true');
    wireEditorJsNativeDropGuard(holder);
    assert.equal(typeof unwire, 'function');
    unwire();
    assert.equal(holder.dataset.editorJsDropGuardWired, undefined);
  });

  it('treats only Ctrl/Cmd as copy — dropEffect alone is not enough for can-move', () => {
    // Regression: browsers often set dropEffect "copy" on contenteditable text
    // drags; trusting it left the source text in place (move looked like copy).
    assert.equal(
      shouldBlockEditorJsDrop(
        Object.assign(document.createElement('div'), { className: 'document-section__body' }),
        { types: ['text/plain', 'text/html'] },
      ),
      true,
    );
    assert.equal(typeof applyNativeProseTextDrop, 'function');
  });

  it('rangeContainsSelector detects field tokens in a selection', () => {
    const { section, token, label } = buildSectionWithColumns();
    const range = document.createRange();
    range.setStartBefore(label);
    range.setEndAfter(token);
    assert.equal(rangeContainsSelector(range, '.field-token'), true);
    assert.equal(rangeContainsSelector(range, '.document-columns'), false);
    section.remove();
  });

  it('moves selected text with field tokens into a column cell', () => {
    const { section, body, token, col0, label } = buildSectionWithColumns();

    // Build a Range-like source that linkedom can resolve to the section body.
    const sourceRange: any = {
      collapsed: false,
      commonAncestorContainer: body,
      startContainer: label,
      endContainer: token,
      startOffset: 0,
      endOffset: 1,
      cloneContents() {
        const frag = document.createDocumentFragment();
        frag.appendChild(label.cloneNode(true));
        frag.appendChild(token.cloneNode(true));
        return frag;
      },
      extractContents() {
        const frag = document.createDocumentFragment();
        frag.appendChild(label);
        frag.appendChild(token);
        return frag;
      },
      deleteContents() {},
      cloneRange() {
        return this;
      },
      collapse() {},
      compareBoundaryPoints() {
        return -1;
      },
    };

    mockCaretAt(col0, 0);

    const ok = applyNativeProseTextDrop(
      {
        clientX: 10,
        clientY: 10,
        ctrlKey: false,
        metaKey: false,
        dataTransfer: { getData: () => 'Patient: Jon Gibson' },
      },
      sourceRange,
    );

    assert.equal(ok, true);
    assert.equal(col0.contains(token), true, 'field token should live in the column');
    assert.match(col0.textContent ?? '', /Patient:/);
    assert.match(col0.textContent ?? '', /Jon Gibson/);
    assert.equal(
      body.querySelector(':scope > .field-token[data-field-id="patientName"]'),
      null,
      'token should leave the section body',
    );
    section.remove();
  });
});
