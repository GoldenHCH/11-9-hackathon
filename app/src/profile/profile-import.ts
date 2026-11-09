import { z } from 'zod';
import { generateJson } from '../ai/client';
import { profileImportTemplate } from '../ai/prompts.constants';
import { ToolError } from '../tools/tool-errors';
import { gameRules } from '../types/kubequest.constants';
import { IImportedProfile, IImportProfileInput } from '../types/kubequest.interfaces';
import { getAttendee } from './attendees';
import { importLimits, topicRules } from './profile.constants';
import { topicsFromText } from './topics';

const importCalls = new Map<string, number[]>();

const genericKeywords: ReadonlySet<string> = new Set(importLimits.GENERIC_KEYWORDS);

const shortList = (max: number, maxChars: number) => z.array(z.string().trim().min(1).max(maxChars)).max(max);

const modelProfileSchema = z.object({
  headline: z.string().trim().max(120),
  role: z.string().trim().max(80),
  seniority: z.string().trim().max(30),
  skills: shortList(20, 60),
  topics: z.array(z.string().trim()).max(10),
  workingOn: z.string().trim().max(300),
  offers: shortList(8, 140),
  asks: shortList(8, 140),
  summary: z.string().trim().min(20).max(1200),
});

type ModelProfile = z.infer<typeof modelProfileSchema>;

function isModelProfile(value: unknown): value is ModelProfile {
  return modelProfileSchema.safeParse(value).success;
}

export function scrubPersonalData(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' ')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|io|dev|org|net|me|ai|co|app|in)(?:\/\S*)?/gi, ' ')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, (match) => (match.replace(/\D/g, '').length >= 9 ? ' ' : match))
    .replace(/[<>]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
    .slice(0, importLimits.MAX_TEXT_CHARS);
}

function enforceRateLimit(attendeeId: string): void {
  const now = Date.now();
  const recent = (importCalls.get(attendeeId) ?? []).filter((at) => now - at < importLimits.WINDOW_MS);

  if (recent.length >= importLimits.MAX_CALLS_PER_WINDOW) {
    importCalls.set(attendeeId, recent);
    throw new ToolError(429, 'rate_limited', 'You have imported a profile a few times already. Try again in an hour, or fill it in by hand.');
  }

  recent.push(now);
  importCalls.set(attendeeId, recent);
}

function refundCall(attendeeId: string): void {
  importCalls.set(attendeeId, (importCalls.get(attendeeId) ?? []).slice(0, -1));
}

function firstSentences(text: string, count: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const sentences = flat.match(/[^.!?]+[.!?]+/g) ?? [flat];

  return sentences.slice(0, count).join(' ').trim().slice(0, importLimits.SUMMARY_MAX_CHARS);
}

function skillsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const found = topicRules.flatMap((rule) => rule.keywords.filter((keyword) => !genericKeywords.has(keyword) && new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}([^a-z0-9]|$)`).test(lower)));

  return Array.from(new Set(found)).slice(0, importLimits.MAX_SKILLS);
}

function fallbackProfile(text: string): ModelProfile {
  return {
    headline: '',
    role: '',
    seniority: '',
    skills: skillsFromText(text),
    topics: topicsFromText(text),
    workingOn: firstSentences(text, 1).slice(0, importLimits.WORKING_ON_MAX_CHARS),
    offers: [],
    asks: [],
    summary: firstSentences(text, 2),
  };
}

function cleanList(values: string[], max: number, maxChars: number): string[] {
  const seen = new Set<string>();

  return values
    .map((value) => scrubPersonalData(value).replace(/\s+/g, ' ').slice(0, maxChars))
    .filter((value) => {
      const key = value.toLowerCase();

      if (value === '' || seen.has(key)) {
        return false;
      }

      seen.add(key);

      return true;
    })
    .slice(0, max);
}

function allowedTopics(topics: string[], text: string): string[] {
  const byLower = new Map(topicRules.map((rule) => [rule.topic.toLowerCase(), rule.topic]));
  const picked = Array.from(new Set(topics.flatMap((topic) => byLower.get(topic.toLowerCase()) ?? [])));

  return (picked.length > 0 ? picked : topicsFromText(text)).slice(0, gameRules.MAX_TOPICS);
}

function single(value: string, maxChars: number): string {
  return scrubPersonalData(value).replace(/\s+/g, ' ').slice(0, maxChars);
}

export async function importProfile(input: IImportProfileInput): Promise<IImportedProfile> {
  const cleaned = scrubPersonalData(input.text ?? '');

  if (cleaned.length < importLimits.MIN_TEXT_CHARS) {
    throw new ToolError(400, 'not_enough_text', 'We could not read enough text from that. Paste a few lines about your work, or skip this step.');
  }

  await getAttendee(input.attendeeId);
  enforceRateLimit(input.attendeeId);

  const prompt = `${profileImportTemplate.replace('{topics}', topicRules.map((rule) => rule.topic).join(', '))}\n\n<data>\n${cleaned}\n</data>`;
  const result = await generateJson('profile_import', prompt, isModelProfile, () => fallbackProfile(cleaned));
  const value = result.value;

  if (result.cacheHit) {
    refundCall(input.attendeeId);
  }

  return {
    headline: single(value.headline, importLimits.HEADLINE_MAX_CHARS),
    role: single(value.role, 80),
    seniority: single(value.seniority, 30).toLowerCase(),
    skills: cleanList(value.skills, importLimits.MAX_SKILLS, 40),
    topics: allowedTopics(value.topics, cleaned),
    workingOn: single(value.workingOn, importLimits.WORKING_ON_MAX_CHARS),
    offers: cleanList(value.offers, importLimits.MAX_LIST, 120),
    asks: cleanList(value.asks, importLimits.MAX_LIST, 120),
    summary: single(value.summary, importLimits.SUMMARY_MAX_CHARS),
    provider: result.provider,
  };
}
