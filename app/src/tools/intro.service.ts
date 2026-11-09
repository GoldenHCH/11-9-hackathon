import { randomUUID } from 'node:crypto';
import type { IIntro, IProposeIntroInput, IRespondIntroInput } from '@kubequest/shared';
import { ResourceStoreService } from '../resources/resource-store.service';
import { LookupService } from './lookup.service';
import { ToolInputError } from './tools.errors';

export class IntroService {
  private readonly _store: ResourceStoreService;
  private readonly _lookup: LookupService;

  public constructor(store: ResourceStoreService, lookup: LookupService) {
    this._store = store;
    this._lookup = lookup;
  }

  public async proposeIntro(input: IProposeIntroInput): Promise<IIntro> {
    const from = this._lookup.attendee(input.fromId);
    const to = this._lookup.attendee(input.toId);

    if (from.id === to.id) {
      throw new ToolInputError('You cannot propose an intro to yourself.');
    }

    const openIntro = this._store
      .getIntros()
      .find(
        (intro) =>
          (intro.status === 'proposed' || intro.status === 'accepted') &&
          ((intro.fromId === from.id && intro.toId === to.id) || (intro.fromId === to.id && intro.toId === from.id)),
      );

    if (openIntro) {
      return openIntro;
    }

    const intro: IIntro = {
      id: `intro-${randomUUID().slice(0, 8)}`,
      fromId: from.id,
      toId: to.id,
      status: 'proposed',
      proposedAt: this._store.now().toISOString(),
      arrivals: [],
    };

    this._store.addIntro(intro);

    return intro;
  }

  public async respondIntro(input: IRespondIntroInput): Promise<IIntro> {
    const intro = this._lookup.intro(input.introId);
    const attendee = this._lookup.attendee(input.attendeeId);

    if (attendee.id !== intro.fromId && attendee.id !== intro.toId) {
      throw new ToolInputError('Only the two people in this intro can respond to it.');
    }

    if (intro.status !== 'proposed') {
      throw new ToolInputError(`This intro is already ${intro.status}.`);
    }

    intro.status = input.response === 'accept' ? 'accepted' : 'declined';

    return intro;
  }
}
