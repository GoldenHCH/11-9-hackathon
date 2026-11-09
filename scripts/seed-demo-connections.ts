import { recordConnectionFromMeet } from '../app/src/connections/connections';
import { connectionToolRegistry } from '../app/src/connections/connection-tools';
import { closeEsClient, esOptions, getEsClient } from '../app/src/es/client';
import { esTimeouts, indexNames } from '../app/src/es/es.constants';
import { ensureIndices } from '../app/src/es/indices';
import { createIntro, getAttendee, getIntro, isConflict, meetIdFor, pairKeyFor } from '../app/src/meet/meet.store';
import { sharedTopicsFor } from '../app/src/meet/meets';
import { matchSignalFor } from '../app/src/meet/signal';
import { publicIdFor } from '../app/src/profile/public-id';
import { signInTool } from '../app/src/tools/sign-in.tool';
import { IProfileLinks } from '../app/src/types/connections.interfaces';
import { xpRewards } from '../app/src/types/kubequest.constants';
import { IIntro, ITalk } from '../app/src/types/kubequest.interfaces';
import { awardXpOnce } from '../app/src/xp/award';

const demoAccount = { name: 'John Doe', email: 'johndoe@gmail.com' } as const;

interface IDemoPartner {
  attendeeId: string;
  campfireId: string;
  minutesAgo: number;
  chatPrompt: string;
  icebreaker: string;
  links: IProfileLinks;
  talkedAbout: string;
  nextSteps: string;
  followUpInDays: number;
}

interface IDemoTalkNote {
  talkId: string;
  quizCorrect: number;
  note: string;
  takeaways: string[];
}

const demoLinks: IProfileLinks = {
  linkedin: 'linkedin.com/in/john-doe-platform',
  github: 'argoproj',
  bluesky: 'bsky.app/profile/bsky.app',
  website: 'https://kubequest.cnh.radarhq.io',
};

const demoPartners: IDemoPartner[] = [
  {
    attendeeId: 'att-helmsmith',
    campfireId: 'campfire-community-hub',
    minutesAgo: 95,
    chatPrompt: 'Ask @helmsmith how they keep a hundred Helm charts in sync with Argo CD.',
    icebreaker: 'You both run GitOps with Argo CD. Ask what broke on the last chart bump.',
    links: { linkedin: 'https://www.linkedin.com/in/helmsmith-charts/', github: 'helm', website: 'https://helm.sh' },
    talkedAbout:
      'ApplicationSets for 40 clusters, and why they moved chart values into a single Kustomize overlay per environment. Their golden path renders charts in CI and diffs the manifests before Argo CD syncs.',
    nextSteps: 'Send them our ApplicationSet generator for preview environments. They offered to review our chart linting job.',
    followUpInDays: 7,
  },
  {
    attendeeId: 'att-otelotter',
    campfireId: 'campfire-learning-lounge',
    minutesAgo: 40,
    chatPrompt: 'Ask @otelotter which OpenTelemetry Collector processors they would never run without.',
    icebreaker: 'You both care about observability. Ask how they sample traces at scale.',
    links: { github: 'open-telemetry', mastodon: '@otelotter@hachyderm.io', x: '@opentelemetry', website: 'https://opentelemetry.io' },
    talkedAbout:
      'Tail sampling in the Collector, and tracing Argo CD syncs end to end so a slow rollout shows up as one trace. They export Argo CD and Rollouts events as span events.',
    nextSteps: 'Try the k8sattributes processor on our platform clusters, then share a Dash0 trace link with them.',
    followUpInDays: 3,
  },
];

const demoTalkNotes: IDemoTalkNote[] = [
  {
    talkId: 'kc26-tue-already-have-a-platform',
    quizCorrect: 3,
    note: 'Most teams already run a platform: CI templates, a Helm library chart, a wiki page. Name it, give it an owner and a product backlog before buying a portal.',
    takeaways: ['Inventory the paved roads you already have', 'Treat the platform as a product with users', 'Measure lead time for a new service, not portal clicks'],
  },
  {
    talkId: 'kc26-tue-tracing-at-scale',
    quizCorrect: 2,
    note: 'Nubank runs 16B spans an hour through a Collector fleet. Load-balancing exporter by trace id, then tail sampling on errors and slow spans.',
    takeaways: ['Shard the Collector by trace id before tail sampling', 'Keep 100% of error traces, sample the rest', 'Budget memory per Collector pod and alert on refused spans'],
  },
];

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

