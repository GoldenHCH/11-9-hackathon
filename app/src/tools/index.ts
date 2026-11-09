import type { IToolSignatures, ToolName } from '@kubequest/shared';
import { container } from '../container';
import { IntroService } from './intro.service';
import { LeaderboardService } from './leaderboard.service';
import { LookupService } from './lookup.service';
import { PresenceService } from './presence.service';
import { QuizService } from './quiz.service';
import { RecommendService } from './recommend.service';
import { toolMetadata } from './tool-metadata.constants';
import { ToolTracerHelper } from './tool-tracer.helper';
import type { IToolDefinition, IToolDependencies } from './tools.interfaces';
import type { ToolRegistry } from './tools.types';
import { XpLedgerService } from './xp-ledger.service';

function defineTool<Name extends ToolName>(
  name: Name,
  run: (input: IToolSignatures[Name]['input']) => Promise<IToolSignatures[Name]['output']>,
): IToolDefinition<Name> {
  return {
    name,
    description: toolMetadata[name].description,
    inputSchema: toolMetadata[name].inputSchema,
    handler: (input) => ToolTracerHelper.run(name, input, () => run(input)),
  };
}

export function createToolRegistry(dependencies: IToolDependencies): ToolRegistry {
  const lookup = new LookupService(dependencies.store);
  const ledger = new XpLedgerService(dependencies.store, dependencies.esClient);
  const recommend = new RecommendService(dependencies.store, lookup);
  const presence = new PresenceService(dependencies.store, lookup, ledger, recommend);
  const intros = new IntroService(dependencies.store, lookup);
  const quizzes = new QuizService(dependencies.store, lookup, ledger);
  const leaderboard = new LeaderboardService(dependencies.store);

  return {
    check_in: defineTool('check_in', (input) => presence.checkIn(input)),
    recommend_talks: defineTool('recommend_talks', (input) => recommend.recommendTalks(input)),
    recommend_people: defineTool('recommend_people', (input) => recommend.recommendPeople(input)),
    whats_around_me: defineTool('whats_around_me', (input) => presence.whatsAroundMe(input)),
    whats_next: defineTool('whats_next', (input) => presence.whatsNext(input)),
    propose_intro: defineTool('propose_intro', (input) => intros.proposeIntro(input)),
    respond_intro: defineTool('respond_intro', (input) => intros.respondIntro(input)),
    quiz_for_talk: defineTool('quiz_for_talk', (input) => quizzes.quizForTalk(input)),
    submit_quiz: defineTool('submit_quiz', (input) => quizzes.submitQuiz(input)),
    leaderboard: defineTool('leaderboard', (input) => leaderboard.leaderboard(input)),
  };
}

export const toolRegistry: ToolRegistry = createToolRegistry(container);
