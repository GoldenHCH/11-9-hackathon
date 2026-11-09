export type ExhibitorType = 'sponsor' | 'project';

export type QuestStatus = 'offered' | 'accepted' | 'not_now' | 'declined' | 'dropped' | 'completed' | 'expired';

export interface IMapPoint {
  x: number;
  y: number;
}

export interface IFacetCount {
  value: string;
  count: number;
}

export interface IPublicPlayer {
  id: string;
  handle: string;
  faceSeed: string;
  level: number;
  levelName: string;
  xp: number;
  banners: string[];
  isSpeaker?: boolean;
}

export interface IExhibitorCard {
  id: string;
  name: string;
  exhibitorType: ExhibitorType;
  tier: string;
  boothNumber: string;
  hall?: string;
  zone?: string;
  topics: string[];
  categories: string[];
  askAbout?: string;
  visitorsNow: number;
  visitedByMe?: boolean;
}

export interface IExhibitorDetail extends IExhibitorCard {
  building: string;
  level: string;
  description?: string;
  schedule?: string;
  mapPosition?: IMapPoint;
}

export interface IExhibitorDirectory {
  exhibitors: IExhibitorCard[];
  total: number;
  facets: {
    types: IFacetCount[];
    tiers: IFacetCount[];
    zones: IFacetCount[];
    topics: IFacetCount[];
  };
  generatedAt: string;
}

export interface IListExhibitorsInput {
  query?: string;
  type?: ExhibitorType;
  tier?: string;
  zone?: string;
  topic?: string;
  attendeeId?: string;
  limit?: number;
  offset?: number;
}

export interface IExhibitorTalk {
  id: string;
  title: string;
  start: string;
  end: string;
  where: string;
  speakers: string[];
  track: string;
}

export interface IExhibitorLive {
  visitorsNow: number;
  visitsToday: number;
  uniqueVisitorsToday: number;
}

export interface IExhibitorMe {
  visited: boolean;
  lastVisitAt?: string;
  questId?: string;
  questStatus?: QuestStatus;
}

export interface IExhibitorPage {
  exhibitor: IExhibitorDetail;
  live: IExhibitorLive;
  talks: IExhibitorTalk[];
  playersHere: IPublicPlayer[];
  nearby: IExhibitorCard[];
  me?: IExhibitorMe;
  expoMapUrl: string;
  generatedAt: string;
}

export interface IHourCount {
  hour: string;
  visits: number;
}

export interface IExhibitorVisitor {
  player: IPublicPlayer;
  at: string;
  firstTimer: boolean;
}

export interface IExhibitorVisits {
  now: number;
  today: number;
  uniqueToday: number;
  conference: number;
  uniqueConference: number;
  firstTimersToday: number;
}

export interface IExhibitorDashboard {
  exhibitor: IExhibitorDetail;
  scanUrl: string;
  publicPageUrl: string;
  visits: IExhibitorVisits;
  byHour: IHourCount[];
  visitorTopics: IFacetCount[];
  visitorLevels: IFacetCount[];
  recentVisitors: IExhibitorVisitor[];
  hereNow: IPublicPlayer[];
  quests: Partial<Record<QuestStatus, number>>;
  rank: { position: number; of: number } | null;
  generatedAt: string;
}

export interface IRoomCount {
  location: { id: string; name: string; kind: string; building?: string; level?: string };
  count: number;
}

export interface IBossSummary {
  talkId: string;
  title?: string;
  status: string;
  health: number;
  maxHealth: number;
  participants: number;
}

export interface IOrganizerStats {
  players: number;
  checkInsToday: number;
  xpToday: number;
  xpByType: Partial<Record<string, number>>;
  meets: Partial<Record<string, number>>;
  quests: Partial<Record<QuestStatus, number>>;
  busiestRooms: IRoomCount[];
  bosses: IBossSummary[];
  generatedAt: string;
}

export interface IExhibitorStatRow {
  exhibitor: IExhibitorCard;
  visitsToday: number;
  uniqueToday: number;
  questsCompleted: number;
  staffUrl: string;
  scanUrl: string;
}

export interface IExhibitorGroupStat {
  value: string;
  exhibitors: number;
  visits: number;
}

export interface IAdminOverview {
  stats: IOrganizerStats;
  exhibitors: {
    total: number;
    sponsors: number;
    projects: number;
    visitedToday: number;
    visitsToday: number;
    uniqueVisitorsToday: number;
  };
  byTier: IExhibitorGroupStat[];
  byZone: IExhibitorGroupStat[];
  table: IExhibitorStatRow[];
  generatedAt: string;
}

export interface IToolErrorBody {
  error: { code: string; message: string };
}