async function ensureMetMeet(johnId: string, partner: IDemoPartner): Promise<IIntro> {
  const [john, other] = await Promise.all([getAttendee(johnId), getAttendee(partner.attendeeId)]);
  const now = Date.now();
  const metAt = new Date(now - partner.minutesAgo * MINUTE_MS);
  const pairKey = pairKeyFor(john.id, other.id, metAt);
  const id = meetIdFor(pairKey);
  const existing = await getIntro(id);

  if (existing?.intro.status === 'met') {
    return existing.intro;
  }

  const intro: IIntro = {
    id,
    fromId: john.id,
    toId: other.id,
    pairKey,
    status: 'met',
    proposedAt: new Date(metAt.getTime() - 60 * MINUTE_MS).toISOString(),
    respondedAt: new Date(metAt.getTime() - 45 * MINUTE_MS).toISOString(),
    acceptedBy: [john.id, other.id],
    campfireId: partner.campfireId,
    slot: { start: new Date(metAt.getTime() - 10 * MINUTE_MS).toISOString(), end: new Date(metAt.getTime() + 20 * MINUTE_MS).toISOString() },
    icebreaker: partner.icebreaker,
    chatPrompt: partner.chatPrompt,
    matchSignal: matchSignalFor(id),
    arrivals: [
      { attendeeId: john.id, at: new Date(metAt.getTime() - 2 * MINUTE_MS).toISOString() },
      { attendeeId: other.id, at: metAt.toISOString() },
    ],
    sharedTopics: sharedTopicsFor(john, other),
    firstTimerPair: false,
    metAt: metAt.toISOString(),
    expiresAt: new Date(metAt.getTime() + 60 * MINUTE_MS).toISOString(),
  };

  try {
    await createIntro(intro);
  } catch (error) {
    if (!isConflict(error)) {
      throw error;
    }

    await getEsClient().index({ index: indexNames.INTROS, id, document: intro, refresh: true }, esOptions(esTimeouts.WRITE_MS));
  }

  return intro;
}

async function talkFor(talkId: string): Promise<ITalk> {
  const response = await getEsClient().get<ITalk>({ index: indexNames.TALKS, id: talkId, _source_excludes: ['transcript', 'searchText', 'quiz'] }, esOptions(esTimeouts.DEFAULT_MS));

  if (!response._source) {
    throw new Error(`Talk ${talkId} is not indexed`);
  }

  return { ...response._source, id: talkId };
}

async function seedTalk(johnId: string, demo: IDemoTalkNote): Promise<string> {
  const talk = await talkFor(demo.talkId);
  await awardXpOnce(
    { attendeeId: johnId, type: 'check_in', xp: xpRewards.CHECK_IN, talkId: talk.id, locationId: talk.locationId, ...(talk.material ? { material: talk.material } : {}) },
    `demo-connections-check-in-${johnId}-${talk.id}`,
  );
  await awardXpOnce(
    { attendeeId: johnId, type: 'quiz', xp: demo.quizCorrect * xpRewards.QUIZ_CORRECT_ANSWER, talkId: talk.id, correct: demo.quizCorrect },
    `demo-connections-quiz-${johnId}-${talk.id}`,
  );
  const saved = await connectionToolRegistry.save_talk_note.execute({ attendeeId: johnId, talkId: talk.id, note: demo.note, takeaways: demo.takeaways });

  return saved.talkTitle;
}

async function main(): Promise<void> {
  const synced = await ensureIndices();
  const failed = synced.filter((result) => result.action === 'failed');

  if (failed.length > 0) {
    throw new Error(`Index sync failed: ${failed.map((result) => `${result.index} (${result.error ?? 'unknown'})`).join(', ')}`);
  }

  const signedIn = await signInTool.execute(demoAccount);
  const johnId = signedIn.attendee.attendee.id;
  const johnLinks = await connectionToolRegistry.update_links.execute({ attendeeId: johnId, links: demoLinks });
  const connections: string[] = [];

  for (const partner of demoPartners) {
    await connectionToolRegistry.update_links.execute({ attendeeId: partner.attendeeId, links: partner.links });
    const intro = await ensureMetMeet(johnId, partner);
    const connection = await recordConnectionFromMeet(intro);
    await connectionToolRegistry.save_connection_note.execute({
      attendeeId: johnId,
      connectionId: connection.id,
      talkedAbout: partner.talkedAbout,
      nextSteps: partner.nextSteps,
      followUpBy: new Date(Date.now() + partner.followUpInDays * DAY_MS).toISOString(),
    });
    connections.push(`${connection.id} with ${publicIdFor(partner.attendeeId)}`);
  }

  const talks: string[] = [];

  for (const demo of demoTalkNotes) {
    talks.push(await seedTalk(johnId, demo));
  }

  const listed = await connectionToolRegistry.list_connections.execute({ attendeeId: johnId });

  process.stdout.write(
    `${JSON.stringify(
      {
        johnPublicId: publicIdFor(johnId),
        johnLinks: johnLinks.items.map((item) => item.url),
        enrichment: johnLinks.enrichment.map((result) => `${result.network}: ${result.status}`),
        connections,
        listedConnections: listed.map((connection) => `@${connection.player.handle} at ${connection.where?.name ?? '?'} (${connection.links.length} links, note: ${connection.note ? 'yes' : 'no'})`),
        talkNotes: talks,
      },
      null,
      2,
    )}\n`,
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`seed-demo-connections failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeEsClient());
