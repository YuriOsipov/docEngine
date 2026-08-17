import {
  createFieldToken,
  readTokenValue,
  pickFillFieldFromToken,
  textToFragment,
  wireDesignFieldToken,
} from '../fields/inline-fields.js';
import { buildTableElement } from '../fields/table-field.js';
import { normalizeRepeaterValue } from '../core/repeater-io.js';
import { wireFieldTokenKeyboard } from '../fields/field-keyboard.js';
import { getRegistryFromConfig } from '../registry/registry-context.js';
import { createDefaultBlockData, createDefaultSchema, isFieldEditableInFillMode } from '../core/field-schemas.js';

export default class TemplateBlock {
  [key: string]: any;
  static get enableLineBreaks() {
    return true;
  }

  static get toolbox() {
    return {
      title: 'Field',
      icon: '<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor"/></svg>',
    };
  }

  constructor({ data, config }: any) {
    this.config = config ?? {};
    this._openSchemaOnRender = false;

    let blockData = { ...data };
    if (config.designMode && !blockData.fieldId) {
      const defaults = createDefaultBlockData(blockData.fieldType || 'choice');
      blockData = { ...defaults, ...blockData, fieldId: defaults.fieldId };
      const schema = createDefaultSchema(blockData.fieldType, blockData.label);
      getRegistryFromConfig(this.config)?.updateFieldSchema(blockData.fieldId, schema);
      this._openSchemaOnRender = true;
    }

    const registry = getRegistryFromConfig(this.config);
    const repeaterSchema = registry?.getFieldSchemas()?.[blockData.fieldId];
    let repeaterValue = blockData.value;
    if (
      blockData.fieldType === 'child' &&
      repeaterSchema?.type === 'child'
    ) {
      repeaterValue = normalizeRepeaterValue(blockData.value, repeaterSchema);
    }

    this.data = {
      fieldType: blockData.fieldType ?? 'text',
      fieldId: blockData.fieldId ?? '',
      label: blockData.label ?? '',
      prefixText: blockData.prefixText ?? '',
      value:
        blockData.fieldType === 'child'
          ? repeaterValue
          : (blockData.value ?? ''),
      cells: blockData.cells ?? {},
    };
    this.wrapper = null;
  }

  rendered() {
    if (this._openSchemaOnRender && this.data.fieldId) {
      this._openSchemaOnRender = false;
      queueMicrotask(() => this.config.onEditSchema?.(this.data.fieldId));
    }
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = `template-block template-block--${this.data.fieldType}`;

    if (this.config.designMode) {
      const schema = getRegistryFromConfig(this.config)?.getFieldSchemas()?.[this.data.fieldId];
      const displayLabel = schema?.label ?? this.data.label ?? this.data.fieldType;
      const toolbar = document.createElement('div');
      toolbar.className = 'template-block__toolbar';
      toolbar.innerHTML = `
        <span class="template-block__type">${displayLabel}</span>
        <button type="button" class="btn btn-sm" data-action="edit-schema">Schema</button>
      `;
      toolbar.querySelector('[data-action="edit-schema"]').addEventListener('click', (e: any) => {
        e.preventDefault();
        this.config.onEditSchema?.(this.data.fieldId);
      });
      this.wrapper.appendChild(toolbar);
    }

    const body = document.createElement('div');
    body.className = 'template-block__body';

    switch (this.data.fieldType) {
      case 'table':
        body.appendChild(this.renderTable());
        break;
      case 'child':
        body.appendChild(this.renderInlineField());
        break;
      case 'text':
        body.appendChild(this.renderText());
        break;
      default:
        body.appendChild(this.renderInlineField());
        break;
    }

    this.wrapper.appendChild(body);

    this._unwireKeyboard = wireFieldTokenKeyboard(body, {
      designMode: !!this.config.designMode,
      mappingMode: !!this.config.mappingMode,
      editorHolder: this.config.editorHolder,
      getRegistry: this.config.getRegistry,
      onActivateFillField: async (token: any) => {
        const fieldId = token?.dataset?.fieldId;
        if (!fieldId) return;
        const fieldSchema = getRegistryFromConfig(this.config)?.getFieldSchemas()?.[fieldId];
        await pickFillFieldFromToken(
          token,
          this.config,
          (id: any, value: any) => {
            if (id === this.data.fieldId) this.data.value = value;
            else if (this.data.cells) this.data.cells[id] = value;
            this.config.onFieldValueChange?.(id, value);
          },
          {
            schema: fieldSchema,
            placeholder: this.data.label ?? token.dataset.placeholder,
            currentValue: readTokenValue(token),
          },
        );
      },
      onDeleteField: (fieldId: any, token: any) => this.config.onDeleteField?.(fieldId, token),
    });

    return this.wrapper;
  }

