import type { ToolName } from '@kubequest/shared';
import type { IToolMetadata } from './tools.interfaces';

const attendeeIdProperty = { type: 'string', description: 'The id of the attendee asking, for example att-demo-platform.' } as const;

export const toolMetadata: Record<ToolName, IToolMetadata> = {
  check_in: {
    description:
      'Check an attendee in at a room, meeting point or booth with the signed token from its QR code. Awards 10 XP once per location per hour and records where the attendee is now.',
    inputSchema: {
      type: 'object',
      properties: {
        attendeeId: attendeeIdProperty,
        locationId: { type: 'string', description: 'The id of the location that was scanned.' },
        token: { type: 'string', description: 'The signed token from the QR code on the door or the screen.' },
      },
      required: ['attendeeId', 'locationId', 'token'],
    },
  },
  recommend_talks: {
    description:
      'Recommend upcoming talks that fit the attendee interests, best match first, with minutes until the start and walking time.',
    inputSchema: {
      type: 'object',
      properties: {
        attendeeId: attendeeIdProperty,
        day: { type: 'string', description: 'Only talks on this day, formatted YYYY-MM-DD.', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        limit: { type: 'integer', description: 'How many talks to return. Defaults to 5.', minimum: 1, maximum: 50 },
      },
      required: ['attendeeId'],
    },
  },
  recommend_people: {
    description:
      'Recommend people to meet: shared topics, first-timer and welcomer pairings, and people in the same room rank higher.',
    inputSchema: {
      type: 'object',
      properties: {
        attendeeId: attendeeIdProperty,
        hereOnly: { type: 'boolean', description: 'Only people checked in at the same place as the attendee.' },
        limit: { type: 'integer', description: 'How many people to return. Defaults to 5.', minimum: 1, maximum: 50 },
      },
      required: ['attendeeId'],
    },
  },
  whats_around_me: {
    description:
      'Describe the place the attendee is checked in at: the location, the talks running there now and next, and the people here worth meeting.',
    inputSchema: {
      type: 'object',
      properties: { attendeeId: attendeeIdProperty },
      required: ['attendeeId'],
    },
  },
  whats_next: {
    description: 'Find the next recommended talk for the attendee, with minutes until it starts and the walking time.',
    inputSchema: {
      type: 'object',
      properties: { attendeeId: attendeeIdProperty },
      required: ['attendeeId'],
    },
  },
  propose_intro: {
    description: 'Propose an introduction between two attendees. The other person has to accept before anything is arranged.',
    inputSchema: {
      type: 'object',
      properties: {
        fromId: { type: 'string', description: 'The attendee who wants to meet.' },
        toId: { type: 'string', description: 'The attendee they want to meet.' },
      },
      required: ['fromId', 'toId'],
    },
  },
  respond_intro: {
    description: 'Accept or decline an intro. Only the two people in the intro can respond.',
    inputSchema: {
      type: 'object',
      properties: {
        introId: { type: 'string', description: 'The id of the intro.' },
        attendeeId: attendeeIdProperty,
        response: { type: 'string', description: 'Accept or decline.', enum: ['accept', 'decline'] },
      },
      required: ['introId', 'attendeeId', 'response'],
    },
  },
  quiz_for_talk: {
    description: 'Get the three-question multiple-choice quiz for a talk. Plain text, no timer.',
    inputSchema: {
      type: 'object',
      properties: { talkId: { type: 'string', description: 'The id of the talk.' } },
      required: ['talkId'],
    },
  },
  submit_quiz: {
    description: 'Score the answers to a talk quiz and award 5 XP for each correct answer. Only the first attempt earns XP.',
    inputSchema: {
      type: 'object',
      properties: {
        attendeeId: attendeeIdProperty,
        talkId: { type: 'string', description: 'The id of the talk.' },
        answers: {
          type: 'array',
          description: 'The index of the chosen choice for each question, in order.',
          items: { type: 'integer' },
        },
      },
      required: ['attendeeId', 'talkId', 'answers'],
    },
  },
  leaderboard: {
    description: 'The top attendees by XP, with their handle and badges.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many entries to return. Defaults to 10.', minimum: 1, maximum: 50 },
      },
      required: [],
    },
  },
};
