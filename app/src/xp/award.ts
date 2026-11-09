import { randomUUID } from 'node:crypto';
import { SpanStatusCode } from '@opentelemetry/api';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { kubequestMetrics } from '../observability/metrics';
import { currentTraceIds, tracer } from '../observability/tracing';
import { completeQuestsFor } from '../quests/complete';
import { isToolError } from '../tools/tool-errors';
import { playerLevels } from '../types/kubequest.constants';
import { IAwardXpInput } from '../types/internal.interfaces';
import { IBannerProgress, ILevelProgress, IQuest, IXpEvent } from '../types/kubequest.interfaces';
import { BannerId } from '../types/kubequest.types';
import { bannersDue, bannersFromSummary } from './banners';
import { leveledUp, levelProgress } from './levels';
import { IAttendeeInventoryDoc, ILedgerSummary, summaryFromAttendee } from './xp-ledger';

export interface IAwardXpOutcome {
  event: IXpEvent;
  xpBefore: number;
  xpAfter: number;
  level: ILevelProgress;
  levelUp?: ILevelProgress;
  newBanners: IBannerProgress[];
  completedQuests: IQuest[];
}


const applyAwardScript = [
  'if (ctx._source.xp == null) { ctx._source.xp = 0; }',
  'ctx._source.xp += params.xp;',
  'int level = 1;',
  'for (int i = 0; i < params.thresholds.size(); i++) { if (ctx._source.xp >= params.thresholds[i]) { level = i + 1; } }',
  'ctx._source.level = level;',
  'if (ctx._source.inventory == null) { ctx._source.inventory = new HashMap(); }',
  'if (ctx._source.inventory.blocks == null) { ctx._source.inventory.blocks = new HashMap(); }',
  'if (ctx._source.inventory.gems == null) { ctx._source.inventory.gems = 0; }',
  'if (params.material != null) {',
  '  def current = ctx._source.inventory.blocks[params.material];',
  '  ctx._source.inventory.blocks[params.material] = (current == null ? 0 : current) + 1;',
  '}',
  'ctx._source.inventory.gems += params.gems;',
  'if (params.counter != null) {',
  '  def counted = ctx._source.inventory[params.counter];',
  '  ctx._source.inventory[params.counter] = (counted == null ? 0 : counted) + 1;',
  '}',
].join('\n');

const appendBannerScript = [
  'if (ctx._source.banners == null) { ctx._source.banners = new ArrayList(); }',
  'if (ctx._source.banners.contains(params.banner)) { ctx.op = "noop"; } else { ctx._source.banners.add(params.banner); }',
].join('\n');

const visibleAtOnce: ReadonlySet<IXpEvent['type']> = new Set<IXpEvent['type']>(['check_in', 'outpost']);

const liveCounters: Partial<Record<IXpEvent['type'], string>> = {
  handshake: 'handshakes',
  welcome: 'welcomes',
  outpost: 'outposts',
};

function buildEvent(award: IAwardXpInput, id: string): IXpEvent {
  const { traceId, spanId } = currentTraceIds();
  const event: IXpEvent = {
    id,
    attendeeId: award.attendeeId,
    type: award.type,
    xp: award.xp,
    at: new Date().toISOString(),
  };

  const optional: Partial<IXpEvent> = {
    material: award.material,
    gems: award.gems,
    talkId: award.talkId,
    locationId: award.locationId,
    introId: award.introId,
    questId: award.questId,
    correct: award.correct,
    banner: award.banner,
    traceId,
    spanId,
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) {
      Reflect.set(event, key, value);
    }
  }

  return event;
}

async function writeEvent(event: IXpEvent, onlyOnce: boolean): Promise<boolean> {
  try {
    await getEsClient().index(
      {
        index: indexNames.XP_EVENTS,
        id: event.id,
        document: event,
        ...(onlyOnce ? { op_type: 'create' as const } : {}),
        ...(visibleAtOnce.has(event.type) ? { refresh: 'wait_for' as const } : {}),
      },
      esOptions(esTimeouts.WRITE_MS),
    );

    return true;
  } catch (error) {
    if (onlyOnce && typeof error === 'object' && error !== null && Reflect.get(error, 'statusCode') === 409) {
      return false;
    }

    throw error;
  }
}

async function applyToAttendee(event: IXpEvent): Promise<IAttendeeInventoryDoc> {
  const response = await getEsClient().update<IAttendeeInventoryDoc, IAttendeeInventoryDoc>(
    {
      index: indexNames.ATTENDEES,
      id: event.attendeeId,
      script: {
        lang: 'painless',
        source: applyAwardScript,
        params: {
          xp: event.xp,
          gems: event.gems ?? 0,
          material: event.material ?? null,
          thresholds: playerLevels.map((definition) => definition.minXp),
          counter: liveCounters[event.type] ?? null,
        },
      },
      _source: ['xp', 'level', 'banners', 'inventory'],
      retry_on_conflict: 3,
    },
    esOptions(esTimeouts.WRITE_MS),
  );

  return response.get?._source ?? {};
}

