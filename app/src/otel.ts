import { appConfig } from './config';
import { Attributes } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LogRecordProcessor } from '@opentelemetry/sdk-logs';
import { IMetricReader, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor, NoopSpanProcessor, SpanProcessor } from '@opentelemetry/sdk-trace';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_K8S_DEPLOYMENT_NAME,
  ATTR_K8S_NAMESPACE_NAME,
  ATTR_K8S_NODE_NAME,
  ATTR_K8S_POD_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const metricExportIntervalMs = 15000;

const redactedServerQueryParams = ['sig', 'Signature', 'AWSAccessKeyId', 'X-Goog-Signature', 'k', 't'];

function buildResourceAttributes(): Attributes {
  const attributes: Attributes = {
    [ATTR_SERVICE_NAME]: appConfig.serviceName,
    [ATTR_SERVICE_VERSION]: appConfig.appVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: appConfig.telemetry.deploymentEnvironment,
    'kubequest.team': appConfig.teamName,
  };
  const kubernetesAttributes: Record<string, string> = {
    [ATTR_K8S_POD_NAME]: appConfig.kubernetes.podName,
    [ATTR_K8S_NAMESPACE_NAME]: appConfig.kubernetes.namespaceName,
    [ATTR_K8S_NODE_NAME]: appConfig.kubernetes.nodeName,
    [ATTR_K8S_DEPLOYMENT_NAME]: appConfig.kubernetes.deploymentName,
  };

  for (const [key, value] of Object.entries(kubernetesAttributes)) {
    if (value) {
      attributes[key] = value;
    }
  }

  return attributes;
}

const exportEnabled = appConfig.telemetry.otlpEndpoint !== '';

const spanProcessors: SpanProcessor[] = exportEnabled ? [new BatchSpanProcessor({ exporter: new OTLPTraceExporter() })] : [new NoopSpanProcessor()];

const metricReaders: IMetricReader[] = exportEnabled
  ? [new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter(), exportIntervalMillis: metricExportIntervalMs })]
  : [];

const logRecordProcessors: LogRecordProcessor[] = exportEnabled ? [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() })] : [];

export const telemetrySdk = new NodeSDK({
  resource: resourceFromAttributes(buildResourceAttributes()),
  spanProcessors,
  metricReaders,
  logRecordProcessors,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-pino': { disableLogCorrelation: true, disableLogSending: !exportEnabled },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (request) => request.url === '/healthz' || request.url === '/readyz',
        redactedQueryParamsServer: redactedServerQueryParams,
      },
    }),
  ],
});

telemetrySdk.start();

export async function shutdownTelemetry(): Promise<void> {
  await telemetrySdk.shutdown();
}
