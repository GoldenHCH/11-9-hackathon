import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { recapSubject, renderRecapEmail } from '../app/src/recap/recap-email';
import { RecapContent } from '../app/src/recap/recap.types';
import { IRecap } from '../app/src/types/kubequest.interfaces';

const repoRoot = path.resolve(__dirname, '..');
const emailFile = path.join(repoRoot, 'docs', 'mock', 'recap-email.html');
const fixtureFile = path.join(repoRoot, 'resources', 'fixtures', 'recap.json');

const mockRecap: RecapContent = {
  player: {
    id: 'pl_4451cf61b8914498',
    handle: 'quietgopher',
    faceSeed: 'quietgopher',
    level: 4,
    levelName: 'Cluster',
    xp: 515,
    banners: ['connector', 'scout', 'observability-nerd'],
  },
  generatedAt: '2026-11-12T23:30:00.000Z',
  totals: { xp: 515, talks: 4, people: 3, booths: 3, quizCorrect: 10 },
  talks: [
    {
      talkId: 'kc26-tue-saturated-by-design',
      title: 'Saturated by Design: Maximizing Cluster Allocation in On-Premises Kubernetes',
      room: 'Grand Ballroom ACE',
      at: '2026-11-10T18:33:12.000Z',
      quizCorrect: 3,
      quizTotal: 3,
    },
    {
      talkId: 'kc26-tue-cache-aware-inference',
      title: "What the Docs Don't Tell You: A Telecom's Year Operating Cache-Aware LLM Inference",
      room: 'Grand Ballroom H',
      at: '2026-11-10T19:22:40.000Z',
      quizCorrect: 2,
      quizTotal: 3,
    },
    {
      talkId: 'kc26-tue-tracing-at-scale',
      title: 'Tracing at Scale: Running a 16 Billion Spans/Hour Pipeline at Nubank',
      room: 'Grand Ballroom ACE',
      at: '2026-11-10T21:52:05.000Z',
      quizCorrect: 3,
      quizTotal: 3,
    },
    {
      talkId: 'kc26-tue-signed-sealed-denied',
      title: 'Signed, Sealed, Denied: Attestation-Driven Admission with Kyverno + CEL',
      room: '151',
      at: '2026-11-10T19:24:18.000Z',
      quizCorrect: 2,
      quizTotal: 3,
    },
  ],
  people: [
    {
      playerId: 'pl_592a78e076ad8c1f',
      handle: 'podwrangler',
      faceSeed: 'podwrangler',
      metAt: '2026-11-10T20:05:31.000Z',
      question: 'You both work on gpus. Ask @podwrangler: which gpus tool do they reach for first?',
      theirAnswer: 'Kueue',
      sharedTopics: ['gpus', 'autoscaling'],
      githubLogin: 'podwrangler-dev',
      nextStep: 'Follow up with @podwrangler about gpus.',
    },
    {
      playerId: 'pl_aeea8bd684c45f90',
      handle: 'otelotter',
      faceSeed: 'otelotter',
      metAt: '2026-11-10T22:41:09.000Z',
      question: 'Ask @otelotter: which booth has been their favorite so far?',
      theirAnswer: 'Dash0',
      sharedTopics: ['opentelemetry'],
      nextStep: 'Follow up with @otelotter about opentelemetry.',
    },
    {
      playerId: 'pl_0c1d9e7f22ab4c63',
      handle: 'helmhiker',
      faceSeed: 'helmhiker',
      metAt: '2026-11-11T16:18:44.000Z',
      question: '@helmhiker asked you: Which talk would you tell someone not to miss?',
      theirAnswer: 'tracing at scale',
      sharedTopics: [],
      nextStep: 'Ask @helmhiker how tracing at scale is going for them.',
    },
  ],
  booths: [
    {
      locationId: 'outpost-elastic',
      name: 'Elastic',
      boothNumber: '196',
      liked: 'Hybrid search with semantic_text: one field, embeddings handled for me, RRF with BM25 in a single query.',
      thoughts: 'Could replace our separate vector DB for the internal docs bot.',
      followUp: true,
      nextStep: 'Book a follow-up with Elastic.',
    },
    {
      locationId: 'outpost-dash0',
      name: 'Dash0',
      boothNumber: '134',
      liked: 'Clicked from a slow span straight into the pod logs and the Kubernetes events behind it.',
      followUp: false,
      nextStep: 'Try what you liked at Dash0: Clicked from a slow span straight into the pod logs and the…',
    },
    {
      locationId: 'outpost-datadog',
      name: 'Datadog',
      boothNumber: '152',
      liked: 'Cost per namespace sitting right next to CPU throttling on one dashboard.',
      thoughts: 'Worth showing the platform team before budget planning.',
      followUp: true,
      nextStep: 'Book a follow-up with Datadog.',
    },
  ],
  nextSteps: [
    'Book a follow-up with Elastic.',
    'Book a follow-up with Datadog.',
    'Follow up with @podwrangler about gpus.',
    'Follow up with @otelotter about opentelemetry.',
    'Ask @helmhiker how tracing at scale is going for them.',
    `Rewatch "What the Docs Don't Tell You: A Telecom's Year Operating Cache-Aware LLM Inference" when the recording goes up.`,
  ],
};

function main(): void {
  const recap: IRecap = { ...mockRecap, emailSubject: recapSubject(mockRecap), emailHtml: renderRecapEmail(mockRecap) };
  mkdirSync(path.dirname(emailFile), { recursive: true });
  writeFileSync(emailFile, recap.emailHtml);
  console.log(`recap mock: wrote ${path.relative(repoRoot, emailFile)}`);

  const fixture = {
    tool: 'recap',
    endpoint: 'POST /api/tools/recap',
    request: { attendeeId: 'p_Ljp4ZfHC-VPDFwqx' },
    status: 200,
    response: recap,
  };
  writeFileSync(fixtureFile, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`recap mock: wrote ${path.relative(repoRoot, fixtureFile)}`);
}

main();
