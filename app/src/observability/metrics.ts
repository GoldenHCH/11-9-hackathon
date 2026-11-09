import { Counter, Histogram, metrics } from '@opentelemetry/api';
import { appConfig } from '../config';

interface IKubequestMetrics {
  xpAwarded: Counter;
  checkIns: Counter;
  handshakes: Counter;
  handshakeOutcomes: Counter;
  boothNotes: Counter;
  messages: Counter;
  quizDuration: Histogram;
  toolCalls: Counter;
  toolDuration: Histogram;
}

let instruments: IKubequestMetrics | undefined;

export function kubequestMetrics(): IKubequestMetrics {
  if (instruments) {
    return instruments;
  }

  const meter = metrics.getMeter(appConfig.serviceName, appConfig.appVersion);

  instruments = {
    xpAwarded: meter.createCounter('kubequest.xp.awarded', { description: 'XP awarded to players', unit: '{xp}' }),
    checkIns: meter.createCounter('kubequest.checkins', { description: 'QR check-ins by location and outcome', unit: '{checkin}' }),
    handshakes: meter.createCounter('kubequest.handshakes', { description: 'Handshakes matched between two players (phone to phone)', unit: '{handshake}' }),
    handshakeOutcomes: meter.createCounter('kubequest.handshake.outcomes', { description: 'Handshake answers evaluated, by outcome', unit: '{handshake}' }),
    boothNotes: meter.createCounter('kubequest.booth_notes.saved', { description: 'Booth notes saved, by whether they earned XP', unit: '{note}' }),
    messages: meter.createCounter('kubequest.messages.sent', { description: 'Messages sent between matched players', unit: '{message}' }),
    quizDuration: meter.createHistogram('kubequest.quiz.duration', { description: 'Time from opening a quiz to submitting it', unit: 's' }),
    toolCalls: meter.createCounter('kubequest.tool.calls', { description: 'Tool invocations by tool and outcome', unit: '{call}' }),
    toolDuration: meter.createHistogram('kubequest.tool.duration', { description: 'Tool latency', unit: 'ms' }),
  };

  return instruments;
}
