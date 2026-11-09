import { z } from 'zod';
import { IAiResult } from '../types/internal.interfaces';
import { IAttendee } from '../types/kubequest.interfaces';
import { generateJson, sanitizeForPrompt } from './client';
import { chatPromptTemplate } from './prompts.constants';

const chatLineSchema = z.object({ line: z.string().min(10).max(220) });

type IChatLine = z.infer<typeof chatLineSchema>;

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export function fallbackChatPrompt(b: IAttendee, sharedTopics: string[]): string {
  const topic = sharedTopics.find((value) => value.trim() !== '') ?? b.profile?.topics?.[0];

  if (topic) {
    return `Ask @${b.handle} how they handle ${sanitizeForPrompt(topic, 60)} on their team.`;
  }

  if (b.workingOn) {
    return `Ask @${b.handle} what is hardest about ${lowerFirst(sanitizeForPrompt(b.workingOn, 80)).replace(/[.!?]+$/, '')}.`;
  }

  return `Ask @${b.handle} which KubeCon talk they would not miss today.`;
}

function describe(attendee: IAttendee): string {
  return [
    `handle: @${attendee.handle}`,
    `working on: ${sanitizeForPrompt(attendee.workingOn)}`,
    `topics: ${(attendee.profile?.topics ?? []).slice(0, 8).map((topic) => sanitizeForPrompt(topic, 40)).join(', ')}`,
  ].join('\n');
}

export async function chatPrompt(a: IAttendee, b: IAttendee, sharedTopics: string[]): Promise<IAiResult<string>> {
  const handlePrefix = `ask @${b.handle.toLowerCase()}`;
  const validate = (value: unknown): value is IChatLine => {
    const parsed = chatLineSchema.safeParse(value);

    return parsed.success && parsed.data.line.toLowerCase().startsWith(handlePrefix);
  };
  const prompt = [
    chatPromptTemplate.replaceAll('{handleB}', b.handle),
    '<data>',
    'Player A',
    describe(a),
    '',
    'Player B',
    describe(b),
    '',
    `shared topics: ${sharedTopics.slice(0, 6).map((topic) => sanitizeForPrompt(topic, 40)).join(', ')}`,
    '</data>',
  ].join('\n');

  const result = await generateJson<IChatLine>('chat_prompt', prompt, validate, () => ({ line: fallbackChatPrompt(b, sharedTopics) }));

  return { ...result, value: result.value.line };
}
