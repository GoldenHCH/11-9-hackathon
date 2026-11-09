import { Track } from '../types/kubequest.types';

export interface ITopicRule {
  topic: string;
  track: Track;
  keywords: string[];
}

export const topicRules: ITopicRule[] = [
  { topic: 'AI inference', track: 'ai', keywords: ['inference', 'llm', 'model serving', 'vllm', 'kserve', 'gpu', 'ai', 'ml', 'machine learning'] },
  { topic: 'Agents', track: 'ai', keywords: ['agent', 'agentic', 'mcp', 'rag', 'copilot'] },
  { topic: 'Platform engineering', track: 'platform', keywords: ['platform', 'internal developer', 'idp', 'backstage', 'golden path', 'developer experience'] },
  { topic: 'GitOps', track: 'platform', keywords: ['gitops', 'argo', 'flux', 'helm', 'kustomize', 'ci/cd', 'cicd', 'pipeline'] },
  { topic: 'Observability', track: 'operations', keywords: ['observability', 'opentelemetry', 'otel', 'tracing', 'prometheus', 'metrics', 'logging', 'grafana', 'monitoring'] },
  { topic: 'Performance and cost', track: 'operations', keywords: ['performance', 'autoscal', 'cost', 'finops', 'karpenter', 'scaling', 'sre', 'reliability'] },
  { topic: 'Data and storage', track: 'data', keywords: ['data', 'storage', 'database', 'postgres', 'kafka', 'stateful', 'backup', 'spark'] },
  { topic: 'Security', track: 'security', keywords: ['security', 'supply chain', 'sbom', 'policy', 'kyverno', 'opa', 'rbac', 'zero trust', 'falco', 'secrets'] },
  { topic: 'Networking', track: 'connectivity', keywords: ['network', 'service mesh', 'istio', 'cilium', 'ebpf', 'gateway', 'envoy', 'dns', 'ingress'] },
  { topic: 'Community and inclusion', track: 'inclusion', keywords: ['community', 'inclusion', 'accessibility', 'mentor', 'contributor', 'diversity', 'first kubecon', 'learn'] },
  { topic: 'Kubernetes core', track: 'other', keywords: ['kubernetes', 'k8s', 'operator', 'controller', 'scheduler', 'kubelet', 'crd', 'cluster'] },
  { topic: 'WebAssembly', track: 'other', keywords: ['wasm', 'webassembly', 'edge', 'serverless'] },
];

export const signupLimits = {
  HANDLE_MIN: 3,
  HANDLE_MAX: 20,
  GITHUB_TIMEOUT_MS: 4000,
  GITHUB_REPO_SAMPLE: 30,
  GITHUB_LANGUAGES: 3,
  FACE_SIZE: 8,
  OPEN_MEET_SCAN: 50,
} as const;

export const facePalettes: string[][] = [
  ['#2fb3a6', '#f2c14e', '#1d2b36', '#f5e6c8'],
  ['#d0773f', '#7cc8f2', '#22223b', '#f2e9e4'],
  ['#8a8f98', '#f5d142', '#283618', '#fefae0'],
  ['#9c6b3f', '#c9ced6', '#3d405b', '#f4f1de'],
  ['#b5793b', '#2fb3a6', '#2b2d42', '#edf2f4'],
  ['#f2c14e', '#d0773f', '#1b263b', '#e0e1dd'],
];

export const defaultSettings = {
  accessibleMode: false,
  noWalking: false,
  locationOn: true,
  language: 'en',
  hideFromLeaderboard: false,
} as const;

export const openMeetStatuses = ['proposed', 'accepted'] as const;

export const confirmedMeetStatuses = ['accepted', 'met'] as const;
