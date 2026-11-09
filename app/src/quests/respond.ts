import { logger } from '../observability/logger';
import { proposeMeetTool } from '../tools/propose-meet.tool';
import { ToolError } from '../tools/tool-errors';
import { gameRules } from '../types/kubequest.constants';
import { IQuest, IRespondQuestInput, IRespondQuestResult, ITalk } from '../types/kubequest.interfaces';
import { buildBoard } from './board';
import { listQuests, loadQuest, loadTalk, saveQuests } from './store';
import { addMinutes, endOfConferenceDay } from './time';

async function acceptedExpiry(quest: IQuest, now: Date, talk?: ITalk): Promise<string | undefined> {
  switch (quest.type) {
    case 'attend':
      return talk?.end ?? quest.when?.end;
    case 'boss':
      return addMinutes(new Date(talk?.end ?? quest.when?.end ?? now.toISOString()), gameRules.BOSS_GRACE_MINUTES).toISOString();
    case 'quiz':
    case 'outpost':
    case 'photo':
      return endOfConferenceDay(now).toISOString();
    case 'chat':
      return addMinutes(now, gameRules.MEET_OFFER_MINUTES + gameRules.MEET_SCAN_WINDOW_MINUTES).toISOString();
    case 'collection':
      return undefined;
  }
}

async function startMeet(quest: IQuest): Promise<void> {
  if (!quest.partnerId) {
    return;
  }

  try {
    const meet = await proposeMeetTool.run({ attendeeId: quest.attendeeId, partnerId: quest.partnerId });
    quest.introId = meet.id;
    quest.expiresAt = meet.expiresAt;
    quest.nextStep = meet.statusLine || quest.nextStep;
  } catch (error) {
    logger.warn({ err: error, questId: quest.id }, 'chat quest accepted but the meet could not be proposed yet');
  }
}

export async function ensureActiveRoom(attendeeId: string, ignoreId?: string): Promise<void> {
  const active = (await listQuests(attendeeId)).filter((quest) => quest.status === 'accepted' && quest.id !== ignoreId);

  if (active.length >= gameRules.MAX_ACTIVE_QUESTS) {
    throw new ToolError(409, 'too_many_active', `You already have ${gameRules.MAX_ACTIVE_QUESTS} active quests. Finish or drop one first.`);
  }
}

export async function acceptQuest(quest: IQuest, now: Date): Promise<void> {
  const talk = quest.talkId && (quest.type === 'attend' || quest.type === 'boss') ? await loadTalk(quest.talkId) : undefined;

  if (quest.type === 'attend' && talk && talk.end <= now.toISOString()) {
    throw new ToolError(409, 'quest_expired', 'That session has already ended.');
  }

  quest.status = 'accepted';
  quest.respondedAt = now.toISOString();
  quest.snoozedUntil = undefined;
  quest.expiresAt = await acceptedExpiry(quest, now, talk);

  if (quest.type === 'chat') {
    await startMeet(quest);
  }
}

export async function respondToQuest(input: IRespondQuestInput, now: Date = new Date()): Promise<IRespondQuestResult> {
  const quest = await loadQuest(input.questId);

  if (!quest || quest.attendeeId !== input.attendeeId) {
    throw new ToolError(404, 'unknown_quest', 'That quest is no longer on your board.');
  }

  switch (input.response) {
    case 'accept':
      if (quest.status !== 'offered' && quest.status !== 'not_now') {
        throw new ToolError(409, 'quest_not_open', `That quest is ${quest.status.replace('_', ' ')}, so it cannot be accepted.`);
      }

      await ensureActiveRoom(input.attendeeId, quest.id);
      await acceptQuest(quest, now);
      break;
    case 'not_now':
      if (quest.status !== 'offered') {
        throw new ToolError(409, 'quest_not_open', 'Only an offer can be put off.');
      }

      quest.status = 'not_now';
      quest.respondedAt = now.toISOString();
      quest.snoozedUntil = addMinutes(now, gameRules.NOT_NOW_MINUTES).toISOString();
      break;
    case 'not_for_me':
      if (quest.status === 'completed') {
        throw new ToolError(409, 'quest_not_open', 'That quest is already done.');
      }

      quest.status = 'declined';
      quest.respondedAt = now.toISOString();
      quest.declineReason = input.reason;
      break;
    case 'drop':
      if (quest.status !== 'accepted') {
        throw new ToolError(409, 'quest_not_active', 'Only an accepted quest can be dropped.');
      }

      quest.status = 'dropped';
      quest.respondedAt = now.toISOString();
      break;
  }

  await saveQuests([quest]);

  return { quest, board: await buildBoard(input.attendeeId, now, input.response !== 'accept') };
}
