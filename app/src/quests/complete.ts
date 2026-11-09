import { IQuest, IXpEvent } from '../types/kubequest.interfaces';
import { listQuests, saveQuests } from './store';

function matches(quest: IQuest, event: IXpEvent): boolean {
  switch (quest.type) {
    case 'attend':
      return event.type === 'check_in' && ((event.talkId !== undefined && quest.talkId === event.talkId) || (quest.talkId === undefined && quest.locationId === event.locationId));
    case 'outpost':
      return (event.type === 'outpost' || event.type === 'check_in') && event.locationId !== undefined && quest.locationId === event.locationId;
    case 'quiz':
      return event.type === 'quiz' && event.talkId !== undefined && quest.talkId === event.talkId;
    case 'boss':
      return event.type === 'boss' && event.talkId !== undefined && quest.talkId === event.talkId;
    case 'chat':
      return event.type === 'handshake' && event.introId !== undefined && quest.introId === event.introId;
    case 'collection':
      return event.type === 'badge' && event.banner !== undefined && quest.reward.banner === event.banner;
  }
}

export async function completeQuestsFor(event: IXpEvent): Promise<IQuest[]> {
  const quests = await listQuests(event.attendeeId);
  const completed = quests
    .filter((quest) => (quest.status === 'accepted' || quest.status === 'offered') && matches(quest, event))
    .filter((quest) => quest.status === 'accepted' || quest.type === 'collection')
    .map((quest): IQuest => ({ ...quest, status: 'completed', completedAt: event.at }));

  await saveQuests(completed);

  return completed;
}
