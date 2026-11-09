import type { estypes } from '@elastic/elasticsearch';
import { generateQuiz } from '../ai/quiz';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { tracer } from '../observability/tracing';
import { isToolError, NotImplementedError, ToolError } from '../tools/tool-errors';
import { awardXp } from '../xp/award';
import { gameRules, xpRewards } from '../types/kubequest.constants';
import { IBossState, IQuizQuestion, IQuizQuestionWithAnswer, IStoredQuiz, ITalk } from '../types/kubequest.interfaces';
import { IAwardXpInput } from '../types/internal.interfaces';
import { BossStatus } from '../types/kubequest.types';
import { worldNow } from '../world/clock';

export type BossDamageSkip = 'not_checked_in' | 'outside_fight_window';

export interface IBossStateView extends IBossState {
  questions?: IQuizQuestion[];
  canDamage?: boolean;
  damageBlockedReason?: BossDamageSkip;
}

export interface IBossAnswerOutcome {
  state: IBossState;
  damageCounted: boolean;
  damageSkipped?: BossDamageSkip;
  message: string;
}

export interface IBossLookup {
  talkId?: string;
  locationId?: string;
  attendeeId?: string;
}

interface IBossTalkDoc extends ITalk {
  quiz?: IStoredQuiz;
  bossQuiz?: IStoredQuiz;
}

interface IBossTally {
  playersInRoom: number;
  damage: number;
  participantIds: string[];
  bonusIds: string[];
  firstBonusAt?: string;
}

const MIN_BOSS_HEALTH = 10;
const BONUS_MARKER = 'boss-bonus';
const MINUTE_MS = 60_000;

function bonusQuestId(talkId: string): string {
  return `${BONUS_MARKER}:${talkId}`;
}

function deadlineFor(talk: ITalk): Date {
  return new Date(new Date(talk.end).getTime() + gameRules.BOSS_GRACE_MINUTES * MINUTE_MS);
}

function windowStartFor(talk: ITalk): Date {
  return new Date(new Date(talk.start).getTime() - gameRules.SESSION_GRACE_MINUTES * MINUTE_MS);
}

function inFightWindow(talk: ITalk, now: Date): boolean {
  return now.getTime() >= new Date(talk.start).getTime() && now.getTime() <= deadlineFor(talk).getTime();
}

const skipMessages: Record<BossDamageSkip, string> = {
  not_checked_in: "Your answers were graded, but they didn't hit the boss: scan the boss room's QR during the session to join the fight.",
  outside_fight_window: "Your answers were graded, but the boss fight isn't on right now, so they didn't hit the boss.",
};

async function getTalk(talkId: string): Promise<IBossTalkDoc | undefined> {
  const response = await getEsClient().get<IBossTalkDoc>({ index: indexNames.TALKS, id: talkId }, { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] });

  return response.found ? response._source : undefined;
}

