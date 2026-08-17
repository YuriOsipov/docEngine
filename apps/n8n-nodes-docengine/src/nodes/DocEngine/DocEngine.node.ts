// @ts-nocheck — n8n INodeType description shape is loosely typed via peer stubs.
import {
  assertTemplate,
  buildFullDocumentExport,
  parseJsonText,
  renderDocument,
  resolveInputValues,
  resolveTemplateFromItem,
} from './docengine-utils.js';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

function loadTemplate(ctx: IExecuteFunctions, item: INodeExecutionData, itemIndex = 0) {
  const templateSource = ctx.getNodeParameter('templateSource', itemIndex, 'parameter');

  if (templateSource === 'incoming') {
    const templateJsonPath = ctx.getNodeParameter('templateJsonPath', itemIndex, '');
    return resolveTemplateFromItem(item?.json ?? {}, templateJsonPath);
  }

  const templateJson = ctx.getNodeParameter('templateJson', itemIndex, {});
  if (typeof templateJson === 'string') {
    return assertTemplate(parseJsonText(templateJson));
  }
  return assertTemplate(templateJson);
}

/**
 * @param {import('n8n-workflow').IExecuteFunctions} ctx
 * @param {import('n8n-workflow').INodeExecutionData} item
 * @param {number} itemIndex
 */
function extractInputValues(ctx, item, itemIndex) {
  const valuesJsonPath = ctx.getNodeParameter('valuesJsonPath', itemIndex, '');
  return resolveInputValues(valuesJsonPath, item.json ?? {});
}

export class DocEngine {
  constructor() {
    this.description = {
      displayName: 'DocEngine',
      name: 'docEngine',
      icon: 'file:docengine.svg',
      group: ['transform'],
      version: 5,
      subtitle: '={{$parameter["outputFormat"].toUpperCase()}} + JSON',
      description: 'Bind JSON values to an editor template; always returns full document JSON plus HTML or PDF binary',
      defaults: {
        name: 'DocEngine',
      },
      inputs: ['main'],
      outputs: ['main'],
      properties: [
        {
          displayName: 'Template Source',
          name: 'templateSource',
          type: 'options',
          noDataExpression: true,
          options: [
            { name: 'Stored in Node', value: 'parameter' },
            { name: 'From incoming', value: 'incoming' },
          ],
          default: 'parameter',
        },
        {
          displayName: 'Template JSON',
          name: 'templateJson',
          type: 'json',
          typeOptions: {
            alwaysOpenEditWindow: true,
          },
          default: {},
          description:
            'Paste or import a template export (kind: "template") from the document editor.',
          displayOptions: {
            show: {
              templateSource: ['parameter'],
            },
          },
        },
        {
          displayName: 'Template JSON Path',
          name: 'templateJsonPath',
          type: 'string',
          default: '',
          placeholder: 'template',
          description:
            'Dot-path into the incoming JSON item for the template object (kind: "template"). Leave empty to use the whole item JSON.',
          displayOptions: {
            show: {
              templateSource: ['incoming'],
            },
          },
        },
        {
          displayName: 'Values JSON / Path',
          name: 'valuesJsonPath',
          type: 'string',
          typeOptions: {
            rows: 5,
          },
          default: '',
          placeholder: 'sections',
          description:
            'Field values to bind onto the template. A JSON object (n8n expressions / JS allowed), a dot-path into the incoming item (e.g. sections), or empty to use the whole item. When Template Source is Stored in Node, pass values only — not a previous PDF/document payload.',
        },
        {
          displayName: 'Use Template Field Mapping',
          name: 'useTemplateFieldMapping',
          type: 'boolean',
          default: false,
          description:
            'When enabled, apply the fieldMapping expression stored on the template against the incoming payload before binding values.',
        },
        {
          displayName: 'Source Payload Path',
          name: 'payloadJsonPath',
          type: 'string',
          default: '',
          placeholder: '',
          description:
            'When using template field mapping, dot-path to the source payload inside the values JSON. Leave empty to use the whole values object.',
          displayOptions: {
            show: {
              useTemplateFieldMapping: [true],
            },
          },
        },
        {
          displayName: 'Hide rows with empty values',
          name: 'hideEmptyValues',
          type: 'boolean',
          default: false,
          description: 'Whether to omit empty fields and rows from the generated document',
        },
        {
          displayName: 'Output format',
          name: 'outputFormat',
          type: 'options',
          noDataExpression: true,
          options: [
            { name: 'HTML', value: 'html' },
            { name: 'PDF', value: 'pdf' },
          ],
          default: 'html',
          description: 'Format of the generated binary file. Full document JSON is always included in the output.',
        },
        {
          displayName: 'Output File Name',
          name: 'fileName',
          type: 'string',
          default: '={{ $parameter.outputFormat === "pdf" ? "document.pdf" : "document.html" }}',
        },
        {
          displayName: 'Binary Property Name',
          name: 'binaryPropertyName',
          type: 'string',
          default: 'data',
          description: 'Name of the binary property on the output item',
        },

      ],
    };
  }

  /**
   * @param {import('n8n-workflow').IExecuteFunctions} this
   */
  async execute() {
    const items = this.getInputData();
    const returnData = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      try {
        const item = items[itemIndex];
        const template = loadTemplate(this, item, itemIndex);
        const values = extractInputValues(this, item, itemIndex);
        const hideEmptyValues = this.getNodeParameter('hideEmptyValues', itemIndex) === true;
        const useTemplateFieldMapping = this.getNodeParameter('useTemplateFieldMapping', itemIndex) === true;
        const payloadJsonPath = this.getNodeParameter('payloadJsonPath', itemIndex, '');
        const outputFormat = this.getNodeParameter('outputFormat', itemIndex, 'html');
        const binaryPropertyName = this.getNodeParameter('binaryPropertyName', itemIndex, 'data');
        const fileName = this.getNodeParameter('fileName', itemIndex, 'document.html');

        const mappingOptions = {
          hideEmptyValues,
          applyFieldMappingFromTemplate: useTemplateFieldMapping,
          payloadJsonPath,
        };

        const fullDocument = buildFullDocumentExport(template, values, mappingOptions);
        const rendered = await renderDocument(template, values, {
          ...mappingOptions,
          outputFormat,
        });

        returnData.push({
          json: {
            ...fullDocument,
            fileName,
            mimeType: rendered.mimeType,
            outputFormat,
          },
          binary: {
            [binaryPropertyName]: await this.helpers.prepareBinaryData(
              rendered.data,
              fileName,
              rendered.mimeType,
            ),
          },
        });
      } catch (error) {
        if (this.continueOnFail()) {
          const message = error instanceof Error ? error.message : String(error);
          returnData.push({ json: { error: message } });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
