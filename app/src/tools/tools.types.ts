import type { ToolName } from '@kubequest/shared';
import type { IToolDefinition } from './tools.interfaces';

export type JsonSchemaType = 'string' | 'integer' | 'boolean' | 'array';

export type ToolRegistry = { [Name in ToolName]: IToolDefinition<Name> };
