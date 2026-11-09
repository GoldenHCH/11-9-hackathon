import { generateJson } from '../ai/client';
import { gameRules, trackCatalog } from '../types/kubequest.constants';
import { Material, Track } from '../types/kubequest.types';
import { topicRules } from './profile.constants';

function hasKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return new RegExp(`(^|[^a-z0-9])${escaped}`).test(text);
}

export function topicsFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const scored = topicRules
    .map((rule) => ({ topic: rule.topic, hits: rule.keywords.filter((keyword) => hasKeyword(lower, keyword)).length }))
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  return scored.slice(0, gameRules.MAX_TOPICS).map((entry) => entry.topic);
}

function isTopicList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= gameRules.MAX_TOPICS && value.every((item) => typeof item === 'string' && item.length > 0 && item.length <= 60);
}

export async function suggestTopics(workingOn: string, languages: string[]): Promise<string[]> {
  const text = [workingOn, ...languages].join(' ');
  const fallback = topicsFromText(text);

  if (workingOn.trim() === '') {
    return fallback;
  }

  const prompt = `Pick up to ${gameRules.MAX_TOPICS} KubeCon topics for this attendee, choosing from: ${topicRules.map((rule) => rule.topic).join(', ')}. Answer with a JSON array of strings. Attendee says: ${JSON.stringify(workingOn)}`;

  try {
    const result = await generateJson('profile_topics', prompt, isTopicList, () => fallback);
    const allowed = new Set(topicRules.map((rule) => rule.topic));
    const picked = result.value.filter((topic) => allowed.has(topic));

    return picked.length > 0 ? picked : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeTopics(topics: string[]): string[] {
  const unique = Array.from(new Set(topics.map((topic) => topic.trim()).filter((topic) => topic !== '')));

  return unique.slice(0, gameRules.MAX_TOPICS);
}

export function trackForTopics(topics: string[]): Track {
  for (const topic of topics) {
    const rule = topicRules.find((candidate) => candidate.topic.toLowerCase() === topic.toLowerCase());

    if (rule) {
      return rule.track;
    }
  }

  return 'other';
}

export function starterMaterialFor(topics: string[]): Material {
  return trackCatalog[trackForTopics(topics)].material;
}
