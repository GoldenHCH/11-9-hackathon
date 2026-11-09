import { SpanStatusCode, metrics, trace } from '@opentelemetry/api';
import type { Attributes, Counter } from '@opentelemetry/api';
import type { IToolSignatures, ToolName } from '@kubequest/shared';
import { ToolForbiddenError } from './tools.errors';

export class ToolTracerHelper {
  private static _checkInCounter?: Counter;

  public static run<Name extends ToolName>(
    name: Name,
    input: IToolSignatures[Name]['input'],
    work: () => Promise<IToolSignatures[Name]['output']>,
  ): Promise<IToolSignatures[Name]['output']> {
    const tracer = trace.getTracer('kubequest');

    return tracer.startActiveSpan(`tool.${name}`, async (span) => {
      span.setAttributes(ToolTracerHelper._inputAttributes(name, input));

      try {
        const output = await work();

        span.setAttributes(ToolTracerHelper._outputAttributes(name, output));
        ToolTracerHelper._countCheckIn(name, input, output);

        return output;
      } catch (error) {
        const failure = error instanceof Error ? error : new Error(String(error));

        if (name === 'check_in' && error instanceof ToolForbiddenError) {
          span.setAttributes({ 'kubequest.checkin.rejected_reason': error.reason, 'kubequest.xp.awarded': 0 });
          ToolTracerHelper._countCheckIn(name, input, undefined, error.reason);
        }

        span.recordException(failure);
        span.setStatus({ code: SpanStatusCode.ERROR, message: failure.message });

        throw error;
      } finally {
        span.end();
      }
    });
  }

  private static _inputAttributes(name: ToolName, input: unknown): Attributes {
    const record = input as Record<string, unknown>;
    const attributes: Attributes = { 'kubequest.tool': name };
    const attendeeId = record.attendeeId ?? record.fromId;

    if (typeof attendeeId === 'string') {
      attributes['kubequest.attendee.id'] = attendeeId;
    }

    if (typeof record.locationId === 'string') {
      attributes['kubequest.location.id'] = record.locationId;
    }

    if (typeof record.talkId === 'string') {
      attributes['kubequest.talk.id'] = record.talkId;
    }

    if (typeof record.introId === 'string') {
      attributes['kubequest.intro.id'] = record.introId;
    }

    return attributes;
  }

  private static _outputAttributes(name: ToolName, output: unknown): Attributes {
    const record = output as Record<string, unknown>;
    const attributes: Attributes = {};

    if ((name === 'check_in' || name === 'submit_quiz') && typeof record.xp === 'number') {
      attributes['kubequest.xp.awarded'] = record.xp;
    }

    if (name === 'propose_intro' && typeof record.id === 'string') {
      attributes['kubequest.intro.id'] = record.id;
    }

    return attributes;
  }

  private static _countCheckIn(name: ToolName, input: unknown, output: unknown, rejectedReason?: string): void {
    if (name !== 'check_in') {
      return;
    }

    const locationId = (input as Record<string, unknown>).locationId;
    const awardedXp = (output as Record<string, unknown> | undefined)?.xp;
    const outcome = rejectedReason ? 'rejected' : typeof awardedXp === 'number' && awardedXp > 0 ? 'awarded' : 'repeat';
    const attributes: Attributes = { 'location.id': typeof locationId === 'string' ? locationId : 'unknown', outcome };

    if (rejectedReason) {
      attributes['kubequest.checkin.rejected_reason'] = rejectedReason;
    }

    ToolTracerHelper._checkIns().add(1, attributes);
  }

  private static _checkIns(): Counter {
    ToolTracerHelper._checkInCounter ??= metrics
      .getMeter('kubequest')
      .createCounter('kubequest.checkins', { description: 'QR check-ins by location and outcome' });

    return ToolTracerHelper._checkInCounter;
  }
}
