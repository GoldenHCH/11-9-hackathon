import { IRecapBooth, IRecapPerson, IRecapTalk } from '../types/kubequest.interfaces';

const MAX_NEXT_STEPS = 6;
const MAX_LIKED_CHARS = 60;

function shorten(value: string, maxChars: number): string {
  const clean = value.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');

  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1).trimEnd()}…` : clean;
}

export function personNextStep(handle: string, sharedTopics: string[], githubLogin?: string, theirAnswer?: string): string {
  const topic = sharedTopics[0];

  if (topic) {
    return `Follow up with @${handle} about ${topic}.`;
  }

  if (githubLogin) {
    return `Say hi to @${handle} on GitHub (github.com/${githubLogin}).`;
  }

  if (theirAnswer) {
    return `Ask @${handle} how ${shorten(theirAnswer, 40)} is going for them.`;
  }

  return `Message @${handle} and swap what you each learned at KubeCon.`;
}

export function boothNextStep(name: string, followUp: boolean, liked: string, askAbout?: string): string {
  if (followUp) {
    return `Book a follow-up with ${name}.`;
  }

  if (liked.trim() !== '') {
    return `Try what you liked at ${name}: ${shorten(liked, MAX_LIKED_CHARS)}.`;
  }

  if (askAbout) {
    return `Read up on ${name}: ${shorten(askAbout, MAX_LIKED_CHARS)}.`;
  }

  return `Add a line about ${name} while you still remember it.`;
}

export function overallNextSteps(talks: IRecapTalk[], people: IRecapPerson[], booths: IRecapBooth[]): string[] {
  const steps: string[] = [
    ...booths.filter((booth) => booth.followUp).map((booth) => booth.nextStep),
    ...people.map((person) => person.nextStep),
    ...talks
      .filter((talk) => talk.quizTotal !== undefined && (talk.quizCorrect ?? 0) < talk.quizTotal)
      .map((talk) => `Rewatch "${talk.title}" when the recording goes up.`),
  ];

  if (people.length === 0) {
    steps.push('Next conference, shake hands with at least three new people.');
  }

  if (talks.length === 0) {
    steps.push('Pick two KubeCon recordings to watch this week.');
  }

  return [...new Set(steps)].slice(0, MAX_NEXT_STEPS);
}
