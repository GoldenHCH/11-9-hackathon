import { normalizeIntent } from '../app/src/profile/intent';
import { topicRules } from '../app/src/profile/profile.constants';
import type { AttendeeGoal, SocialLevel } from '../app/src/types/intent.interfaces';
import type { IAttendee } from '../app/src/types/kubequest.interfaces';
import { createPrng, hashString } from './lib/prng.helper';
import { readJsonFile, resourcePath, writeJsonFile } from './lib/resource-files.helper';

const seedKey = 'kubequest-intent-v1';
const goals: AttendeeGoal[] = ['exploring', 'deep_dive', 'hiring', 'job_seeking', 'booth', 'community', 'talks', 'sent'];
const firstTimerWeights = [34, 14, 3, 12, 4, 8, 15, 10];
const returningWeights = [12, 26, 10, 6, 10, 18, 12, 6];
const socialLevels: SocialLevel[] = ['light', 'some', 'lots'];

function intentFor(attendee: IAttendee): NonNullable<IAttendee['intent']> {
  const prng = createPrng(hashString(`${seedKey}:${attendee.id}`));
  const weights = attendee.profile.firstTimer ? firstTimerWeights : returningWeights;
  const first = prng.weightedPick(goals, weights);
  const second = prng.chance(0.3) ? prng.weightedPick(goals, weights) : first;
  const picked = Array.from(new Set(attendee.profile.welcomer && prng.chance(0.5) ? [first, second, 'community' as const] : [first, second]));
  const exploringField = picked.includes('exploring') ? prng.pick(topicRules.map((rule) => rule.topic)) : undefined;
  const socialLevel = prng.chance(0.2) ? prng.pick(socialLevels) : undefined;

  return normalizeIntent({ goals: picked, exploringField, socialLevel });
}

function main(): void {
  const attendees = readJsonFile<IAttendee[]>(resourcePath('attendees.seed.json'));
  const withIntent = attendees.map((attendee) => ({ ...attendee, intent: intentFor(attendee) }));
  writeJsonFile(resourcePath('attendees.seed.json'), withIntent);

  const counts = new Map<string, number>();

  for (const attendee of withIntent) {
    for (const key of [...attendee.intent.goals, `social:${attendee.intent.socialLevel}`]) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  console.log(`intents for ${withIntent.length} attendees: ${[...counts.entries()].map(([key, count]) => `${key}=${count}`).join(' ')}`);
}

main();