async function findTalkAt(locationId: string, now: Date): Promise<IBossTalkDoc | undefined> {
  const graceAgo = new Date(now.getTime() - gameRules.BOSS_GRACE_MINUTES * MINUTE_MS).toISOString();
  const filter: estypes.QueryDslQueryContainer[] = [{ term: { locationId } }];
  const client = getEsClient();

  const upcoming = await client.search<IBossTalkDoc>(
    {
      index: indexNames.TALKS,
      size: 1,
      query: { bool: { filter: [...filter, { range: { end: { gte: graceAgo } } }] } },
      sort: [{ isBoss: { order: 'desc' } }, { start: { order: 'asc' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );
  const next = upcoming.hits.hits[0]?._source;

  if (next) {
    return next;
  }

  const recent = await client.search<IBossTalkDoc>(
    { index: indexNames.TALKS, size: 1, query: { bool: { filter } }, sort: [{ start: { order: 'desc' } }] },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return recent.hits.hits[0]?._source;
}

async function resolveTalk(lookup: IBossLookup, now: Date): Promise<IBossTalkDoc> {
  const talk = lookup.talkId ? await getTalk(lookup.talkId) : lookup.locationId ? await findTalkAt(lookup.locationId, now) : undefined;

  if (!talk) {
    throw new ToolError(404, 'boss_not_found', 'There is no boss fight for that talk or room.');
  }

  return talk;
}

function bucketKeys(aggregate: estypes.AggregationsAggregate | undefined): string[] {
  if (!aggregate || !('buckets' in aggregate) || !Array.isArray(aggregate.buckets)) {
    return [];
  }

  return aggregate.buckets.map((bucket: estypes.AggregationsStringTermsBucket) => String(bucket.key));
}

function aggregateValue(aggregate: estypes.AggregationsAggregate | undefined): number {
  if (aggregate && 'value' in aggregate && typeof aggregate.value === 'number') {
    return aggregate.value;
  }

  return 0;
}

function filterBucket(aggregate: estypes.AggregationsAggregate | undefined): Record<string, estypes.AggregationsAggregate> {
  if (aggregate && 'doc_count' in aggregate) {
    return aggregate as unknown as Record<string, estypes.AggregationsAggregate>;
  }

  return {};
}

function eventClock(worldTime: Date): string {
  return new Date(worldTime.getTime() - (worldNow().getTime() - Date.now())).toISOString();
}

function presenceFilter(talk: ITalk): estypes.QueryDslQueryContainer {
  const roomScope: estypes.QueryDslQueryContainer[] = [{ term: { talkId: talk.id } }];

  if (talk.locationId) {
    roomScope.push({ term: { locationId: talk.locationId } });
  }

  return {
    bool: {
      filter: [
        { term: { type: 'check_in' } },
        { range: { at: { gte: eventClock(windowStartFor(talk)), lte: eventClock(deadlineFor(talk)) } } },
        { bool: { should: roomScope, minimum_should_match: 1 } },
      ],
    },
  };
}

async function isPresent(attendeeId: string, talk: ITalk): Promise<boolean> {
  const response = await getEsClient().count(
    { index: indexNames.XP_EVENTS, query: { bool: { filter: [{ term: { attendeeId } }, presenceFilter(talk)] } } },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.count > 0;
}

function participantDamage(aggregate: estypes.AggregationsAggregate | undefined): Map<string, number> {
  const damageByAttendee = new Map<string, number>();

  if (!aggregate || !('buckets' in aggregate) || !Array.isArray(aggregate.buckets)) {
    return damageByAttendee;
  }

  for (const bucket of aggregate.buckets as unknown as Array<Record<string, estypes.AggregationsAggregate> & { key: string }>) {
    const inWindow = filterBucket(bucket['inWindow']);
    damageByAttendee.set(String(bucket.key), aggregateValue(inWindow['total']));
  }

  return damageByAttendee;
}

async function tallyBoss(talk: ITalk): Promise<IBossTally> {
  const windowStart = eventClock(windowStartFor(talk));
  const deadline = eventClock(deadlineFor(talk));

  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      track_total_hits: false,
      query: {
        bool: {
          should: [
            presenceFilter(talk),
            { bool: { filter: [{ term: { type: 'boss' } }, { term: { talkId: talk.id } }] } },
          ],
          minimum_should_match: 1,
        },
      },
      aggs: {
        checkedIn: {
          filter: { term: { type: 'check_in' } },
          aggs: {
            players: { cardinality: { field: 'attendeeId', precision_threshold: 3000 } },
            ids: { terms: { field: 'attendeeId', size: 5000 } },
          },
        },
        answers: {
          filter: { bool: { filter: [{ term: { type: 'boss' } }, { exists: { field: 'correct' } }] } },
          aggs: {
            participants: {
              terms: { field: 'attendeeId', size: 5000 },
              aggs: { inWindow: { filter: { range: { at: { gte: windowStart, lte: deadline } } }, aggs: { total: { sum: { field: 'correct' } } } } },
            },
          },
        },
        bonus: {
          filter: { bool: { filter: [{ term: { type: 'boss' } }, { term: { questId: bonusQuestId(talk.id) } }] } },
          aggs: { winners: { terms: { field: 'attendeeId', size: 5000 } }, firstAt: { min: { field: 'at' } } },
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const aggregations = response.aggregations ?? {};
  const checkedIn = filterBucket(aggregations['checkedIn']);
  const answers = filterBucket(aggregations['answers']);
  const present = new Set(bucketKeys(checkedIn['ids']));
  const damageByAttendee = participantDamage(answers['participants']);
  const presentParticipants = [...damageByAttendee.keys()].filter((attendeeId) => present.has(attendeeId));
  const damage = presentParticipants.reduce((sum, attendeeId) => sum + (damageByAttendee.get(attendeeId) ?? 0), 0);
  const bonus = filterBucket(aggregations['bonus']);
  const firstAtAggregate = bonus['firstAt'];
  const firstBonusAt =
    firstAtAggregate && 'value_as_string' in firstAtAggregate && typeof firstAtAggregate.value_as_string === 'string'
      ? firstAtAggregate.value_as_string
      : undefined;

  return {
    playersInRoom: aggregateValue(checkedIn['players']),
    damage: Math.round(damage),
    participantIds: presentParticipants,
    bonusIds: bucketKeys(bonus['winners']),
    firstBonusAt,
  };
}

function statusFor(talk: ITalk, now: Date, health: number, tally: IBossTally): BossStatus {
  if (health <= 0) {
    return 'defeated';
  }

  if (now.getTime() > deadlineFor(talk).getTime()) {
    return 'escaped';
  }

  if (now.getTime() < windowStartFor(talk).getTime() || (tally.damage === 0 && tally.playersInRoom === 0)) {
    return 'waiting';
  }

  return 'fighting';
}

function buildState(talk: ITalk, tally: IBossTally, now: Date): IBossState {
  const maxHealth = Math.max(MIN_BOSS_HEALTH, gameRules.BOSS_HEALTH_PER_PLAYER * tally.playersInRoom);
  const health = Math.max(0, maxHealth - tally.damage);
  const status = statusFor(talk, now, health, tally);
  const state: IBossState = {
    talkId: talk.id,
    title: talk.title,
    locationId: talk.locationId,
    status,
    maxHealth,
    health,
    damage: Math.min(tally.damage, maxHealth),
    playersInRoom: tally.playersInRoom,
    participants: tally.participantIds.length,
    endsAt: talk.end,
    deadline: deadlineFor(talk).toISOString(),
    bonusXp: xpRewards.BOSS_DEFEATED_BONUS,
  };

  if (status === 'defeated') {
    state.defeatedAt = tally.firstBonusAt ?? now.toISOString();
  }

  return state;
}

function stripAnswers(questions: IQuizQuestionWithAnswer[]): IQuizQuestion[] {
  return questions.slice(0, gameRules.BOSS_QUESTIONS).map((question) => ({ id: question.id, prompt: question.prompt, choices: question.choices }));
}

async function bossQuestions(talk: IBossTalkDoc): Promise<IQuizQuestion[]> {
  if (talk.bossQuiz?.questions?.length) {
    return stripAnswers(talk.bossQuiz.questions);
  }

  if (talk.quiz?.questions?.length) {
    return stripAnswers(talk.quiz.questions);
  }

  try {
    const generated = await generateQuiz(talk);

    return stripAnswers(generated.value);
  } catch (error) {
    if (!isToolError(error)) {
      logger.warn({ err: error, talkId: talk.id }, 'boss quiz unavailable');
    }

    return [];
  }
}

async function safeAward(award: IAwardXpInput): Promise<boolean> {
  try {
    await awardXp(award);

    return true;
  } catch (error) {
    if (error instanceof NotImplementedError) {
      logger.warn({ talkId: award.talkId }, 'awardXp not built yet, boss award skipped');

      return false;
    }

    throw error;
  }
}

async function awardBonusOnce(talk: ITalk, tally: IBossTally): Promise<number> {
  const alreadyPaid = new Set(tally.bonusIds);
  const owed = tally.participantIds.filter((attendeeId) => !alreadyPaid.has(attendeeId));
  let awardedXp = 0;

  for (const attendeeId of owed) {
    const paid = await safeAward({
      attendeeId,
      type: 'boss',
      xp: xpRewards.BOSS_DEFEATED_BONUS,
      material: 'gold',
      talkId: talk.id,
      locationId: talk.locationId,
      questId: bonusQuestId(talk.id),
    });
    awardedXp += paid ? xpRewards.BOSS_DEFEATED_BONUS : 0;
  }

  if (owed.length > 0) {
    logger.info({ talkId: talk.id, winners: owed.length }, 'boss defeated, bonus awarded');
  }

  return awardedXp;
}

async function settleBoss(talk: ITalk, now: Date): Promise<{ state: IBossState; bonusXp: number }> {
  const tally = await tallyBoss(talk);
  const state = buildState(talk, tally, now);
  const defeatedInTime = state.health <= 0 && (tally.bonusIds.length > 0 || now.getTime() <= deadlineFor(talk).getTime());
  const bonusXp = defeatedInTime ? await awardBonusOnce(talk, tally) : 0;

  if (state.health <= 0 && !defeatedInTime) {
    state.status = 'escaped';
    delete state.defeatedAt;
  }

  return { state, bonusXp };
}

export async function getBossState(lookup: IBossLookup): Promise<IBossStateView> {
  const now = worldNow();
  const talk = await resolveTalk(lookup, now);
  const { state } = await settleBoss(talk, now);
  const view: IBossStateView = { ...state };

  if (lookup.attendeeId) {
    view.questions = await bossQuestions(talk);
    const skipped = await damageSkipReason(lookup.attendeeId, talk, now);
    view.canDamage = skipped === undefined;

    if (skipped) {
      view.damageBlockedReason = skipped;
    }
  }

  return view;
}

async function damageSkipReason(attendeeId: string, talk: ITalk, now: Date): Promise<BossDamageSkip | undefined> {
  if (!inFightWindow(talk, now)) {
    return 'outside_fight_window';
  }

  return (await isPresent(attendeeId, talk)) ? undefined : 'not_checked_in';
}

export async function recordBossAnswers(attendeeId: string, talkId: string, correct: number): Promise<IBossAnswerOutcome | undefined> {
  return tracer.startActiveSpan('boss.record_answers', { attributes: { 'kubequest.attendee.id': attendeeId, 'kubequest.talk.id': talkId } }, async (span) => {
    try {
      const now = worldNow();
      const talk = await getTalk(talkId);

      if (!talk) {
        span.setAttribute('kubequest.xp.awarded', 0);

        return undefined;
      }

      const correctAnswers = Math.max(0, Math.min(gameRules.BOSS_QUESTIONS, Math.floor(correct)));
      const skipped = await damageSkipReason(attendeeId, talk, now);

      if (skipped) {
        const { state } = await settleBoss(talk, now);
        span.setAttributes({
          'kubequest.xp.awarded': 0,
          'kubequest.boss.damage_recorded': 0,
          'kubequest.boss.damage_skipped': skipped,
          'kubequest.boss.health': state.health,
          'kubequest.boss.status': state.status,
        });
        logger.info({ attendeeId, talkId: talk.id, reason: skipped }, 'boss answers graded without damage');

        return { state, damageCounted: false, damageSkipped: skipped, message: skipMessages[skipped] };
      }

      const paid = await safeAward({ attendeeId, type: 'boss', xp: 0, correct: correctAnswers, talkId: talk.id, locationId: talk.locationId });
      await getEsClient().indices.refresh({ index: indexNames.XP_EVENTS }, esOptions(esTimeouts.WRITE_MS)).catch(() => undefined);

      const { state, bonusXp } = await settleBoss(talk, now);
      span.setAttributes({
        'kubequest.xp.awarded': 0,
        'kubequest.boss.damage_recorded': paid ? correctAnswers : 0,
        'kubequest.boss.bonus_xp': bonusXp,
        'kubequest.boss.health': state.health,
        'kubequest.boss.max_health': state.maxHealth,
        'kubequest.boss.status': state.status,
      });

      return {
        state,
        damageCounted: paid,
        message: paid ? `${correctAnswers} hit${correctAnswers === 1 ? '' : 's'} on the boss.` : 'Your answers were graded; boss damage is not available yet.',
      };
    } finally {
      span.end();
    }
  });
}
