import { OnboardingStep } from './onboarding.types';

export const onboardingSteps: readonly OnboardingStep[] = ['signin', 'import', 'goals', 'handle', 'about', 'topics', 'meeting', 'links'];

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

export const maxPdfBytes = 5 * 1024 * 1024;

export const customTopicLimits = { min: 2, max: 30 } as const;

export const placeholderFaceHandle = 'kubequest';

export const minImportTextChars = 40;

export const importListLabels = { skills: 'Skills', offers: 'I can help with', asks: 'I am looking for' } as const;

export const importRefineDelayMs = 5000;
