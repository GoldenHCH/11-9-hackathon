import { createHash } from 'node:crypto';
import { matchSignalWords, materials } from '../types/kubequest.constants';
import { IMatchSignal } from '../types/kubequest.interfaces';
import { Material } from '../types/kubequest.types';

const SIGNAL_CELLS = 64;

export function matchSignalFor(meetId: string): IMatchSignal {
  const digest = createHash('sha512').update(`signal:${meetId}`).digest();
  const first = matchSignalWords.FIRST[digest[0] % matchSignalWords.FIRST.length];
  const second = matchSignalWords.SECOND[digest[1] % matchSignalWords.SECOND.length];
  const pattern: Material[] = [];

  for (let cell = 0; cell < SIGNAL_CELLS; cell += 1) {
    pattern.push(materials[digest[cell] % materials.length]);
  }

  return { words: `${first} ${second}`, pattern };
}
