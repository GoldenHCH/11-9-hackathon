import { PersonAction } from './people.types';

export const peopleMeetPollMs = 10000;

export const peopleLimit = 10;

export const personActionLabels: Record<PersonAction, string> = {
  propose: 'Let’s meet',
  waiting: 'Waiting for them',
  accept: 'Accept',
  open: 'Open meet',
  closed: 'No match this time',
};

export const personActionIcons: Record<PersonAction, string> = {
  propose: 'waving_hand',
  waiting: 'hourglass_top',
  accept: 'check',
  open: 'forum',
  closed: 'block',
};
