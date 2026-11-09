import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { loadTalk } from '../quiz/store';
import { ToolError } from '../tools/tool-errors';
import { IAttendee, IItineraryChangeInput, IItineraryChangeResult, IItineraryEntry } from '../types/kubequest.interfaces';
import { worldNow } from '../world/clock';
import { addScript, itineraryRules, removeScript } from './itinerary.constants';

function statusOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? Reflect.get(error, 'statusCode') : undefined;
}

function unknownPlayer(): ToolError {
  return new ToolError(404, 'attendee_not_found', 'We could not find that player. Sign up first.');
}

export async function readItinerary(attendeeId: string): Promise<IItineraryEntry[]> {
  try {
    const response = await getEsClient().get<Pick<IAttendee, 'itinerary'>>(
      { index: indexNames.ATTENDEES, id: attendeeId, _source_includes: ['itinerary'] },
      esOptions(esTimeouts.DEFAULT_MS),
    );

    return response._source?.itinerary ?? [];
  } catch (error) {
    if (statusOf(error) === 404) {
      throw unknownPlayer();
    }

    throw error;
  }
}

export async function plannedTalkIds(attendeeId: string): Promise<Set<string>> {
  return new Set((await readItinerary(attendeeId)).map((entry) => entry.talkId));
}

async function runScript(attendeeId: string, source: string, params: Record<string, unknown>): Promise<IItineraryEntry[]> {
  try {
    const response = await getEsClient().update<IAttendee, Partial<IAttendee>, Pick<IAttendee, 'itinerary'>>(
      {
        index: indexNames.ATTENDEES,
        id: attendeeId,
        script: { lang: 'painless', source, params },
        _source: ['itinerary'],
        retry_on_conflict: 3,
      },
      esOptions(esTimeouts.WRITE_MS),
    );

    return response.get?._source?.itinerary ?? (await readItinerary(attendeeId));
  } catch (error) {
    if (statusOf(error) === 404) {
      throw unknownPlayer();
    }

    throw error;
  }
}

function changeResult(talkId: string, entries: IItineraryEntry[]): IItineraryChangeResult {
  return {
    talkId,
    inItinerary: entries.some((entry) => entry.talkId === talkId),
    plannedCount: entries.length,
    maxItems: itineraryRules.MAX_ITEMS,
  };
}

export async function addToItinerary(input: IItineraryChangeInput): Promise<IItineraryChangeResult> {
  await loadTalk(input.talkId);

  const entries = await runScript(input.attendeeId, addScript, {
    talkId: input.talkId,
    addedAt: worldNow().toISOString(),
    maxItems: itineraryRules.MAX_ITEMS,
  });
  const result = changeResult(input.talkId, entries);

  if (!result.inItinerary) {
    throw new ToolError(409, 'itinerary_full', `Your plan is full (${itineraryRules.MAX_ITEMS} sessions). Remove one to add another.`);
  }

  return result;
}

export async function removeFromItinerary(input: IItineraryChangeInput): Promise<IItineraryChangeResult> {
  const entries = await runScript(input.attendeeId, removeScript, { talkId: input.talkId });

  return changeResult(input.talkId, entries);
}
