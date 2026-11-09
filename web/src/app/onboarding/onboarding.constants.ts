import { OnboardingStep } from './onboarding.types';

export const onboardingSteps: readonly OnboardingStep[] = ['signin', 'handle', 'about', 'topics', 'meeting'];

export const maxTopics = 5;

export const demoAccount = { name: 'John Doe', email: 'johndoe@gmail.com' } as const;

export const handlePattern = /^[a-z0-9_.-]{3,20}$/;

export const topicOptions: readonly string[] = [
  'AI inference',
  'Agents',
  'Platform engineering',
  'GitOps',
  'Observability',
  'Performance and cost',
  'Data and storage',
  'Security',
  'Networking',
  'Community and inclusion',
  'Kubernetes core',
  'WebAssembly',
];
