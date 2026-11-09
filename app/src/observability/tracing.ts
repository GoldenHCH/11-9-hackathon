import { Attributes, isSpanContextValid, Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { appConfig } from '../config';
import { kubequestMetrics } from './metrics';

export const tracer = trace.getTracer(appConfig.serviceName, appConfig.appVersion);

export interface ITraceIds {
  traceId?: string;
  spanId?: string;
}

export function currentTraceIds(): ITraceIds {
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (!spanContext || !isSpanContextValid(spanContext)) {
    return {};
  }

  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}

function errorStatusCode(error: unknown): number {
  if (typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number') {
    return error.status;
  }

  return 500;
}

export async function withToolSpan<T>(toolName: string, attributes: Attributes, run: (span: Span) => Promise<T>): Promise<T> {
  const startedAt = performance.now();

  return tracer.startActiveSpan(`tool.${toolName}`, { attributes: { 'kubequest.tool': toolName, ...attributes } }, async (span) => {
    let outcome = 'ok';

    try {
      const result = await run(span);
      span.setStatus({ code: SpanStatusCode.OK });

      return result;
    } catch (error) {
      const status = errorStatusCode(error);
      const message = error instanceof Error ? error.message : String(error);
      outcome = status >= 500 ? 'error' : 'rejected';
      span.setAttribute('kubequest.tool.error_status', status);

      if (status >= 500) {
        span.recordException(error instanceof Error ? error : new Error(message));
        span.setStatus({ code: SpanStatusCode.ERROR, message });
      }

      throw error;
    } finally {
      const durationMs = performance.now() - startedAt;
      kubequestMetrics().toolCalls.add(1, { 'kubequest.tool': toolName, 'kubequest.tool.outcome': outcome });
      kubequestMetrics().toolDuration.record(durationMs, { 'kubequest.tool': toolName });
      span.end();
    }
  });
}
