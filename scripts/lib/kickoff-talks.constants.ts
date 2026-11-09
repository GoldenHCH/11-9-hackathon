import type { IKickoffTalk } from './data-scripts.interfaces';

export const kickoffVenue = 'The Shop Workspace';
export const kickoffRoom = 'Hackathon Floor';
export const kickoffFloor = 'Level 1';
export const kickoffUrl = 'https://github.com/GoldenHCH/11-9-hackathon';

export const kickoffTalks: IKickoffTalk[] = [
  {
    id: 'cnh-kickoff-dash0',
    title: 'Hackathon Kickoff: What Dash0 Wants to See in Your Telemetry',
    abstract:
      'Dash0 explains how its track is judged: traces, logs, metrics and RUM instrumented with OpenTelemetry craft, semantic conventions, a committed collector config and logs correlated with traces. Teams that use Agent0 or the Dash0 MCP server to find and fix something real, and that treat observability as part of the product, score best.',
    speakers: ['Dash0 team'],
    startLocal: '2026-11-09T10:00:00',
    endLocal: '2026-11-09T10:15:00',
    track: 'observability',
  },
  {
    id: 'cnh-kickoff-sonar',
    title: 'Hackathon Kickoff: Sonar and Gitar on Reviewed Pull Requests',
    abstract:
      'Sonar and Gitar describe their track: features should land through pull requests that Gitar reviewed, with review instructions and repo rules written for the project. They look for CI failures that were diagnosed and fixed, and for logic and security bugs the reviewer caught, auto-applied or learned from.',
    speakers: ['Sonar and Gitar team'],
    startLocal: '2026-11-09T10:15:00',
    endLocal: '2026-11-09T10:30:00',
    track: 'security',
  },
  {
    id: 'cnh-kickoff-elastic',
    title: 'Hackathon Kickoff: Building on Elasticsearch Serverless',
    abstract:
      'Elastic covers what its track rewards: Elasticsearch as the core data layer with smart keyword, semantic, vector or hybrid search. They point teams to Jina models on Elastic Cloud, Agent Builder, Workflows, geo queries and Serverless, and ask for depth and creativity over breadth.',
    speakers: ['Elastic team'],
    startLocal: '2026-11-09T10:30:00',
    endLocal: '2026-11-09T10:45:00',
    track: 'other',
  },
  {
    id: 'cnh-kickoff-radar',
    title: 'Hackathon Kickoff: Running on Kubernetes with Radar',
    abstract:
      'Radar explains its track: projects run on Kubernetes with Radar connected, and teams use the Radar UI and MCP server while building and operating. They want an AI investigation on a real issue and a record of the meaningful decisions Radar helped with, such as verified healthy releases, checks and rollouts.',
    speakers: ['Radar team'],
    startLocal: '2026-11-09T10:45:00',
    endLocal: '2026-11-09T11:00:00',
    track: 'platform',
  },
];
