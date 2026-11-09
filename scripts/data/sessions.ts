import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { trackCatalog } from '../../app/src/types/kubequest.constants';
import type { IGeoPoint, IStoredQuiz, ITalk } from '../../app/src/types/kubequest.interfaces';
import type { SessionType, Track } from '../../app/src/types/kubequest.types';

export interface ISessionSeed extends ITalk {
  sample: boolean;
  searchText: string;
  transcript?: string;
  quiz?: IStoredQuiz;
  bossQuiz?: IStoredQuiz;
}

interface IRoomRef {
  building: string;
  level: string;
  room: string;
  geo?: IGeoPoint;
  locationId?: string;
}

interface ISessionRow {
  id: string;
  title: string;
  abstract: string;
  sessionType: SessionType;
  track: Track;
  speakers: string[];
  companies?: Record<string, string>;
  day?: string;
  start: string;
  end: string;
  room: IRoomRef;
  isBoss?: boolean;
  sample?: boolean;
  transcriptFile?: string;
}

const repoRoot = path.resolve(__dirname, '..', '..');
const resourcesDir = path.join(repoRoot, 'resources');
const scheduleUrl = 'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/';
const conferenceDay = '2026-11-10';
const hackathonDay = '2026-11-09';
const mountainOffset = '-07:00';
const quizCreatedAt = '2026-11-09T09:00:00-07:00';

const saltPalaceGeo: IGeoPoint = { lat: 40.7665, lon: -111.8945 };
const hyattGeo: IGeoPoint = { lat: 40.7683, lon: -111.8962 };

export const SALT_PALACE = 'Salt Palace';
export const HYATT_REGENCY = 'Hyatt Regency';
export const HACKATHON_LOCATION_ID = 'cloud-native-hackathon';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function locationIdFor(room: IRoomRef): string {
  return room.locationId ?? slugify(`${room.building} ${room.level} ${room.room}`);
}

function saltPalace(level: number, room: string): IRoomRef {
  return { building: SALT_PALACE, level: `Level ${level}`, room, geo: saltPalaceGeo };
}

function hyatt(level: number, room: string): IRoomRef {
  return { building: HYATT_REGENCY, level: `Level ${level}`, room, geo: hyattGeo };
}

const hallDe = saltPalace(1, 'Hall DE');
const ballroomAce = saltPalace(1, 'Grand Ballroom ACE');
const ballroomBdf = saltPalace(1, 'Grand Ballroom BDF');
const ballroomH = saltPalace(1, 'Grand Ballroom H');
const ballroomGi = saltPalace(1, 'Grand Ballroom GI');
const room151 = saltPalace(1, '151');
const room255Bc = saltPalace(2, '255 BC');
const room255Ef = saltPalace(2, '255 EF');
const room250Ac = saltPalace(2, '250 A-C');
const saltLakeDe = hyatt(2, 'Salt Lake Ballroom DE');
const saltLakeC = hyatt(2, 'Salt Lake Ballroom C');
const regencyA = hyatt(4, 'Regency Ballroom A');
const regencyCd = hyatt(4, 'Regency Ballroom CD');
const hackathonRoom: IRoomRef = { building: SALT_PALACE, level: 'Level 2', room: 'Cloud Native Hackathon', locationId: HACKATHON_LOCATION_ID };

export const sessionRooms: IRoomRef[] = [
  hallDe,
  ballroomAce,
  ballroomBdf,
  ballroomH,
  ballroomGi,
  room151,
  room255Bc,
  room255Ef,
  room250Ac,
  saltLakeDe,
  saltLakeC,
  regencyA,
  regencyCd,
  hackathonRoom,
];

