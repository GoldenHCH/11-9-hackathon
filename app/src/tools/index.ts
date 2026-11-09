import { connectionToolRegistry } from '../connections/connection-tools';
import { ToolName } from '../types/kubequest.types';
import { bossStateTool } from './boss-state.tool';
import { checkInTool } from './check-in.tool';
import { getProfileTool } from './get-profile.tool';
import { inventoryTool } from './inventory.tool';
import { leaderboardTool } from './leaderboard.tool';
import { listMeetsTool } from './list-meets.tool';
import { makeQuestTool } from './make-quest.tool';
import { organizerStatsTool } from './organizer-stats.tool';
import { proposeMeetTool } from './propose-meet.tool';
import { questBoardTool } from './quest-board.tool';
import { quizForTalkTool } from './quiz-for-talk.tool';
import { recommendPeopleTool } from './recommend-people.tool';
import { recommendTalksTool } from './recommend-talks.tool';
import { respondMeetTool } from './respond-meet.tool';
import { respondQuestTool } from './respond-quest.tool';
import { screenTokenTool } from './screen-token.tool';
import { searchTool } from './search.tool';
import { signInTool } from './sign-in.tool';
import { signUpTool } from './sign-up.tool';
import { submitQuizTool } from './submit-quiz.tool';
import { updateSettingsTool } from './update-settings.tool';
import { whatsAroundMeTool } from './whats-around-me.tool';
import { whatsNextTool } from './whats-next.tool';
import { worldTool } from './world.tool';
import { answerHandshakeTool } from './answer-handshake.tool';
import { handshakeCodeTool } from './handshake-code.tool';
import { handshakeStateTool } from './handshake-state.tool';
import { listBoothNotesTool } from './list-booth-notes.tool';
import { listMessagesTool } from './list-messages.tool';
import { recapTool } from './recap.tool';
import { saveBoothNoteTool } from './save-booth-note.tool';
import { sendMessageTool } from './send-message.tool';
import { startHandshakeTool } from './start-handshake.tool';
import { IRegisteredTool } from './define-tool';

export const toolRegistry = {
  sign_in: signInTool,
  sign_up: signUpTool,
  get_profile: getProfileTool,
  update_settings: updateSettingsTool,
  check_in: checkInTool,
  screen_token: screenTokenTool,
  whats_around_me: whatsAroundMeTool,
  whats_next: whatsNextTool,
  search: searchTool,
  recommend_talks: recommendTalksTool,
  recommend_people: recommendPeopleTool,
  quest_board: questBoardTool,
  respond_quest: respondQuestTool,
  make_quest: makeQuestTool,
  quiz_for_talk: quizForTalkTool,
  submit_quiz: submitQuizTool,
  boss_state: bossStateTool,
  propose_meet: proposeMeetTool,
  respond_meet: respondMeetTool,
  list_meets: listMeetsTool,
  leaderboard: leaderboardTool,
  inventory: inventoryTool,
  world: worldTool,
  organizer_stats: organizerStatsTool,
  handshake_code: handshakeCodeTool,
  start_handshake: startHandshakeTool,
  handshake_state: handshakeStateTool,
  answer_handshake: answerHandshakeTool,
  save_booth_note: saveBoothNoteTool,
  list_booth_notes: listBoothNotesTool,
  send_message: sendMessageTool,
  list_messages: listMessagesTool,
  recap: recapTool,
  ...connectionToolRegistry,
} satisfies { [TName in ToolName]: IRegisteredTool<TName> };

export function findTool(name: string): IRegisteredTool | undefined {
  if (!Object.hasOwn(toolRegistry, name)) {
    return undefined;
  }

  return toolRegistry[name as ToolName] as IRegisteredTool;
}

export function listTools(): IRegisteredTool[] {
  return Object.values(toolRegistry) as IRegisteredTool[];
}
