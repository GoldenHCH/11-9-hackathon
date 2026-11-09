import type { Material } from './engine/iso';

export const DAY_WITHOUT = [
  { time: '9:00', text: 'Keynote. Sat at the back and answered email.' },
  { time: '11:00', text: 'Meant to see the Argo CD talk. Couldn’t find Room 255 BC in time.' },
  { time: '12:30', text: 'Lunch alone, scrolling a schedule of 600 sessions.' },
  { time: '15:30', text: 'Walked past the one person fixing your exact bug.' },
  { time: '17:30', text: 'Left knowing nobody new.' },
];

export const DAY_WITH: { time: string; text: string; xp: string; m?: Material }[] = [
  { time: '9:00', text: 'Scanned the QR block at the Hall DE door for the keynote.', xp: '+10', m: 'stone' },
  { time: '9:40', text: 'Three questions on the keynote. Got all three.', xp: '+15' },
  { time: '11:00', text: 'Quest: “Tracing Argo CD syncs” in Room 255 BC, a 4 minute walk.', xp: '+10', m: 'glass' },
  { time: '11:40', text: 'Three more questions, this time on the tracing talk.', xp: '+15' },
  { time: '15:30', text: 'Hallway matched you with @quietgopher. You met at the Community Hub.', xp: '+50', m: 'gem' },
  { time: '17:30', text: 'Reached Deployment, level 2. Node is tomorrow’s quest.', xp: 'Lvl 2' },
];

export const LOOP_STEPS: { title: string; text: string; m: Material }[] = [
  { title: 'Join', text: 'Scan any KubeQuest code. Pick a handle, answer two questions, get a pixel face and your first quest. No password.', m: 'wood' },
  { title: 'Check in', text: 'Scan the QR block at a room’s door. 10 XP and a block in the track’s material.', m: 'stone' },
  { title: 'Prove you listened', text: 'Three plain-text questions from the talk you just sat through. No timer. 5 XP each.', m: 'circuit' },
  { title: 'Meet someone', text: 'Hallway finds a player working on the same thing and picks a campfire near you both.', m: 'ember' },
  { title: 'Level up', text: 'XP moves you from Pod to Control Plane. Sets of blocks earn banners.', m: 'kube' },
];

export const LEVEL_INFO = [
  { name: 'Pod', text: 'You scanned your first room. One block in the inventory.' },
  { name: 'Deployment', text: 'A few talks, a quiz streak, and a block from more than one track.' },
  { name: 'Node', text: 'You’ve met people through Hallway, not just walked past them.' },
  { name: 'Cluster', text: 'You show up, listen and meet, all day long.' },
  { name: 'Control Plane', text: 'The top of the board. Everyone at the after-party knows your face.' },
];

export const BOARD = [
  { handle: 'quietgopher', xp: 415, banners: ['Connector', 'Observability Nerd'] },
  { handle: 'kelpie', xp: 380, banners: ['Welcomer'] },
  { handle: 'byte-otter', xp: 345, banners: ['Observability Nerd'] },
  { handle: 'tinfoil-hat', xp: 290, banners: [] },
  { handle: 'you', xp: 115, banners: [] },
];

export const TRACE = [
  { name: 'GET /r/hall-de', service: 'browser', start: 0, dur: 100, depth: 0 },
  { name: 'POST /api/tools/check_in', service: 'kubequest-api', start: 6, dur: 88, depth: 1 },
  { name: 'verify signed token', service: 'kubequest-api', start: 8, dur: 6, depth: 2 },
  { name: 'elasticsearch index xp_events', service: 'elasticsearch', start: 16, dur: 38, depth: 2 },
  { name: 'elasticsearch update attendees', service: 'elasticsearch', start: 56, dur: 30, depth: 2 },
];

export const ACCESS = [
  { title: 'No timers', text: 'Quizzes and talk transcripts are plain text. Take as long as you need.' },
  { title: 'Quests without walking', text: 'Quiz-only quests earn XP from a seat, for anyone who can’t cross two buildings.' },
  { title: 'Never color alone', text: 'Every track block has its own pattern and name, and every banner has a label.' },
  { title: 'You choose who sees you', text: 'Public views show your handle and pixel face. Your photo goes only to a confirmed meet partner.' },
  { title: 'Both say yes first', text: 'The other person learns nothing about a meet request until you both accept.' },
  { title: 'First time here?', text: 'Say so at signup and Hallway pairs you with players who offered to welcome newcomers.' },
];
