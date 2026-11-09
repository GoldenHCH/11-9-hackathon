import type { IToolContracts } from './kubequest.interfaces';
import {
  aiProviders,
  aiPurposes,
  bannerIds,
  bossStatuses,
  checkInRejections,
  checkInStatuses,
  declineReasons,
  exhibitorTypes,
  handshakeQuestionSources,
  handshakeRoles,
  handshakeStatuses,
  itineraryItemKinds,
  leaderboardBoards,
  leaderboardPeriods,
  locationKinds,
  materials,
  meetResponses,
  meetRoles,
  meetStatuses,
  questResponses,
  questSources,
  questStatuses,
  questTargetKinds,
  questTypes,
  quizSources,
  searchResultKinds,
  sessionTypes,
  toolNames,
  tracks,
  xpEventTypes,
} from './kubequest.constants';

export type IsoDateString = string;

export type Material = (typeof materials)[number];

export type Track = (typeof tracks)[number];

export type LocationKind = (typeof locationKinds)[number];

export type ExhibitorType = (typeof exhibitorTypes)[number];

export type SessionType = (typeof sessionTypes)[number];

export type XpEventType = (typeof xpEventTypes)[number];

export type QuestType = (typeof questTypes)[number];

export type QuestStatus = (typeof questStatuses)[number];

export type QuestResponse = (typeof questResponses)[number];

export type QuestSource = (typeof questSources)[number];

export type QuestTargetKind = (typeof questTargetKinds)[number];

export type DeclineReason = (typeof declineReasons)[number];

export type MeetStatus = (typeof meetStatuses)[number];

export type MeetResponse = (typeof meetResponses)[number];

export type MeetRole = (typeof meetRoles)[number];

export type LeaderboardBoard = (typeof leaderboardBoards)[number];

export type LeaderboardPeriod = (typeof leaderboardPeriods)[number];

export type CheckInStatus = (typeof checkInStatuses)[number];

export type CheckInRejection = (typeof checkInRejections)[number];

export type SearchResultKind = (typeof searchResultKinds)[number];

export type ItineraryItemKind = (typeof itineraryItemKinds)[number];

export type BossStatus = (typeof bossStatuses)[number];

export type QuizSource = (typeof quizSources)[number];

export type AiProvider = (typeof aiProviders)[number];

export type AiPurpose = (typeof aiPurposes)[number];

export type BannerId = (typeof bannerIds)[number];

export type ToolName = (typeof toolNames)[number];

export type HandshakeStatus = (typeof handshakeStatuses)[number];

export type HandshakeRole = (typeof handshakeRoles)[number];

export type HandshakeQuestionSource = (typeof handshakeQuestionSources)[number];

export type MaterialCounts = Record<Material, number>;

export type ToolInput<TName extends ToolName> = IToolContracts[TName]['input'];

export type ToolOutput<TName extends ToolName> = IToolContracts[TName]['output'];
