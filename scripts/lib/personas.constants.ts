import type { IPersonaSpec } from './data-scripts.interfaces';

export const platformPersonaId = 'att-demo-platform';
export const frontendPersonaId = 'att-demo-frontend';

export const personaTopics = [
  'kubernetes-upgrades',
  'platform-engineering',
  'gitops',
  'developer-experience',
  'multi-cluster',
];

export const personaSpecs: IPersonaSpec[] = [
  {
    id: platformPersonaId,
    handle: 'marta-kowalczyk-k8s',
    name: 'Marta Kowalczyk',
    headline: 'Senior platform engineer at a mid-size fintech',
    profileText:
      'I run the platform team at a mid-size fintech, and our cluster upgrades keep breaking something: last quarter a minor-version bump took out our ingress for an afternoon. I am here to learn how other teams stage upgrades across clusters without freezing releases for a week. Happy to chat with anyone new to Kubernetes, because I remember how steep the first month was.',
    topics: ['kubernetes-upgrades', 'platform-engineering', 'gitops', 'developer-experience', 'multi-cluster'],
    seniority: 'senior',
    goals: ['learn how other teams run upgrades', 'compare notes on production incidents', 'make friends in the community'],
    offers: ['upgrade rehearsal checklists', 'lessons on API deprecation tracking', 'welcoming first-timers'],
    asks: ['how teams stage upgrades across many clusters', 'tooling that catches deprecated APIs before the upgrade'],
    languages: ['English', 'German'],
    firstTimer: false,
    welcomer: true,
    createdAt: '2026-11-02T18:20:00-07:00',
  },
  {
    id: frontendPersonaId,
    handle: 'diego-alvarez-ui',
    name: 'Diego Alvarez',
    headline: 'Frontend developer at an online retailer',
    profileText:
      'Frontend developer at an online retailer, mostly Angular and TypeScript, and this is my first KubeCon. My team just moved to Kubernetes and I want to understand what happens between my pull request and a running pod. I would love to meet someone patient who deals with cluster upgrades and platform tooling day to day.',
    topics: ['kubernetes-upgrades', 'platform-engineering', 'gitops', 'developer-experience'],
    seniority: 'mid',
    goals: ['understand where the ecosystem is heading', 'find a mentor', 'learn how other teams run upgrades'],
    offers: ['onboarding flow reviews', 'frontend performance tips'],
    asks: ['what happens between a pull request and a running pod', 'how platform teams hide cluster details from application developers'],
    languages: ['English', 'Spanish'],
    firstTimer: true,
    welcomer: false,
    createdAt: '2026-11-08T21:05:00-07:00',
  },
];