const rows: ISessionRow[] = [
  {
    id: 'cnh-kickoff-2026',
    title: 'Cloud Native Hackathon Kickoff: Make Conferences Easier',
    abstract:
      'The kickoff for the WeMakeDevs Cloud Native Hackathon in Salt Lake City. The challenge is to make a huge conference like KubeCon easier to navigate: find the right talk, find the right people and actually meet them. Every team ships to its own Kubernetes cluster through GitOps, within a fixed resource budget, using sponsor technology from Elastic (search and AI on Elasticsearch), Dash0 (OpenTelemetry observability), Radar (cluster visibility and an MCP server for agents) and Gitar and Sonar (code review and quality).',
    sessionType: 'keynote',
    track: 'other',
    speakers: ['Cloud Native Hackathon organizers'],
    day: hackathonDay,
    start: '10:00',
    end: '11:00',
    room: hackathonRoom,
    isBoss: true,
    sample: true,
    transcriptFile: 'kickoff.md',
  },
  {
    id: 'cnh-demo-boss-2026',
    title: 'KubeQuest live: beat the kickoff boss',
    abstract:
      'The kickoff boss stays open all afternoon in the Cloud Native Hackathon room. Check in here, take the kickoff quiz, then team up with everyone in the room to beat the boss: questions on Elastic hybrid search, the team resource budget, Radar MCP and code review with Gitar and Sonar.',
    sessionType: 'keynote',
    track: 'other',
    speakers: ['Cloud Native Hackathon organizers'],
    day: hackathonDay,
    start: '13:00',
    end: '18:30',
    room: hackathonRoom,
    isBoss: true,
    sample: true,
    transcriptFile: 'kickoff.md',
  },
  {
    id: 'kc26-tue-keynote-welcome',
    title: 'Welcome + Opening Remarks',
    abstract: 'The opening keynote of KubeCon + CloudNativeCon North America 2026: welcome, community news and the state of cloud native from the CNCF and the Linux Foundation.',
    sessionType: 'keynote',
    track: 'other',
    speakers: ['Jonathan Bryce', 'Chris Aniszczyk', 'Robert Nishihara', 'Rita Zhang', 'Kevin Cochrane', 'Bassam Tabbara'],
    start: '09:00',
    end: '09:31',
    room: hallDe,
    isBoss: true,
  },
  {
    id: 'kc26-tue-keynote-agent-substrate',
    title: 'Agent Substrate: Open Layers for Agentic Systems',
    abstract: 'A keynote on the open layers that agentic AI systems need underneath them, and how Kubernetes and cloud native projects can become the substrate that agents run on.',
    sessionType: 'keynote',
    track: 'ai',
    speakers: ['Jaana Dogan', 'Dmitry Berkovich', 'Tim Hockin', 'Eitan Yarmush', 'Luiz Scheidegger'],
    start: '09:33',
    end: '09:40',
    room: hallDe,
    isBoss: true,
  },
  {
    id: 'kc26-tue-keynote-openrl',
    title: 'Pods in the Wild: Reinforcement Learning on Kubernetes with OpenRL',
    abstract: 'A keynote on running reinforcement learning workloads on Kubernetes with OpenRL, from rollout pods to training loops.',
    sessionType: 'keynote',
    track: 'ai',
    speakers: ['Sunil Arora', 'Ravin Kumar'],
    start: '10:05',
    end: '10:13',
    room: hallDe,
    isBoss: true,
  },
  {
    id: 'kc26-tue-keynote-identity-crisis',
    title: 'The Identity Crisis: Who is the AI Agent in Your Cluster?',
    abstract: 'A keynote on workload identity for AI agents: how a cluster knows which agent is acting, on whose behalf, and with what permissions.',
    sessionType: 'keynote',
    track: 'security',
    speakers: ['Abdel Sghiouar'],
    start: '10:29',
    end: '10:39',
    room: hallDe,
    isBoss: true,
  },
  {
    id: 'kc26-tue-keynote-physical-ai',
    title: 'From Pod to Actuator: Physical AI and the Future of Kubernetes',
    abstract: 'A keynote on physical AI, robots and edge devices, and what Kubernetes must become to orchestrate workloads that move things in the real world.',
    sessionType: 'keynote',
    track: 'ai',
    speakers: ['Abhilash Somasamudramath'],
    start: '10:41',
    end: '10:46',
    room: hallDe,
    isBoss: true,
  },
  {
    id: 'kc26-tue-saturated-by-design',
    title: 'Saturated by Design: Maximizing Cluster Allocation in On-Premises Kubernetes',
    abstract: 'How The Trade Desk scales workloads to fit on-premises clusters using custom scheduler plugins, pushing allocation up without starving critical services.',
    sessionType: 'breakout',
    track: 'operations',
    speakers: ['Dakota Sullivan', 'Isaac Wilson'],
    companies: { 'Dakota Sullivan': 'The Trade Desk', 'Isaac Wilson': 'The Trade Desk' },
    start: '11:30',
    end: '12:00',
    room: ballroomAce,
  },
  {
    id: 'kc26-tue-student-soc',
    title: 'Securing Rural Colorado with Open Source: Student-Led SOC on Kubernetes',
    abstract: 'Building a student-run security operations center on a multi-cluster Kubernetes platform to protect rural Colorado organizations with open source tools.',
    sessionType: 'breakout',
    track: 'other',
    speakers: ['Maciej Wal'],
    start: '11:30',
    end: '12:00',
    room: ballroomBdf,
  },
  {
    id: 'kc26-tue-ask-your-platform',
    title: 'Ask Your Platform: Putting AI to Work Where the Questions Live',
    abstract: 'Applying AI to the common questions platform teams answer every day, with no AI background needed.',
    sessionType: 'breakout',
    track: 'ai',
    speakers: ['Anton Alexander', 'Scott Adams'],
    start: '11:30',
    end: '12:00',
    room: ballroomH,
  },
  {
    id: 'kc26-tue-already-have-a-platform',
    title: 'So You Want to Build a Platform? You Probably Already Have One',
    abstract: 'Turning fragmented existing tooling into a productized internal developer platform instead of starting from scratch.',
    sessionType: 'breakout',
    track: 'platform',
    speakers: ['Juho Syrjänen'],
    start: '11:30',
    end: '12:00',
    room: ballroomGi,
  },
  {
    id: 'kc26-tue-data-platform-panel',
    title: 'Why We Bet the Data Platform on Kubernetes',
    abstract: 'A panel on running large-scale data platforms on Kubernetes and how AI agents are changing day-2 operations for data teams.',
    sessionType: 'panel',
    track: 'data',
    speakers: ['Vara Bonthu', 'Ying Xiong', 'Rainie Li', 'Damon Cortesi', 'Padma Aradhyula'],
    start: '11:30',
    end: '12:00',
    room: room151,
  },
  {
    id: 'kc26-tue-agent-needs-a-platform',
    title: 'Your Agent Needs a Platform: Cloud Native Infrastructure for Multi-Agent AI Systems',
    abstract: 'Modeling AI agents as Kubernetes custom resources, with Dapr for workflows, NATS for messaging and OpenTelemetry for tracing agent conversations.',
    sessionType: 'breakout',
    track: 'ai',
    speakers: ['Soham Ghadge'],
    start: '11:30',
    end: '12:00',
    room: room255Bc,
  },
  {
    id: 'kc26-tue-gateway-high-and-dry',
    title: 'Will Your Gateway Leave You High and Dry?',
    abstract: 'Benchmarks of Gateway API controllers under production-like route churn and load, and what the results mean when choosing one.',
    sessionType: 'breakout',
    track: 'connectivity',
    speakers: ['John Howard', 'Mitch Connors'],
    start: '11:30',
    end: '12:00',
    room: room255Ef,
  },
  {
    id: 'kc26-tue-vulnerability-tsunami',
    title: 'Mythos vs Maintainers: Drowning in the Vulnerability Tsunami',
    abstract: 'Offensive and defensive perspectives on the flood of AI-driven vulnerability reports and what it does to open source maintainers.',
    sessionType: 'breakout',
    track: 'security',
    speakers: ['Fabian Kammel', 'John Kjell'],
    start: '11:30',
    end: '12:00',
    room: saltLakeDe,
  },
  {
    id: 'kc26-tue-portable-gpu-config',
    title: 'One Recipe, Five Clouds, One Query: Portable GPU Configuration',
    abstract: 'Generating portable GPU Helm bundles for multiple clouds, with a queryable audit layer that shows what was configured where.',
    sessionType: 'breakout',
    track: 'platform',
    speakers: ['Christopher Haar', 'Yuan Chen'],
    start: '11:30',
    end: '12:00',
    room: saltLakeC,
  },
  {
    id: 'kc26-tue-autoscaling-reality-check',
    title: 'Autoscaling Reality Check: The Hands-On HTTP Optimization Challenge',
    abstract: 'A hands-on tutorial in benchmark rounds: tune pod-level autoscaling for an HTTP app and see which settings actually hold up under load.',
    sessionType: 'tutorial',
    track: 'operations',
    speakers: ['David Pech'],
    start: '11:30',
    end: '12:50',
    room: regencyA,
  },
  {
    id: 'kc26-tue-surviving-the-churn',
    title: 'Surviving the Churn: Read Replicas and Controllers for Busy Clusters',
    abstract: 'Offloading LIST and WATCH traffic from the Kubernetes API server with in-cluster read replicas so busy controllers stop hurting the control plane.',
    sessionType: 'breakout',
    track: 'operations',
    speakers: ['Ryan Brewster'],
    start: '12:20',
    end: '12:50',
    room: ballroomAce,
  },
  {
    id: 'kc26-tue-cache-aware-inference',
    title: "What the Docs Don't Tell You: A Telecom's Year Operating Cache-Aware LLM Inference",
    abstract: 'Production lessons from a year of running cache-aware inference routing for large language models at a telecom.',
    sessionType: 'breakout',
    track: 'ai',
    speakers: ['YoungJoon Jeong', 'Seol Heo'],
    start: '12:20',
    end: '12:50',
    room: ballroomH,
  },
  {
    id: 'kc26-tue-testing-cncf-stack',
    title: 'When Infrastructure Breaks in Production: Testing the Full CNCF Stack',
    abstract: 'Testing CNCF add-ons inside the cluster with Testkube, wired into Flux GitOps, so platform upgrades are verified before they break production.',
    sessionType: 'breakout',
    track: 'platform',
    speakers: ['Priya Namasivayam'],
    start: '12:20',
    end: '12:50',
    room: ballroomGi,
  },
  {
    id: 'kc26-tue-signed-sealed-denied',
    title: 'Signed, Sealed, Denied: Attestation-Driven Admission with Kyverno + CEL',
    abstract: 'Enforcing image attestation policies at admission time with Kyverno and CEL, leaving an auditable evidence trail for every decision.',
    sessionType: 'breakout',
    track: 'security',
    speakers: ['Chad Swenson', 'Sagar Kundral'],
    start: '12:20',
    end: '12:50',
    room: room151,
  },
  {
    id: 'kc26-tue-air-gapped-nodes',
    title: 'No Network? No Problem: Kubernetes Nodes in Air-Gapped VPCs',
    abstract: "Replacing Konnectivity's gRPC link with cloud object storage so Kubernetes nodes can run in VPCs with zero egress.",
    sessionType: 'breakout',
    track: 'connectivity',
    speakers: ['Shachar Tal'],
    start: '12:20',
    end: '12:50',
    room: room255Ef,
  },
  {
    id: 'kc26-tue-intent-driven-idps',
    title: 'Platform Engineering after the AI Hype: Why IDPs Must Become Intent-Driven',
    abstract: 'Evolving internal developer platforms toward intent-driven capabilities that serve both humans and AI agents.',
    sessionType: 'breakout',
    track: 'platform',
    speakers: ['Daniel Bryant'],
    start: '12:20',
    end: '12:50',
    room: saltLakeC,
  },
  {
    id: 'kc26-tue-kserve-production-llms',
    title: 'Beyond Model Serving: Running Production LLMs on Kubernetes with KServe',
    abstract: 'Scheduling, routing and autoscaling large language model workloads in production with KServe.',
    sessionType: 'breakout',
    track: 'ai',
    speakers: ['Johnu George', 'Jooho Lee'],
    start: '12:20',
    end: '12:50',
    room: room250Ac,
  },
  {
    id: 'kc26-tue-tracing-at-scale',
    title: 'Tracing at Scale: Running a 16 Billion Spans/Hour Pipeline at Nubank',
    abstract: 'Building and operating a petabyte-scale tracing pipeline on the OpenTelemetry Collector at Nubank, at 16 billion spans per hour.',
    sessionType: 'breakout',
    track: 'operations',
    speakers: ['Felipe Araujo', 'Kaynan Coelho'],
    companies: { 'Felipe Araujo': 'Nubank', 'Kaynan Coelho': 'Nubank' },
    start: '14:50',
    end: '15:20',
    room: ballroomAce,
  },
  {
    id: 'kc26-tue-operator-confused-deputy',
    title: 'The Operator Calls Are Coming from Inside the Namespace',
    abstract: 'Confused-deputy flaws in Kubernetes operators that let namespace users escalate all the way to cloud admin, and how to close them.',
    sessionType: 'breakout',
    track: 'security',
    speakers: ["Justin O'Leary"],
    start: '14:50',
    end: '15:20',
    room: room151,
  },
  {
    id: 'kc26-tue-feeding-the-gpu',
    title: 'Feeding the GPU: Streaming Data into Training, Lakehouse, and Serving',
    abstract: 'Moving columnar data once over Arrow Flight to GPUs, lakehouse tables and serving systems instead of copying it for each.',
    sessionType: 'breakout',
    track: 'data',
    speakers: ['Dheeraj Kapur', 'Deepak Choudhary'],
    start: '14:50',
    end: '15:20',
    room: regencyCd,
  },
];

