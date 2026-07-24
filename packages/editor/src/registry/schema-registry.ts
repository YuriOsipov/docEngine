import { createCatalogProvider } from '../catalog/catalog-provider.js';
import { getFieldHandler } from '../fields/handlers/registry.js';

function withCommonFields(schema: any,config: any) {
  return {
    ...config,
    required: !!schema.required,
    readonly: !!schema.readonly,
    allowManualEdit: !!schema.allowManualEdit,
  };
}

/** Picker/display config from a stored schema (no catalog resolution). Used in preview. */
export function schemaToDisplayConfig(schema: any) {
  if (!schema) return null;

  const handler = getFieldHandler(schema.type);
  if (handler) {
    return withCommonFields(schema, handler.toDisplayConfig(schema));
  }

  return withCommonFields(schema, { picker: 'text', label: schema.label ?? '' });
}

export class SchemaRegistry {
  [key: string]: any;
  /**
   * @param {ReturnType<typeof createCatalogProvider>} [catalogProvider]
   */
  constructor(catalogProvider?: any) {
    this.schemas = {};
    this.blocks = [];
    this.catalogs = catalogProvider ?? createCatalogProvider();
  }

  setBlocks(next: any) {
    this.blocks = Array.isArray(next) ? [...next] : [];
  }

  getBlocks() {
    return this.blocks;
  }

  setFieldSchemas(next: any) {
    this.schemas = next ? { ...next } : {};
  }

  getFieldSchemas() {
    return this.schemas;
  }

  updateFieldSchema(fieldId: any,schema: any) {
    this.schemas[fieldId] = { ...schema };
  }

  removeFieldSchema(fieldId: any) {
    delete this.schemas[fieldId];
  }

  schemaToPickerConfig(schema: any) {
    if (!schema) return null;
    const { catalogs } = this;

    const handler = getFieldHandler(schema.type);
    if (handler) {
      return withCommonFields(schema, handler.toPickerConfig(schema, catalogs));
    }

    return withCommonFields(schema, {
      picker: 'list',
      label: schema.label ?? '',
      items: catalogs.resolveSchemaItems(schema),
      multi: false,
    });
  }

  getFieldDef(fieldId: any) {
    return this.schemaToPickerConfig(this.schemas[fieldId]);
  }
}
