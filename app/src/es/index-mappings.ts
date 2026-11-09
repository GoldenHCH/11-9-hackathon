import type { estypes } from '@elastic/elasticsearch';
import { indexNames } from './es.constants';

export type IndexName = (typeof indexNames)[keyof typeof indexNames];

type Properties = Record<string, estypes.MappingProperty>;

const keyword: estypes.MappingProperty = { type: 'keyword' };
const unindexedKeyword: estypes.MappingProperty = { type: 'keyword', index: false };
const text: estypes.MappingProperty = { type: 'text' };
const date: estypes.MappingProperty = { type: 'date' };
const integer: estypes.MappingProperty = { type: 'integer' };
const float: estypes.MappingProperty = { type: 'float' };
const bool: estypes.MappingProperty = { type: 'boolean' };
const geoPoint: estypes.MappingProperty = { type: 'geo_point' };
const opaqueObject: estypes.MappingProperty = { type: 'object', enabled: false };
const timeWindow: estypes.MappingProperty = { properties: { start: date, end: date } };

function semanticText(inferenceId: string): estypes.MappingProperty {
  return { type: 'semantic_text', inference_id: inferenceId };
}

export function buildIndexMappings(inferenceId: string): Record<IndexName, Properties> {
  return {
    [indexNames.TALKS]: {
      id: keyword,
      title: text,
      abstract: text,
      sessionType: keyword,
      track: keyword,
      material: keyword,
      speakers: keyword,
      speakerDetails: opaqueObject,
      start: date,
      end: date,
      locationId: keyword,
      building: keyword,
      level: keyword,
      room: keyword,
      geo: geoPoint,
      isBoss: bool,
      hasTranscript: bool,
      url: unindexedKeyword,
      quiz: opaqueObject,
      searchText: semanticText(inferenceId),
      transcript: semanticText(inferenceId),
    },
    [indexNames.ATTENDEES]: {
      id: keyword,
      handle: keyword,
      faceSeed: unindexedKeyword,
      realName: unindexedKeyword,
      githubLogin: keyword,
      avatarUrl: unindexedKeyword,
      photoUrl: unindexedKeyword,
      spotMe: unindexedKeyword,
      workingOn: text,
      headline: text,
      profileText: semanticText(inferenceId),
      profile: {
        properties: {
          topics: keyword,
          firstTimer: bool,
          welcomer: bool,
        },
      },
      settings: {
        properties: {
          meetingOn: bool,
          accessibleMode: bool,
          noWalking: bool,
          locationOn: bool,
          language: keyword,
          hideFromLeaderboard: bool,
        },
      },
      isSpeaker: bool,
      lastLocationId: keyword,
      lastLocation: geoPoint,
      lastSeenAt: date,
      visible: bool,
      xp: integer,
      level: integer,
      banners: keyword,
      blockedIds: keyword,
      createdAt: date,
    },
    [indexNames.LOCATIONS]: {
      id: keyword,
      name: text,
      kind: keyword,
      building: keyword,
      level: keyword,
      room: keyword,
      zone: keyword,
      geo: geoPoint,
      description: text,
      boothNumber: keyword,
      sponsorTier: keyword,
      askAbout: text,
      topics: keyword,
      hasScreen: bool,
      exhibitorType: keyword,
      categories: keyword,
      hall: keyword,
      schedule: text,
      mapPosition: { properties: { x: float, y: float } },
      searchText: semanticText(inferenceId),
    },
    [indexNames.XP_EVENTS]: {
      id: keyword,
      attendeeId: keyword,
      type: keyword,
      xp: integer,
      material: keyword,
      gems: integer,
      talkId: keyword,
      locationId: keyword,
      introId: keyword,
      questId: keyword,
      correct: integer,
      banner: keyword,
      traceId: keyword,
      spanId: keyword,
      at: date,
    },
    [indexNames.INTROS]: {
      id: keyword,
      fromId: keyword,
      toId: keyword,
      pairKey: keyword,
      status: keyword,
      proposedAt: date,
      respondedAt: date,
      acceptedBy: keyword,
      campfireId: keyword,
      slot: timeWindow,
      icebreaker: text,
      chatPrompt: text,
      matchSignal: opaqueObject,
      arrivals: { type: 'nested', properties: { attendeeId: keyword, at: date } },
      sharedTopics: keyword,
      firstTimerPair: bool,
      metAt: date,
      cancelledBy: keyword,
      expiresAt: date,
    },
    [indexNames.QUESTS]: {
      id: keyword,
      attendeeId: keyword,
      type: keyword,
      status: keyword,
      source: keyword,
      title: text,
      reason: text,
      nextStep: { type: 'text', index: false },
      reward: opaqueObject,
      where: opaqueObject,
      when: timeWindow,
      walkMinutes: integer,
      talkId: keyword,
      locationId: keyword,
      introId: keyword,
      partnerId: keyword,
      progress: opaqueObject,
      offeredAt: date,
      respondedAt: date,
      snoozedUntil: date,
      expiresAt: date,
      completedAt: date,
      declineReason: keyword,
    },
  };
}