function isoAt(day: string, hhmm: string): string {
  return `${day}T${hhmm}:00${mountainOffset}`;
}

function readTranscript(file: string): string {
  return readFileSync(path.join(resourcesDir, 'transcripts', file), 'utf8');
}

const kickoffQuiz: IStoredQuiz = {
  talkId: 'cnh-kickoff-2026',
  source: 'transcript',
  generatedBy: 'fallback',
  createdAt: quizCreatedAt,
  questions: [
    {
      id: 'q1',
      prompt: 'What challenge did the kickoff set for teams?',
      choices: ['Make conferences easier to navigate', 'Build the fastest Kubernetes scheduler', 'Replace YAML with a new language', 'Port a game to WebAssembly'],
      answerIndex: 0,
      explanation: 'Teams build something that helps attendees find the right talks and people and actually meet them.',
    },
    {
      id: 'q2',
      prompt: 'How does each team deploy to its cluster?',
      choices: ['kubectl apply from a laptop', 'GitOps: push to main and Argo CD syncs', 'Uploading a zip to a web form', 'SSH into the nodes'],
      answerIndex: 1,
      explanation: 'Pushing to main is the deploy; Argo CD syncs the team namespace.',
    },
    {
      id: 'q3',
      prompt: 'Which sponsor provides OpenTelemetry-based observability?',
      choices: ['Elastic', 'Radar', 'Dash0', 'Gitar'],
      answerIndex: 2,
      explanation: 'Dash0 receives traces, metrics and logs over OTLP.',
    },
  ],
};