  renderText() {
    const wrap = document.createElement('div');
    wrap.className = 'document-section__body template-block__text';

    if (this.data.prefixText) {
      const prefix = document.createElement('span');
      prefix.className = 'template-block__prefix';
      prefix.textContent = this.data.prefixText;
      wrap.appendChild(prefix);
    }

    const schema = getRegistryFromConfig(this.config)?.getFieldSchemas()?.[this.data.fieldId];
    const fieldLabel = schema?.label ?? this.data.label ?? 'Text';
    const value = this.data.value ?? '';

    if (this.config.designMode) {
      wrap.contentEditable = 'true';
      wrap.classList.add('cke_editable');
      wrap.spellcheck = false;
      if (value) wrap.appendChild(textToFragment(String(value)));
      wrap.addEventListener('input', () => {
        this.data.value = wrap.innerText;
      });
      return wrap;
    }

    const token = createFieldToken(this.data.fieldId, value, fieldLabel);
    token.addEventListener('click', async (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      const fieldSchema = getRegistryFromConfig(this.config)?.getFieldSchemas()?.[this.data.fieldId];
      if (!isFieldEditableInFillMode(fieldSchema)) return;
      await pickFillFieldFromToken(
        token,
        this.config,
        (_id: any, next: any) => {
          this.data.value = next;
        },
        {
          schema: fieldSchema,
          placeholder: fieldLabel,
          currentValue: readTokenValue(token),
        },
      );
    });
    wrap.appendChild(token);
    return wrap;
  }

  renderInlineField() {
    const wrap = document.createElement('div');
    wrap.className = 'template-block__inline';
    const schema = getRegistryFromConfig(this.config)?.getFieldSchemas()?.[this.data.fieldId];
    const fieldLabel = schema?.label ?? this.data.label;

    if (this.data.prefixText) {
      const prefix = document.createElement('span');
      prefix.className = 'template-block__prefix';
      prefix.textContent = this.data.prefixText;
      wrap.appendChild(prefix);
    }

    const label = document.createElement('span');
    label.className = 'template-block__field-label';
    label.textContent = `${fieldLabel}: `;
    wrap.appendChild(label);

    const token = createFieldToken(
      this.data.fieldId,
      this.data.value,
      fieldLabel
    );

    if (this.config.designMode) {
      wireDesignFieldToken(token, {
        onEditSchema: this.config.onEditSchema,
        onDeleteField: this.config.onDeleteField,
      });
    } else {
      this.attachFillTokenHandlers(token);
    }

    wrap.appendChild(token);
    return wrap;
  }

  renderTable() {
    return buildTableElement(this.data.fieldId, this.data.cells ?? {}, {
      ...this.config,
      designMode: this.config.designMode,
      onEditSchema: this.config.onEditSchema,
      onDeleteField: this.config.onDeleteField,
      onCellValueChange: (cellId: any,value: any) => {
        this.data.cells[cellId] = value;
      },
    });
  }

  attachFillTokenHandlers(token: any) {
    token.addEventListener('click', async (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      const fieldId = this.data.fieldId;
      const fieldSchema = getRegistryFromConfig(this.config)?.getFieldSchemas()?.[fieldId];
      if (!isFieldEditableInFillMode(fieldSchema)) return;
      await pickFillFieldFromToken(
        token,
        this.config,
        (_id: any, next: any) => {
          this.data.value = next;
        },
        {
          schema: fieldSchema,
          placeholder: this.data.label,
          currentValue: readTokenValue(token),
        },
      );
    });
  }

  save() {
    if (this.wrapper) {
      if (this.data.fieldType === 'text') {
        const token = this.wrapper.querySelector('.field-token');
        if (token) {
          this.data.value = readTokenValue(token);
        } else {
          const area = this.wrapper.querySelector('.document-section__body');
          if (area) this.data.value = area.innerText;
        }
      } else if (this.data.fieldType === 'table') {
        const cells: any = {};
        this.wrapper.querySelectorAll('.field-token').forEach((t: any) => {
          cells[t.dataset.fieldId] = readTokenValue(t);
        });
        this.data.cells = cells;
      } else {
        const token = this.wrapper.querySelector('.field-token');
        if (token) this.data.value = readTokenValue(token);
      }
    }

    return { ...this.data };
  }

  validate() {
    return true;
  }
}
