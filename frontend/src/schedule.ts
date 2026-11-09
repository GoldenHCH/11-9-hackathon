import type { Material } from './engine/iso';

export type Place = { room: string; building: 'Salt Palace' | 'Hyatt Regency'; level: number };

export type Talk = {
  id: string;
  title: string;
  track: string;
  m: Material;
  start: number;
  end: number;
  place: Place;
};

export type Slot = { id: string; start: number; end: number; talks: Talk[] };

const sp = (room: string, level: number): Place => ({ room, building: 'Salt Palace', level });
const hy = (room: string, level: number): Place => ({ room, building: 'Hyatt Regency', level });

const at = (h: number, m = 0) => h * 60 + m;

export const KEYNOTE: Talk = {
  id: 'keynote',
  title: 'Opening keynotes',
  track: 'Keynote',
  m: 'kube',
  start: at(9),
  end: at(10, 15),
  place: sp('Hall DE', 1),
};

export const SLOTS: Slot[] = [
  {
    id: 's1',
    start: at(11),
    end: at(11, 30),
    talks: [
      { id: 'argo', title: 'Tracing Argo CD syncs end to end', track: 'Operations + Performance', m: 'glass', start: at(11), end: at(11, 30), place: sp('255 BC', 2) },
      { id: 'policy', title: 'Policy as code your platform team will keep', track: 'Security', m: 'iron', start: at(11), end: at(11, 30), place: hy('Regency Ballroom B-D', 4) },
      { id: 'llm', title: 'Serving models on spot GPUs without tears', track: 'AI Inference + Agentic', m: 'circuit', start: at(11), end: at(11, 30), place: sp('151 G', 1) },
    ],
  },
  {
    id: 's2',
    start: at(11, 35),
    end: at(12, 5),
    talks: [
      { id: 'golden', title: 'Golden paths teams actually use', track: 'Platform Engineering', m: 'stone', start: at(11, 35), end: at(12, 5), place: sp('155 E', 1) },
      { id: 'ebpf', title: 'eBPF networking without the mystery', track: 'Connectivity', m: 'copper', start: at(11, 35), end: at(12, 5), place: sp('250 AD', 2) },
      { id: 'first', title: 'First KubeCon? Start here', track: 'Inclusion + Accessibility', m: 'lantern', start: at(11, 35), end: at(12, 5), place: sp('Community Hub', 1) },
    ],
  },
  {
    id: 's3',
    start: at(14),
    end: at(14, 30),
    talks: [
      { id: 'pg', title: 'Postgres on Kubernetes at ten thousand pods', track: 'Data Processing + Storage', m: 'crate', start: at(14), end: at(14, 30), place: sp('355 F', 3) },
      { id: 'a11y', title: 'On-call dashboards everyone can read', track: 'Inclusion + Accessibility', m: 'lantern', start: at(14), end: at(14, 30), place: sp('251 AB', 2) },
      { id: 'sbom', title: 'Supply chain attestations in practice', track: 'Security', m: 'iron', start: at(14), end: at(14, 30), place: hy('Regency Ballroom A', 4) },
    ],
  },
  {
    id: 's4',
    start: at(16, 15),
    end: at(16, 45),
    talks: [
      { id: 'cost', title: 'Right-sizing before the bill arrives', track: 'Operations + Performance', m: 'glass', start: at(16, 15), end: at(16, 45), place: sp('255 BC', 2) },
      { id: 'agents', title: 'Agents that call kubectl safely', track: 'AI Inference + Agentic', m: 'circuit', start: at(16, 15), end: at(16, 45), place: sp('151 G', 1) },
      { id: 'maint', title: 'Maintainers’ open Q&A', track: 'Everything else', m: 'wood', start: at(16, 15), end: at(16, 45), place: sp('Project Pavilion', 1) },
    ],
  },
];

export const DEFAULT_PICKS: Record<string, string | null> = { s1: 'argo', s2: 'golden', s3: null, s4: 'agents' };

export const walkMinutes = (a: Place, b: Place) => {
  if (a.room === b.room) return 0;
  if (a.building !== b.building) return 8;
  return a.level === b.level ? 2 : 4;
};

export const clock = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')}`;
};

const MEET = 15;
const QUIZ_XP = 15;
const CHECK_IN_XP = 10;

export type Entry =
  | { kind: 'talk'; talk: Talk }
  | { kind: 'walk'; minutes: number; from: Place; to: Place; late: number }
  | { kind: 'gap'; start: number; end: number; meet: boolean; lunch: boolean };

export const buildDay = (picks: Record<string, string | null>) => {
  const talks = [
    KEYNOTE,
    ...SLOTS.map((s) => s.talks.find((t) => t.id === picks[s.id])).filter((t): t is Talk => Boolean(t)),
  ];
  const entries: Entry[] = [];
  let meets = 0;
  let late = 0;
  talks.forEach((talk, i) => {
    entries.push({ kind: 'talk', talk });
    const next = talks[i + 1];
    if (!next) return;
    const minutes = walkMinutes(talk.place, next.place);
    const free = next.start - talk.end;
    const lateBy = Math.max(0, minutes - free);
    if (minutes > 0) entries.push({ kind: 'walk', minutes, from: talk.place, to: next.place, late: lateBy });
    if (lateBy > 0) late++;
    const open = free - minutes;
    if (open >= MEET) {
      const lunch = talk.end <= at(12, 30) && next.start >= at(13, 30);
      entries.push({ kind: 'gap', start: talk.end + minutes, end: next.start, meet: true, lunch });
      meets++;
    }
  });
  const tracks = new Set(talks.filter((t) => t.id !== 'keynote').map((t) => t.track));
  return {
    entries,
    talks: talks.length,
    tracks: tracks.size,
    xp: talks.length * (CHECK_IN_XP + QUIZ_XP),
    meets,
    late,
  };
};