const kickoffBossQuiz: IStoredQuiz = {
  talkId: 'cnh-kickoff-2026',
  source: 'transcript',
  generatedBy: 'fallback',
  createdAt: quizCreatedAt,
  questions: [
    {
      id: 'b1',
      prompt: 'Which Elasticsearch field type gives semantic search with Jina embeddings?',
      choices: ['keyword', 'semantic_text', 'geo_point', 'flattened'],
      answerIndex: 1,
      explanation: 'semantic_text embeds text at index time through an inference endpoint.',
    },
    {
      id: 'b2',
      prompt: 'What does RRF do in an Elasticsearch hybrid search?',
      choices: ['Compresses the index', 'Fuses keyword and vector rankings into one list', 'Replicates shards', 'Rate-limits queries'],
      answerIndex: 1,
      explanation: 'Reciprocal rank fusion merges the rankings of several retrievers.',
    },
    {
      id: 'b3',
      prompt: 'What happens to a pod that goes over the team resource budget?',
      choices: ['It runs on a bigger node', 'It is billed extra', 'It stays Pending', 'It restarts every minute'],
      answerIndex: 2,
      explanation: 'The quota refuses it, so it stays Pending with an exceeded quota event.',
    },
    {
      id: 'b4',
      prompt: 'What does Radar expose so coding agents can operate the cluster?',
      choices: ['An MCP server', 'A root SSH key', 'A public kubeconfig', 'A Slack bot only'],
      answerIndex: 0,
      explanation: "Radar Cloud's MCP server lets agents observe and change the team's cluster.",
    },
    {
      id: 'b5',
      prompt: 'What do Gitar and Sonar bring to the hackathon?',
      choices: ['GPU credits', 'Venue Wi-Fi', 'Code review and code quality on pull requests', 'Conference badges'],
      answerIndex: 2,
      explanation: 'They review every pull request against team-defined rules.',
    },
  ],
};

