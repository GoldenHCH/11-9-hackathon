import { Attributes } from '@opentelemetry/api';
import { z } from 'zod';
import { withToolSpan } from '../observability/tracing';
import { IToolInfo } from '../types/kubequest.interfaces';
import { ToolInput, ToolName, ToolOutput } from '../types/kubequest.types';
import { ToolError } from './tool-errors';

export interface IToolDefinition<TName extends ToolName> {
  name: TName;
  description: string;
  input: z.ZodType<ToolInput<TName>>;
  xpAwarded?: (output: ToolOutput<TName>) => number;
  run: (input: ToolInput<TName>) => Promise<ToolOutput<TName>>;
}

export interface IRegisteredTool<TName extends ToolName = ToolName> {
  name: TName;
  description: string;
  awardsXp: boolean;
  run: (input: ToolInput<TName>) => Promise<ToolOutput<TName>>;
  execute: (rawInput: unknown) => Promise<ToolOutput<TName>>;
  info: () => IToolInfo;
}

const spanAttributeKeys = {
  attendeeId: 'kubequest.attendee.id',
  locationId: 'kubequest.location.id',
  talkId: 'kubequest.talk.id',
  meetId: 'kubequest.intro.id',
  questId: 'kubequest.quest.id',
  partnerId: 'kubequest.partner.id',
  outpostId: 'kubequest.outpost.id',
  handshakeId: 'kubequest.handshake.id',
} as const;

function inputAttributes(input: unknown): Attributes {
  const attributes: Attributes = {};

  if (typeof input !== 'object' || input === null) {
    return attributes;
  }

  for (const [inputKey, attributeKey] of Object.entries(spanAttributeKeys)) {
    const value: unknown = Reflect.get(input, inputKey);

    if (typeof value === 'string' && value !== '') {
      attributes[attributeKey] = value;
    }
  }

  return attributes;
}

function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`).join('; ');
}

export function defineTool<TName extends ToolName>(definition: IToolDefinition<TName>): IRegisteredTool<TName> {
  const awardsXp = definition.xpAwarded !== undefined;

  async function execute(rawInput: unknown): Promise<ToolOutput<TName>> {
    return withToolSpan(definition.name, { 'kubequest.tool.awards_xp': awardsXp }, async (span) => {
      const parsed = definition.input.safeParse(rawInput ?? {});

      if (!parsed.success) {
        throw new ToolError(400, 'invalid_input', `That request is missing something: ${describeIssues(parsed.error)}`);
      }

      span.setAttributes(inputAttributes(parsed.data));

      if (awardsXp) {
        span.setAttribute('kubequest.xp.awarded', 0);
      }

      const output = await definition.run(parsed.data);

      if (definition.xpAwarded) {
        span.setAttribute('kubequest.xp.awarded', definition.xpAwarded(output));
      }

      return output;
    });
  }

  function info(): IToolInfo {
    let inputSchema: unknown;

    try {
      inputSchema = z.toJSONSchema(definition.input, { unrepresentable: 'any' });
    } catch {
      inputSchema = {};
    }

    return { name: definition.name, description: definition.description, awardsXp, inputSchema };
  }

  return { name: definition.name, description: definition.description, awardsXp, run: definition.run, execute, info };
}
