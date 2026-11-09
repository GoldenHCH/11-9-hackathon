import type { IToolSignatures, ToolName } from '@kubequest/shared';
import type { EsClientService } from '../es/es-client.service';
import type { ResourceStoreService } from '../resources/resource-store.service';
import type { JsonSchemaType } from './tools.types';

export interface IJsonSchemaProperty {
  type: JsonSchemaType;
  description: string;
  enum?: string[];
  items?: { type: JsonSchemaType };
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export interface IJsonSchema {
  type: 'object';
  properties: Record<string, IJsonSchemaProperty>;
  required: string[];
}

export interface IToolMetadata {
  description: string;
  inputSchema: IJsonSchema;
}

export interface IToolDefinition<Name extends ToolName = ToolName> {
  name: Name;
  description: string;
  inputSchema: IJsonSchema;
  handler: (input: IToolSignatures[Name]['input']) => Promise<IToolSignatures[Name]['output']>;
}

export interface IToolDependencies {
  store: ResourceStoreService;
  esClient: EsClientService;
}
