import type { estypes } from '@elastic/elasticsearch';
import type { IndexName } from '@kubequest/shared';

export class EsMappingsHelper {
  public static buildMappings(inferenceId: string): Record<IndexName, estypes.MappingTypeMapping> {
    const semanticText: estypes.MappingProperty = { type: 'semantic_text', inference_id: inferenceId };
    const keyword: estypes.MappingProperty = { type: 'keyword' };
    const text: estypes.MappingProperty = { type: 'text' };
    const date: estypes.MappingProperty = { type: 'date' };
    const bool: estypes.MappingProperty = { type: 'boolean' };
    const integer: estypes.MappingProperty = { type: 'integer' };
    const geoPoint: estypes.MappingProperty = { type: 'geo_point' };

    return {
      talks: {
        properties: {
          id: keyword,
          title: text,
          abstract: text,
          speakers: { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } },
          searchText: semanticText,
          transcript: semanticText,
          track: keyword,
          level: keyword,
          locationId: keyword,
          venue: keyword,
          start: date,
          end: date,
          geo: geoPoint,
          url: keyword,
          hasTranscript: bool,
        },
      },
      attendees: {
        properties: {
          id: keyword,
          handle: keyword,
          name: text,
          githubLogin: keyword,
          avatarUrl: keyword,
          headline: text,
          profileText: text,
          profileSemantic: semanticText,
          profile: {
            properties: {
              topics: keyword,
              languages: keyword,
              seniority: keyword,
              goals: text,
              offers: text,
              asks: text,
              firstTimer: bool,
              welcomer: bool,
            },
          },
          visible: bool,
          lastLocation: geoPoint,
          lastLocationId: keyword,
          lastSeenAt: date,
          xp: integer,
          badges: keyword,
          createdAt: date,
        },
      },
      locations: {
        properties: {
          id: keyword,
          name: text,
          kind: keyword,
          venue: keyword,
          floor: keyword,
          geo: geoPoint,
        },
      },
      xp_events: {
        properties: {
          id: keyword,
          attendeeId: keyword,
          type: keyword,
          xp: integer,
          talkId: keyword,
          locationId: keyword,
          introId: keyword,
          at: date,
        },
      },
      intros: {
        properties: {
          id: keyword,
          fromId: keyword,
          toId: keyword,
          status: keyword,
          meetingPointId: keyword,
          icebreaker: text,
          proposedAt: date,
          slot: { properties: { start: date, end: date } },
          arrivals: { type: 'nested', properties: { attendeeId: keyword, at: date } },
        },
      },
    };
  }
}
