import type { IToolDescription, ToolName } from '@kubequest/shared';
import { SchemaHelper } from './schema.helper';
import { ToolInputError, UnknownToolError } from './tools.errors';
import type { ToolRegistry } from './tools.types';

export class ToolRunnerService {
  private readonly _registry: ToolRegistry;

  public constructor(registry: ToolRegistry) {
    this._registry = registry;
  }

  public describeAll(): IToolDescription[] {
    return (Object.keys(this._registry) as ToolName[]).map((name) => ({
      name,
      description: this._registry[name].description,
      inputSchema: { ...this._registry[name].inputSchema },
    }));
  }

  public async run(name: string, input: unknown): Promise<unknown> {
    if (!Object.hasOwn(this._registry, name)) {
      throw new UnknownToolError(name);
    }

    const definition = this._registry[name as ToolName];
    const problem = SchemaHelper.validate(definition.inputSchema, input);

    if (problem) {
      throw new ToolInputError(problem);
    }

    const handler = definition.handler as (toolInput: unknown) => Promise<unknown>;

    return handler(input);
  }
}
