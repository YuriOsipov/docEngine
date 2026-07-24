import { buildFormulaFieldTree, formatFormulaReference } from '../core/formula-field-index.js';

const AGGREGATE_FUNCTIONS = ['sum', 'avg', 'min', 'max', 'count'];

function insertIntoTextarea(textarea: any, text: any, selectionStart?: any, selectionEnd?: any) {
  if (!textarea) return;
  const value = textarea.value ?? '';
  const start = selectionStart ?? textarea.selectionStart ?? value.length;
  const end = selectionEnd ?? textarea.selectionEnd ?? value.length;
  textarea.value = `${value.slice(0, start)}${text}${value.slice(end)}`;
  const cursor = start + text.length;
  textarea.selectionStart = cursor;
  textarea.selectionEnd = cursor;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function replaceTextareaSelection(textarea: any,text: any,cursorStart: any,cursorEnd: any) {
  if (!textarea) return;
  const value = textarea.value ?? '';
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  textarea.value = `${value.slice(0, start)}${text}${value.slice(end)}`;
  textarea.selectionStart = cursorStart;
  textarea.selectionEnd = cursorEnd ?? cursorStart;
  textarea.focus();
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function wrapSelectionWithFunction(textarea: any,fnName: any) {
  if (!textarea) return;
  const value = textarea.value ?? '';
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const selected = value.slice(start, end);

  if (selected.trim()) {
    const wrapped = `${fnName}(${selected})`;
    replaceTextareaSelection(textarea, wrapped, start, start + wrapped.length);
    return;
  }

  const snippet = `${fnName}()`;
  insertIntoTextarea(textarea, snippet);
  const cursor = (textarea.selectionStart ?? 0) - 1;
  textarea.selectionStart = cursor;
  textarea.selectionEnd = cursor;
}

function nodeMatchesQuery(node: any,query: any) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (node.label.toLowerCase().includes(q)) return true;
  if (node.path?.toLowerCase().includes(q)) return true;
  return (node.children ?? []).some((child: any) => nodeMatchesQuery(child, query));
}

/**
 * Keep the formula textarea focused (and its selection) when activating picker
 * controls. Otherwise focusout auto-persist reloads the properties panel and
 * wipes the insert before/while click runs — especially under Salesforce LWC.
 */
function onPickerActivate(el: any, handler: any) {
  el.addEventListener('mousedown', (e: any) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    handler(e);
  });
  el.addEventListener('keydown', (e: any) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    handler(e);
  });
}

function renderTreeNodes(nodes: any,query: any,onSelect: any) {
  const fragment = document.createDocumentFragment();

  for (const node of nodes ?? []) {
    if (!nodeMatchesQuery(node, query)) continue;

    const item = document.createElement('div');
    item.className = `formula-field-picker__node formula-field-picker__node--${node.kind}`;

    if (node.children?.length) {
      const details = document.createElement('details');
      details.open = Boolean(query.trim());
      const summary = document.createElement('summary');
      summary.className = 'formula-field-picker__summary';
      summary.textContent = node.label;
      details.appendChild(summary);

      const children = document.createElement('div');
      children.className = 'formula-field-picker__children';
      children.append(...renderTreeNodes(node.children, query, onSelect).childNodes);
      details.appendChild(children);
      item.appendChild(details);
    } else if (node.path) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'formula-field-picker__leaf';
      button.textContent = node.label;
      button.title = node.path;
      onPickerActivate(button, () => onSelect(node));
      item.appendChild(button);
    }

    fragment.appendChild(item);
  }

  return fragment;
}

/**
 * @param {{
 *   blocks?: import('../types.d.ts').EditorBlock[],
 *   fieldSchemas?: Record<string, import('../types.d.ts').FieldSchema>,
 *   excludeFieldId?: string | null,
 *   getFormulaTextarea?: () => HTMLTextAreaElement | null,
 * }} options
 */
export function renderFormulaFieldPicker(container: any,options: any = {}) {
  if (!container) return;

  const {
    blocks = [],
    fieldSchemas = {},
    excludeFieldId = null,
    getFormulaTextarea = () => null,
  } = options;

  container.innerHTML = '';
  container.className = 'formula-field-picker';

  const fnRow = document.createElement('div');
  fnRow.className = 'formula-field-picker__functions';
  const fnLabel = document.createElement('span');
  fnLabel.className = 'formula-field-picker__functions-label';
  fnLabel.textContent = 'Wrap selection:';
  fnRow.appendChild(fnLabel);

  for (const fn of AGGREGATE_FUNCTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm formula-field-picker__fn';
    btn.textContent = fn;
    btn.title = `Wrap selected formula part with ${fn}()`;
    onPickerActivate(btn, () => {
      wrapSelectionWithFunction(getFormulaTextarea(), fn);
    });
    fnRow.appendChild(btn);
  }
  container.appendChild(fnRow);

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'formula-field-picker__search';
  search.placeholder = 'Search fields…';
  container.appendChild(search);

  const treeHost = document.createElement('div');
  treeHost.className = 'formula-field-picker__tree';
  container.appendChild(treeHost);

  function insertFieldReference(node: any) {
    const textarea = getFormulaTextarea();
    if (!textarea || !node?.path) return;
    insertIntoTextarea(textarea, `{${node.path}}`);
  }

  function paintTree() {
    const tree = buildFormulaFieldTree(blocks, fieldSchemas, { excludeFieldId });
    treeHost.innerHTML = '';
    if (!tree.length) {
      treeHost.innerHTML = '<p class="schema-form__hint">No fields available yet.</p>';
      return;
    }
    treeHost.appendChild(renderTreeNodes(tree, search.value, insertFieldReference));
  }

  search.addEventListener('input', paintTree);
  paintTree();
}

export { formatFormulaReference, insertIntoTextarea, wrapSelectionWithFunction };
