import { ToolError } from '../tools/tool-errors';
import { IAttendee, IMakeQuestInput, IQuest } from '../types/kubequest.interfaces';
import { attendQuest, IOfferContext, outpostQuest } from './offers';
import { acceptQuest, ensureActiveRoom } from './respond';
import { loadAttendee, loadLocation, loadQuest, loadTalk, saveQuests } from './store';

function context(attendee: IAttendee, now: Date, here: IOfferContext['here']): IOfferContext {
  return { attendee, now, here, eventsToday: [], allEvents: [], avoidFar: false };
}

async function buildTarget(input: IMakeQuestInput, attendee: IAttendee, now: Date): Promise<IQuest> {
  const here = await loadLocation(attendee.lastLocationId);

  if (input.targetKind === 'session') {
    const talk = await loadTalk(input.targetId);

    if (!talk) {
      throw new ToolError(404, 'unknown_talk', 'We could not find that session.');
    }

    if (talk.end <= now.toISOString()) {
      throw new ToolError(409, 'quest_expired', 'That session has already ended.');
    }

    return attendQuest(context(attendee, now, here), talk, await loadLocation(talk.locationId), 'You picked this session yourself.');
  }

  const location = await loadLocation(input.targetId);

  if (!location || location.kind !== 'outpost') {
    throw new ToolError(404, 'unknown_outpost', 'We could not find that outpost.');
  }

  return outpostQuest(context(attendee, now, here), location, 'You picked this outpost yourself.');
}

export async function makeQuest(input: IMakeQuestInput, now: Date = new Date()): Promise<IQuest> {
  const attendee = await loadAttendee(input.attendeeId);
  const quest = await buildTarget(input, attendee, now);
  const existing = await loadQuest(quest.id);

  if (existing?.status === 'accepted') {
    return existing;
  }

  if (existing?.status === 'completed') {
    throw new ToolError(409, 'quest_done', 'You already completed that one.');
  }

  await ensureActiveRoom(input.attendeeId, quest.id);
  const made: IQuest = { ...quest, source: 'player', declineReason: undefined };
  await acceptQuest(made, now);
  await saveQuests([made]);

  return made;
}
