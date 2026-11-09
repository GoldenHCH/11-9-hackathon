import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({
  path: [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), '..', '.env'), path.resolve(__dirname, '..', '..', '.env')],
  quiet: true,
});

function readString(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

function readNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  if (value === undefined || value === '') {
    return fallback;
  }

  return value === 'true' || value === '1' || value === 'yes';
}

export const appConfig = {
  serviceName: readString('OTEL_SERVICE_NAME', 'kubequest-app'),
  appVersion: readString('APP_VERSION', 'dev'),
  nodeEnv: readString('NODE_ENV', 'development'),
  port: readNumber('PORT', 8080),
  logLevel: readString('LOG_LEVEL', 'info'),
  teamName: readString('TEAM_NAME', 'kube-quest'),
  publicBaseUrl: readString('PUBLIC_BASE_URL', 'https://kube-quest.cnh.radarhq.io'),
  conferenceTimeZone: readString('CONFERENCE_TZ', 'America/Denver'),
  ensureIndicesOnStart: readBoolean('ENSURE_INDICES_ON_START', true),
  elastic: {
    url: readString('ELASTIC_URL'),
    apiKey: readString('ELASTIC_API_KEY'),
    embeddingInferenceId: readString('ELASTIC_INFERENCE_ID', '.jina-embeddings-v5-text-small'),
    chatInferenceId: readString('ELASTIC_CHAT_INFERENCE_ID', '.anthropic-claude-5-sonnet-chat_completion'),
    kibanaUrl: readString('KIBANA_URL'),
    agentId: readString('ELASTIC_AGENT_ID'),
  },
  telemetry: {
    otlpEndpoint: readString('OTEL_EXPORTER_OTLP_ENDPOINT'),
    deploymentEnvironment: readString('DEPLOYMENT_ENVIRONMENT', 'hackathon'),
    traceUrlTemplate: readString('DASH0_TRACE_URL_TEMPLATE'),
    rumEndpoint: readString('DASH0_RUM_ENDPOINT'),
    rumAuthToken: readString('DASH0_RUM_AUTH_TOKEN'),
  },
  kubernetes: {
    podName: readString('K8S_POD_NAME'),
    namespaceName: readString('K8S_NAMESPACE_NAME'),
    nodeName: readString('K8S_NODE_NAME'),
    deploymentName: readString('K8S_DEPLOYMENT_NAME'),
  },
  publicDir: readString('PUBLIC_DIR', path.resolve(__dirname, '..', 'public')),
};

export function readQrSecret(): string {
  return readString('QR_SECRET');
}
