/** Ambient stubs for n8n peer types (optional at install time). */
declare module 'n8n-workflow' {
  export interface INodeExecutionData {
    json: Record<string, unknown>;
    binary?: Record<string, unknown>;
  }

  export interface IExecuteFunctions {
    getInputData(): INodeExecutionData[];
    getNodeParameter(name: string, itemIndex?: number, fallbackValue?: unknown): any;
    continueOnFail(): boolean;
    helpers: {
      prepareBinaryData(
        data: Buffer,
        fileName?: string,
        mimeType?: string,
      ): Promise<unknown>;
    };
  }

  export interface INodeTypeDescription {
    [key: string]: unknown;
  }

  export interface INodeType {
    description: INodeTypeDescription;
    execute?(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
  }
}
