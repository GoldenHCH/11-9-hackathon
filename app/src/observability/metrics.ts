import { Counter, Histogram, metrics } from '@opentelemetry/api';
import { appConfig } from '../config';

interface IKubequestMetrics {
  xpAwarded: Counter;
  checkIns: Counter;
  handshakes: Counter;
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
    handshakes: meter.createCounter('kubequest.handshakes', { description: 'Meets verified by both players scanning a campfire', unit: '{handshake}' }),
    quizDuration: meter.createHistogram('kubequest.quiz.duration', { description: 'Time from opening a quiz to submitting it', unit: 's' }),
    toolCalls: meter.createCounter('kubequest.tool.calls', { description: 'Tool invocations by tool and outcome', unit: '{call}' }),
    toolDuration: meter.createHistogram('kubequest.tool.duration', { description: 'Tool latency', unit: 'ms' }),
  };

  return instruments;
}
