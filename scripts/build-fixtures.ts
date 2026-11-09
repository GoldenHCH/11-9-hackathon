import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IIntro, ToolName } from '@kubequest/shared';
import { ConfigHelper } from '../app/src/config/config.helper';
import { buildContainer } from '../app/src/container';
import { signLocationToken } from '../app/src/security/tokens';
import { createToolRegistry } from '../app/src/tools';
import { QuizHelper } from '../app/src/tools/quiz.helper';

function writeFixture(fixturesDir: string, tool: ToolName, response: unknown): void {
  fs.writeFileSync(path.join(fixturesDir, `${tool}.json`), `${JSON.stringify(response, null, 2)}\n`);
  console.log(`fixtures: wrote ${tool}.json`);
}

async function main(): Promise<void> {
  const config = ConfigHelper.fromEnv({ ...process.env, ELASTIC_URL: '', ELASTIC_API_KEY: '' });
  const container = buildContainer(config);
  const seedMeta = container.store.getSeedMeta();

  if (!seedMeta) {
    throw new Error(`seed-meta.json not found in ${config.resourcesDir}. Run the seed scripts first.`);
  }

  const registry = createToolRegistry({ store: container.store, esClient: container.esClient });
  const fixturesDir = path.join(config.resourcesDir, 'fixtures');
  const platformId = seedMeta.demoPersonas.platformEngineerId;
  const firstTimerId = seedMeta.demoPersonas.firstTimerId;
  const platform = container.store.getAttendee(platformId);
  const now = container.store.now().getTime();
  const freshRoomWithTalkNow = container.store
    .getSessions()
    .filter((session) => Date.parse(session.start) <= now && now < Date.parse(session.end))
    .map((session) => session.locationId)
    .find((locationId) => locationId !== platform?.lastLocationId);
  const checkInLocationId = freshRoomWithTalkNow ?? platform?.lastLocationId ?? container.store.getLocations()[0]?.id;

  if (!platform || !checkInLocationId) {
    throw new Error(`Demo persona ${platformId} or a location was not found in ${config.resourcesDir}.`);
  }

  fs.mkdirSync(fixturesDir, { recursive: true });

  writeFixture(fixturesDir, 'recommend_talks', await registry.recommend_talks.handler({ attendeeId: platformId, limit: 5 }));
  writeFixture(fixturesDir, 'recommend_people', await registry.recommend_people.handler({ attendeeId: platformId, limit: 5 }));
  writeFixture(fixturesDir, 'whats_around_me', await registry.whats_around_me.handler({ attendeeId: platformId }));

  const next = await registry.whats_next.handler({ attendeeId: platformId });

  writeFixture(fixturesDir, 'whats_next', next);

  const talk = next.session ?? container.store.getSessions()[0];

  if (!talk) {
    throw new Error(`No sessions found in ${config.resourcesDir}.`);
  }

  const talkId = talk.id;
  const gradedQuiz = QuizHelper.buildQuiz(talk, container.store.getSessions(), container.store.getLocations());

  writeFixture(fixturesDir, 'quiz_for_talk', await registry.quiz_for_talk.handler({ talkId }));
  writeFixture(
    fixturesDir,
    'submit_quiz',
    await registry.submit_quiz.handler({
      attendeeId: platformId,
      talkId,
      answers: gradedQuiz.questions.map((question) => question.answer),
    }),
  );

  const proposed: IIntro = await registry.propose_intro.handler({ fromId: platformId, toId: firstTimerId });

  writeFixture(fixturesDir, 'propose_intro', proposed);
  writeFixture(
    fixturesDir,
    'respond_intro',
    proposed.status === 'proposed'
      ? await registry.respond_intro.handler({ introId: proposed.id, attendeeId: firstTimerId, response: 'accept' })
      : proposed,
  );
  writeFixture(fixturesDir, 'leaderboard', await registry.leaderboard.handler({ limit: 10 }));
  writeFixture(
    fixturesDir,
    'check_in',
    await registry.check_in.handler({
      attendeeId: platformId,
      locationId: checkInLocationId,
      token: signLocationToken(checkInLocationId),
    }),
  );
}

main().catch((error) => {
  console.error('build-fixtures failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
