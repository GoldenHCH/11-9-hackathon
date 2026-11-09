import { isSpanContextValid, trace } from '@opentelemetry/api';
import pino from 'pino';
import { appConfig } from '../config';

function traceCorrelation(): Record<string, string> {
  const spanContext = trace.getActiveSpan()?.spanContext();

  if (!spanContext || !isSpanContextValid(spanContext)) {
    return {};
  }

  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: `0${spanContext.traceFlags.toString(16)}`,
  };
}

export const logger = pino({
  level: appConfig.logLevel,
  base: {
    'service.name': appConfig.serviceName,
    'service.version': appConfig.appVersion,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  mixin: traceCorrelation,
  redact: {
    paths: ['token', '*.token', 'apiKey', '*.apiKey', 'authorization', '*.authorization', 'headers.authorization'],
    censor: '[redacted]',
  },
});