async function appendBanner(attendeeId: string, banner: BannerId): Promise<boolean> {
  const response = await getEsClient().update(
    {
      index: indexNames.ATTENDEES,
      id: attendeeId,
      script: { lang: 'painless', source: appendBannerScript, params: { banner } },
      retry_on_conflict: 3,
    },
    esOptions(esTimeouts.WRITE_MS),
  );

  return response.result === 'updated';
}

async function loadAttendeeDoc(attendeeId: string): Promise<IAttendeeInventoryDoc> {
  const response = await getEsClient().get<IAttendeeInventoryDoc>(
    { index: indexNames.ATTENDEES, id: attendeeId, _source_includes: ['xp', 'level', 'banners', 'inventory', 'isSpeaker'] },
    esOptions(esTimeouts.DEFAULT_MS),
  );

  return response._source ?? {};
}

export async function awardDueBanners(attendeeId: string, known?: ILedgerSummary): Promise<IBannerProgress[]> {
  const summary = known ?? summaryFromAttendee(await loadAttendeeDoc(attendeeId));
  const awarded: BannerId[] = [];

  for (const banner of bannersDue(summary)) {
    const badge = buildEvent({ attendeeId, type: 'badge', xp: 0, banner }, `${attendeeId}:badge:${banner}`);
    const created = await writeEvent(badge, true);
    const appended = await appendBanner(attendeeId, banner);

    if (created || appended) {
      kubequestMetrics().xpAwarded.add(0, { 'kubequest.xp.type': 'badge', 'kubequest.banner': banner });
      summary.earnedBanners[banner] = badge.at;
      awarded.push(banner);
    }
  }

  return bannersFromSummary(summary, false).filter((progress) => awarded.includes(progress.id));
}

async function completeQuestsSafely(event: IXpEvent): Promise<IQuest[]> {
  try {
    return await completeQuestsFor(event);
  } catch (error) {
    if (isToolError(error) && error.status === 501) {
      return [];
    }

    logger.warn({ err: error, attendeeId: event.attendeeId }, 'quest completion failed after xp award');

    return [];
  }
}

export async function claimOnce(event: IXpEvent): Promise<boolean> {
  return writeEvent(event, true);
}

async function runAward(award: IAwardXpInput, onceKey?: string): Promise<IAwardXpOutcome | undefined> {
  return tracer.startActiveSpan(
    'xp.award',
    { attributes: { 'kubequest.attendee.id': award.attendeeId, 'kubequest.xp.type': award.type, 'kubequest.xp.awarded': award.xp } },
    async (span) => {
      try {
        const event = buildEvent({ ...award, xp: Math.max(0, Math.round(award.xp)) }, onceKey ?? randomUUID());

        if (onceKey !== undefined && !(await writeEvent(event, true))) {
          span.setAttribute('kubequest.xp.already_paid', true);
          span.setStatus({ code: SpanStatusCode.OK });

          return undefined;
        }

        const totals = await applyToAttendee(event);

        if (onceKey === undefined) {
          await writeEvent(event, false);
        }

        const xpAfter = totals.xp ?? event.xp;
        const xpBefore = xpAfter - event.xp;

        kubequestMetrics().xpAwarded.add(event.xp, { 'kubequest.xp.type': event.type });

        const newBanners = event.type === 'badge' ? [] : await awardDueBanners(event.attendeeId, summaryFromAttendee(totals));
        const completedQuests = await completeQuestsSafely(event);
        const level = levelProgress(xpAfter);

        span.setAttribute('kubequest.xp.event_id', event.id);
        span.setAttribute('kubequest.xp.total', xpAfter);
        span.setAttribute('kubequest.level', level.level);
        span.setStatus({ code: SpanStatusCode.OK });
        logger.info({ attendeeId: event.attendeeId, type: event.type, xp: event.xp, xpAfter, banners: newBanners.map((banner) => banner.id) }, 'xp awarded');

        return {
          event,
          xpBefore,
          xpAfter,
          level,
          ...(leveledUp(xpBefore, xpAfter) ? { levelUp: level } : {}),
          newBanners,
          completedQuests,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        span.recordException(error instanceof Error ? error : new Error(message));
        span.setStatus({ code: SpanStatusCode.ERROR, message });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

export async function awardXpDetailed(award: IAwardXpInput): Promise<IAwardXpOutcome> {
  const outcome = await runAward(award);

  if (!outcome) {
    throw new Error('xp award returned no outcome');
  }

  return outcome;
}

export async function awardXpOnce(award: IAwardXpInput, onceKey: string): Promise<boolean> {
  return (await runAward(award, onceKey)) !== undefined;
}

export async function awardXpOnceDetailed(award: IAwardXpInput, onceKey: string): Promise<IAwardXpOutcome | undefined> {
  return runAward(award, onceKey);
}

export async function awardXp(award: IAwardXpInput): Promise<IXpEvent> {
  const outcome = await awardXpDetailed(award);

  return outcome.event;
}