function quizFor(talkId: string, quiz: IStoredQuiz): IStoredQuiz {
  return { ...quiz, talkId };
}

const storedQuizzes: Record<string, { quiz: IStoredQuiz; bossQuiz?: IStoredQuiz }> = {
  'cnh-kickoff-2026': { quiz: kickoffQuiz, bossQuiz: kickoffBossQuiz },
  'cnh-demo-boss-2026': { quiz: quizFor('cnh-demo-boss-2026', kickoffQuiz), bossQuiz: quizFor('cnh-demo-boss-2026', kickoffBossQuiz) },
};

function toSession(row: ISessionRow): ISessionSeed {
  const track = trackCatalog[row.track];
  const day = row.day ?? conferenceDay;
  const transcript = row.transcriptFile ? readTranscript(row.transcriptFile) : undefined;
  const stored = storedQuizzes[row.id];
  const session: ISessionSeed = {
    id: row.id,
    title: row.title,
    abstract: row.abstract,
    sessionType: row.sessionType,
    track: row.track,
    material: track.material,
    speakers: row.speakers,
    speakerDetails: row.speakers.map((name) => {
      const company = row.companies?.[name];
      return company ? { name, company } : { name };
    }),
    start: isoAt(day, row.start),
    end: isoAt(day, row.end),
    locationId: locationIdFor(row.room),
    building: row.room.building,
    level: row.room.level,
    room: row.room.room,
    isBoss: row.isBoss ?? false,
    hasTranscript: transcript !== undefined,
    url: scheduleUrl,
    sample: row.sample ?? false,
    searchText: [row.title, row.abstract, row.speakers.join(', '), track.label, row.room.room, row.room.building].join('\n'),
  };

  if (row.room.geo) {
    session.geo = row.room.geo;
  }

  if (transcript) {
    session.transcript = transcript;
  }

  if (stored) {
    session.quiz = stored.quiz;

    if (stored.bossQuiz) {
      session.bossQuiz = stored.bossQuiz;
    }
  }

  return session;
}

export function buildSessions(): ISessionSeed[] {
  return rows.map(toSession);
}

function main(): void {
  const sessions = buildSessions();
  const ids = new Set(sessions.map((session) => session.id));

  if (ids.size !== sessions.length) {
    throw new Error('duplicate session ids');
  }

  mkdirSync(resourcesDir, { recursive: true });
  writeFileSync(path.join(resourcesDir, 'sessions.json'), `${JSON.stringify(sessions, null, 2)}\n`);

  const locationIds = [...new Set(sessions.map((session) => session.locationId))].sort();
  console.log(`wrote ${sessions.length} sessions to resources/sessions.json`);
  console.log(`locationIds: ${locationIds.join(', ')}`);
}

if (require.main === module) {
  main();
}
