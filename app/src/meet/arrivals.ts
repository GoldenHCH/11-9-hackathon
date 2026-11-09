import { SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../observability/logger';
import { kubequestMetrics } from '../observability/metrics';
import { tracer } from '../observability/tracing';
import { isToolError } from '../tools/tool-errors';
import { gameRules, xpRewards } from '../types/kubequest.constants';
import { IIntro } from '../types/kubequest.interfaces';
import { awardXp } from '../xp/award';
import { getIntro, IStoredIntro, isConflict, replaceIntro, searchIntros } from './meet.store';

const MINUTE_MS = 60_000;

async function awardHandshake(intro: IIntro, locationId: string): Promise<number> {
  let total = 0;

  for (const attendeeId of [intro.fromId, intro.toId]) {
    try {
      await awardXp({ attendeeId, type: 'handshake', xp: xpRewards.MEET, gems: 1, introId: intro.id, locationId });
      total += xpRewards.MEET;

      if (intro.firstTimerPair) {
        await awardXp({ attendeeId, type: 'welcome', xp: xpRewards.MEET_FIRST_TIMER_BONUS, introId: intro.id, locationId });
        total += xpRewards.MEET_FIRST_TIMER_BONUS;
      }
    } catch (error) {
      if (!isToolError(error) || error.code !== 'not_implemented') {
        throw error;
      }

      logger.warn({ meetId: intro.id, attendeeId }, 'awardXp not available yet, handshake recorded without XP');
    }
  }

  return total;
}

async function arriveAt(stored: IStoredIntro, attendeeId: string, locationId: string, at: Date): Promise<{ intro: IIntro; xp: number } | undefined> {
  const intro = stored.intro;

  if (intro.status !== 'accepted' || Date.parse(intro.expiresAt) < at.getTime() || intro.arrivals.some((arrival) => arrival.attendeeId === attendeeId)) {
    return undefined;
  }

  const arrivals = [...intro.arrivals, { attendeeId, at: at.toISOString() }];
  const partnerArrival = arrivals.find((arrival) => arrival.attendeeId !== attendeeId);
  const met = partnerArrival !== undefined && at.getTime() - Date.parse(partnerArrival.at) <= gameRules.MEET_SCAN_WINDOW_MINUTES * MINUTE_MS;
  const next: IIntro = met ? { ...intro, arrivals, status: 'met', metAt: at.toISOString() } : { ...intro, arrivals };

  await replaceIntro(stored, next);

  if (!met) {
    return { intro: next, xp: 0 };
  }

  kubequestMetrics().handshakes.add(1, { 'kubequest.location.id': locationId, 'kubequest.meet.first_timer_pair': intro.firstTimerPair });

  return { intro: next, xp: await awardHandshake(next, locationId) };
}

export async function recordArrival(attendeeId: string, locationId: string): Promise<IIntro[]> {
  return tracer.startActiveSpan(
    'meet.record_arrival',
    { attributes: { 'kubequest.attendee.id': attendeeId, 'kubequest.location.id': locationId } },
    async (span) => {
      try {
        const at = new Date();
        const candidates = await searchIntros(attendeeId, locationId);
        const updated: IIntro[] = [];
        let xp = 0;

        for (const stored of candidates) {
          try {
            const result = await arriveAt(stored, attendeeId, locationId, at).catch(async (error: unknown) => {
              const fresh = isConflict(error) ? await getIntro(stored.intro.id) : undefined;

              if (!fresh) {
                throw error;
              }

              return arriveAt(fresh, attendeeId, locationId, at);
            });

            if (result) {
              updated.push(result.intro);
              xp += result.xp;
              span.setAttributes({ 'kubequest.meet.id': result.intro.id, 'kubequest.meet.status': result.intro.status });
            }
          } catch (error) {
            if (!isConflict(error)) {
              throw error;
            }

            logger.info({ meetId: stored.intro.id }, 'meet changed during arrival, skipping');
          }
        }

        span.setAttribute('kubequest.xp.awarded', xp);
        span.setStatus({ code: SpanStatusCode.OK });

        return updated;
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    },
  );
}
