import {
  AiProvider,
  BannerId,
  BossStatus,
  CheckInRejection,
  CheckInStatus,
  DeclineReason,
  ExhibitorType,
  HandshakeQuestionSource,
  HandshakeRole,
  HandshakeStatus,
  IsoDateString,
  ItineraryItemKind,
  NotificationType,
  LeaderboardBoard,
  LeaderboardPeriod,
  LocationKind,
  Material,
  MaterialCounts,
  MeetLiveState,
  MeetResponse,
  MeetRole,
  MeetStatus,
  QuestResponse,
  QuestSource,
  QuestStatus,
  QuestTargetKind,
  QuestType,
  QuizSource,
  SearchResultKind,
  SessionType,
  ToolName,
  Track,
  XpEventType,
} from './kubequest.types';

export interface IGeoPoint {
  lat: number;
  lon: number;
}

export interface ITimeWindow {
  start: IsoDateString;
  end: IsoDateString;
}

export interface ILocation {
  id: string;
  name: string;
  kind: LocationKind;
  building: string;
  level: string;
  room?: string;
  zone?: string;
  geo: IGeoPoint;
  description?: string;
  boothNumber?: string;
  sponsorTier?: string;
  askAbout?: string;
  topics?: string[];
  hasScreen?: boolean;
  exhibitorType?: ExhibitorType;
  categories?: string[];
  hall?: string;
  mapPosition?: IMapPoint;
  schedule?: string;
}

export interface IMapPoint {
  x: number;
  y: number;
}

export interface ISpeaker {
  name: string;
  company?: string;
}

export interface ITalk {
  id: string;
  title: string;
  abstract: string;
  sessionType: SessionType;
  track: Track;
  material: Material;
  speakers: string[];
  speakerDetails: ISpeaker[];
  start: IsoDateString;
  end: IsoDateString;
  locationId: string;
  building: string;
  level: string;
  room: string;
  geo?: IGeoPoint;
  isBoss: boolean;
  hasTranscript: boolean;
  url?: string;
}

export interface IPlayerSettings {
  meetingOn: boolean;
  accessibleMode: boolean;
  noWalking: boolean;
  locationOn: boolean;
  language: string;
  hideFromLeaderboard: boolean;
}

export interface IPlayerProfile {
  topics: string[];
  firstTimer: boolean;
  welcomer: boolean;
}

export interface IAttendee {
  id: string;
  handle: string;
  faceSeed: string;
  realName?: string;
  displayName?: string;
  email?: string;
  githubLogin?: string;
  avatarUrl?: string;
  photoUrl?: string;
  spotMe?: string;
  workingOn: string;
  headline?: string;
  skills?: string[];
  offers?: string[];
  asks?: string[];
  summary?: string;
  profileText: string;
  profile: IPlayerProfile;
  settings: IPlayerSettings;
  isSpeaker?: boolean;
  lastLocationId?: string;
  lastLocation?: IGeoPoint;
  lastSeenAt?: IsoDateString;
  visible: boolean;
  xp: number;
  level: number;
  banners: BannerId[];
  blockedIds: string[];
  createdAt: IsoDateString;
  itinerary?: IItineraryEntry[];
}

export interface IPublicPlayer {
  id: string;
  handle: string;
  faceSeed: string;
  level: number;
  levelName: string;
  xp: number;
  banners: BannerId[];
  isSpeaker?: boolean;
}

export interface IMatchPlayer extends IPublicPlayer {
  topics: string[];
  workingOn: string;
  firstTimer: boolean;
}

export interface IPartnerDetails {
  realName?: string;
  photoUrl?: string;
  spotMe?: string;
}

export interface ILevelDefinition {
  level: number;
  name: string;
  minXp: number;
}

export interface ILevelProgress {
  level: number;
  name: string;
  xp: number;
  levelMinXp: number;
  nextLevelXp: number | null;
  nextLevelName: string | null;
  progress: number;
}

export interface IBannerProgress {
  id: BannerId;
  name: string;
  description: string;
  progress: number;
  target: number;
  earned: boolean;
  earnedAt?: IsoDateString;
}

export interface IInventory {
  blocks: MaterialCounts;
  totalBlocks: number;
  gems: number;
  banners: IBannerProgress[];
}

export interface IProfile {
  attendee: IAttendee;
  level: ILevelProgress;
  inventory: IInventory;
  personalLink: string;
  publicId: string;
}

export interface IXpEvent {
  id: string;
  attendeeId: string;
  type: XpEventType;
  xp: number;
  material?: Material;
  gems?: number;
  talkId?: string;
  locationId?: string;
  introId?: string;
  questId?: string;
  correct?: number;
  banner?: BannerId;
  traceId?: string;
  spanId?: string;
  at: IsoDateString;
}

export interface IQuestReward {
  xp: number;
  material?: Material;
  gems?: number;
  banner?: BannerId;
  label: string;
}

export interface IQuestPlace {
  locationId: string;
  name: string;
  kind: LocationKind;
  building: string;
  level: string;
}

export interface IQuestProgress {
  current: number;
  target: number;
}

export interface IQuest {
  id: string;
  attendeeId: string;
  type: QuestType;
  status: QuestStatus;
  source: QuestSource;
  title: string;
  reason: string;
  nextStep: string;
  reward: IQuestReward;
  where?: IQuestPlace;
  when?: ITimeWindow;
  walkMinutes?: number;
  talkId?: string;
  locationId?: string;
  introId?: string;
  partnerId?: string;
  progress?: IQuestProgress;
  offeredAt: IsoDateString;
  respondedAt?: IsoDateString;
  snoozedUntil?: IsoDateString;
  expiresAt?: IsoDateString;
  completedAt?: IsoDateString;
  declineReason?: DeclineReason;
}

export interface IQuestBoard {
  offers: IQuest[];
  active: IQuest[];
  doneToday: IQuest[];
  maxOffers: number;
  maxActive: number;
}

export interface IMatchSignal {
  words: string;
  pattern: Material[];
}

export interface IMeetArrival {
  attendeeId: string;
  at: IsoDateString;
}

export interface IIntro {
  id: string;
  fromId: string;
  toId: string;
  pairKey: string;
  status: MeetStatus;
  proposedAt: IsoDateString;
  respondedAt?: IsoDateString;
  acceptedBy: string[];
  campfireId?: string;
  slot?: ITimeWindow;
  icebreaker?: string;
  chatPrompt?: string;
  matchSignal?: IMatchSignal;
  arrivals: IMeetArrival[];
  sharedTopics: string[];
  firstTimerPair: boolean;
  metAt?: IsoDateString;
  cancelledBy?: string;
  expiresAt: IsoDateString;
  liveState?: MeetLiveState;
  liveCard?: IMeetLiveCard;
}

export interface IMeetLiveCard {
  handle: string;
  faceSeed: string;
  level: number;
  levelName: string;
  headline: string;
  why: string;
}

export interface IMeetRequester {
  publicId: string;
  handle: string;
  faceSeed: string;
  level: number;
  levelName: string;
  headline: string;
}

export interface IMeetRequest {
  meetId: string;
  requester: IMeetRequester;
  sharedTopics: string[];
  why: string;
  expiresAt: IsoDateString;
  secondsLeft: number;
}

export interface IPendingMeetRequests {
  requests: IMeetRequest[];
  serverTime: IsoDateString;
}

export interface IMeet {
  id: string;
  status: MeetStatus;
  role: MeetRole;
  statusLine: string;
  partner: IMatchPlayer;
  partnerDetails?: IPartnerDetails;
  campfire?: ILocation;
  slot?: ITimeWindow;
  icebreaker?: string;
  chatPrompt?: string;
  matchSignal?: IMatchSignal;
  sharedTopics: string[];
  iAccepted: boolean;
  iArrivedAt?: IsoDateString;
  partnerArrived: boolean;
  expiresAt: IsoDateString;
  live: boolean;
  secondsLeft?: number;
  xpAwarded?: number;
}

export interface IQuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
}

export interface IQuizQuestionWithAnswer extends IQuizQuestion {
  answerIndex: number;
  explanation?: string;
}

export interface IStoredQuiz {
  talkId: string;
  source: QuizSource;
  generatedBy: AiProvider;
  questions: IQuizQuestionWithAnswer[];
  createdAt: IsoDateString;
}

export interface IQuizAnswerResult {
  questionId: string;
  chosenIndex: number;
  correctIndex: number;
  correct: boolean;
  explanation?: string;
}

export interface IQuizResult {
  talkId: string;
  correct: number;
  total: number;
  xpAwarded: number;
  alreadySubmitted: boolean;
  results: IQuizAnswerResult[];
  boss?: IBossState;
}

export interface IQuiz {
  talkId: string;
  talkTitle: string;
  source: QuizSource;
  isBoss: boolean;
  questions: IQuizQuestion[];
  previousResult?: IQuizResult;
}

export interface IBossState {
  talkId: string;
  title: string;
  locationId: string;
  status: BossStatus;
  maxHealth: number;
  health: number;
  damage: number;
  playersInRoom: number;
  participants: number;
  endsAt: IsoDateString;
  deadline: IsoDateString;
  bonusXp: number;
  defeatedAt?: IsoDateString;
}

export interface ILeaderboardRow {
  rank: number;
  player: IPublicPlayer;
  score: number;
  latestTraceId?: string;
  latestEventAt?: IsoDateString;
  isMe: boolean;
}

export interface ILeaderboard {
  board: LeaderboardBoard;
  period: LeaderboardPeriod;
  rows: ILeaderboardRow[];
  me?: ILeaderboardRow;
}

export interface IWorldRoom {
  location: ILocation;
  now?: ITalk;
  next?: ITalk;
  busyness: number;
  walkMinutes?: number;
}

export interface IWorldLevel {
  name: string;
  rooms: IWorldRoom[];
}

export interface IWorldBuilding {
  name: string;
  levels: IWorldLevel[];
}

export interface IWorld {
  buildings: IWorldBuilding[];
  generatedAt: IsoDateString;
}

export interface ISearchFilters {
  now?: boolean;
  nearMe?: boolean;
  track?: Track;
  building?: string;
  kinds?: SearchResultKind[];
}

export interface ISearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string;
  score: number;
  talk?: ITalk;
  location?: ILocation;
  player?: IMatchPlayer;
  startsInMinutes?: number;
  walkMinutes?: number;
  distanceMeters?: number;
}

export interface ISearchResponse {
  query: string;
  results: ISearchResult[];
}

export interface ITalkMatch {
  talk: ITalk;
  location?: ILocation;
  score: number;
  reason: string;
  startsInMinutes: number;
  walkMinutes?: number;
}

export interface IPersonMatch {
  player: IMatchPlayer;
  score: number;
  sharedTopics: string[];
  reason: string;
  sameRoom: boolean;
  meetStatus?: MeetStatus;
}

export interface IItineraryItem {
  kind: ItineraryItemKind;
  title: string;
  start: IsoDateString;
  end?: IsoDateString;
  place?: IQuestPlace;
  walkMinutes?: number;
  talkId?: string;
  questId?: string;
  meetId?: string;
}

export interface IWhatsNext {
  now?: IItineraryItem;
  items: IItineraryItem[];
}

export interface INearbyCampfire {
  location: ILocation;
  walkMinutes?: number;
  distanceMeters?: number;
}

export interface IWhatsAroundMe {
  location?: ILocation;
  now?: ITalk;
  next?: ITalk;
  playersHere: number;
  quizAvailable: boolean;
  boss?: IBossState;
  nearestCampfire?: INearbyCampfire;
  matchesHere?: IPersonMatch[];
}

export interface ICheckInResult {
  status: CheckInStatus;
  message: string;
  xpAwarded: number;
  material?: Material;
  gemsAwarded?: number;
  rejectedReason?: CheckInRejection;
  location?: ILocation;
  talkNow?: ITalk;
  event?: IXpEvent;
  quizAvailable: boolean;
  completedQuests: IQuest[];
  meet?: IMeet;
  boss?: IBossState;
  levelUp?: ILevelProgress;
  newBanners: IBannerProgress[];
  boothNote?: IBoothNote;
  noteRequired?: boolean;
  peopleHere?: IPersonMatch[];
}

export interface ISignUpResult {
  profile: IProfile;
  personalLink: string;
  starterMaterial: Material;
  xpAwarded: number;
  firstQuest?: IQuest;
  checkIn?: ICheckInResult;
}

export interface IScreenToken {
  locationId: string;
  token: string;
  expiresAt: IsoDateString;
  scanUrl: string;
}

export interface IDemoScanToken {
  locationId: string;
  path: string;
}

export interface IRespondQuestResult {
  quest: IQuest;
  board: IQuestBoard;
}

export interface IRespondMeetResult {
  meet: IMeet;
  xpAwarded: number;
}

export interface IRoomCount {
  location: ILocation;
  count: number;
}

export interface IOrganizerStats {
  players: number;
  checkInsToday: number;
  xpToday: number;
  xpByType: Partial<Record<XpEventType, number>>;
  meets: Partial<Record<MeetStatus, number>>;
  quests: Partial<Record<QuestStatus, number>>;
  busiestRooms: IRoomCount[];
  bosses: IBossState[];
  generatedAt: IsoDateString;
}

export interface IFacetCount {
  value: string;
  count: number;
}

export interface IExhibitorCard {
  id: string;
  name: string;
  exhibitorType: ExhibitorType;
  tier: string;
  boothNumber: string;
  hall?: string;
  zone?: string;
  topics: Track[];
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
  generatedAt: IsoDateString;
}

export interface IExhibitorTalk {
  id: string;
  title: string;
  start: IsoDateString;
  end: IsoDateString;
  where: string;
  speakers: string[];
  track: Track;
}

export interface IExhibitorLive {
  visitorsNow: number;
  visitsToday: number;
  uniqueVisitorsToday: number;
}

export interface IExhibitorMe {
  visited: boolean;
  lastVisitAt?: IsoDateString;
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
  generatedAt: IsoDateString;
}

export interface IHourCount {
  hour: IsoDateString;
  visits: number;
}

export interface IExhibitorVisitor {
  player: IPublicPlayer;
  at: IsoDateString;
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

export interface IExhibitorRank {
  position: number;
  of: number;
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
  rank: IExhibitorRank | null;
  generatedAt: IsoDateString;
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

export interface IAdminExhibitorTotals {
  total: number;
  sponsors: number;
  projects: number;
  visitedToday: number;
  visitsToday: number;
  uniqueVisitorsToday: number;
}

export interface IAdminOverview {
  stats: IOrganizerStats;
  exhibitors: IAdminExhibitorTotals;
  byTier: IExhibitorGroupStat[];
  byZone: IExhibitorGroupStat[];
  table: IExhibitorStatRow[];
  generatedAt: IsoDateString;
}

export interface IAttendeeInput {
  attendeeId: string;
}

export interface ISignInInput {
  name: string;
  email: string;
}

export interface ISignInResult {
  attendee: IProfile;
  personalLink: string;
  isNew: boolean;
  needsOnboarding: boolean;
}

export interface ISignUpInput {
  attendeeId?: string;
  handle?: string;
  workingOn: string;
  firstKubeCon: boolean;
  happyToWelcome?: boolean;
  topics?: string[];
  meetingOn: boolean;
  spotMe?: string;
  githubLogin?: string;
  realName?: string;
  accessibleMode?: boolean;
  noWalking?: boolean;
  scanLocationId?: string;
  scanToken?: string;
  headline?: string;
  skills?: string[];
  offers?: string[];
  asks?: string[];
  summary?: string;
}

export interface IImportProfileInput {
  attendeeId: string;
  text?: string;
}

export interface IImportedProfile {
  headline: string;
  role: string;
  seniority: string;
  skills: string[];
  topics: string[];
  workingOn: string;
  offers: string[];
  asks: string[];
  summary: string;
  provider: AiProvider;
}

export interface IUpdateSettingsInput {
  attendeeId: string;
  settings?: Partial<IPlayerSettings>;
  topics?: string[];
  workingOn?: string;
  spotMe?: string;
  realName?: string;
  visible?: boolean;
}

export interface ICheckInInput {
  attendeeId: string;
  locationId: string;
  token: string;
  geo?: IGeoPoint;
}

export interface IScreenTokenInput {
  locationId: string;
}

export interface ISearchInput {
  query: string;
  attendeeId?: string;
  filters?: ISearchFilters;
  geo?: IGeoPoint;
  limit?: number;
}

export interface IRecommendTalksInput {
  attendeeId: string;
  limit?: number;
  withinMinutes?: number;
}

export interface IRecommendPeopleInput {
  attendeeId: string;
  hereOnly?: boolean;
  limit?: number;
}

export interface IRespondQuestInput {
  attendeeId: string;
  questId: string;
  response: QuestResponse;
  reason?: DeclineReason;
}

export interface IMakeQuestInput {
  attendeeId: string;
  targetKind: QuestTargetKind;
  targetId: string;
}

export interface IQuizForTalkInput {
  talkId: string;
  attendeeId?: string;
}

export interface ISubmitQuizInput {
  attendeeId: string;
  talkId: string;
  answers: number[];
  startedAt?: IsoDateString;
}

export interface IBossStateInput {
  talkId?: string;
  locationId?: string;
}

export interface IProposeMeetInput {
  attendeeId: string;
  partnerId: string;
}

export interface IRespondMeetInput {
  attendeeId: string;
  meetId: string;
  response: MeetResponse;
  blockPartner?: boolean;
}

export interface ILeaderboardInput {
  board?: LeaderboardBoard;
  period?: LeaderboardPeriod;
  attendeeId?: string;
  limit?: number;
}

export interface IWorldInput {
  attendeeId?: string;
}

export interface IOrganizerStatsInput {
  since?: IsoDateString;
}

export interface IListExhibitorsInput {
  query?: string;
  type?: ExhibitorType;
  tier?: string;
  zone?: string;
  topic?: Track;
  attendeeId?: string;
  limit?: number;
  offset?: number;
}

export interface IGetExhibitorInput {
  outpostId: string;
  attendeeId?: string;
}

export interface IExhibitorDashboardInput {
  outpostId: string;
  key: string;
}

export interface IAdminOverviewInput {
  key: string;
  since?: IsoDateString;
}

export interface IHandshakeCode {
  playerId: string;
  token: string;
  scanUrl: string;
  expiresAt: IsoDateString;
}

export interface IStartHandshakeInput {
  attendeeId: string;
  token: string;
}

export interface IHandshakeStateInput {
  attendeeId: string;
  handshakeId?: string;
}

export interface IAnswerHandshakeInput {
  attendeeId: string;
  handshakeId: string;
  answer: string;
}

export interface IHandshake {
  id: string;
  status: HandshakeStatus;
  role: HandshakeRole;
  statusLine: string;
  partner: IMatchPlayer;
  question: string;
  questionSource: HandshakeQuestionSource;
  questionReason?: string;
  iAnswered: boolean;
  partnerAnswered: boolean;
  attemptsLeft: number;
  expiresAt: IsoDateString;
  matchedAt?: IsoDateString;
  myAnswer?: string;
  theirAnswer?: string;
  xpAwarded?: number;
  meetId?: string;
}

export interface IHandshakeStateResult {
  handshake?: IHandshake;
}

export interface IBoothNote {
  id: string;
  locationId: string;
  boothName: string;
  boothNumber?: string;
  sponsorTier?: string;
  liked: string;
  thoughts?: string;
  followUp: boolean;
  xpAwarded: number;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface ISaveBoothNoteInput {
  attendeeId: string;
  locationId: string;
  liked: string;
  thoughts?: string;
  followUp?: boolean;
}

export interface ISaveBoothNoteResult {
  note: IBoothNote;
  xpAwarded: number;
  message: string;
  levelUp?: ILevelProgress;
  newBanners: IBannerProgress[];
}

export interface IBoothPhotoUploader {
  publicId: string;
  handle: string;
  faceSeed: string;
}

export interface IBoothPhoto {
  id: string;
  locationId: string;
  boothName: string;
  url: string;
  width: number;
  height: number;
  caption?: string;
  uploader: IBoothPhotoUploader;
  createdAt: IsoDateString;
  mine?: boolean;
}

export interface IUploadBoothPhotoInput {
  attendeeId: string;
  locationId: string;
  image: string;
  caption?: string;
}

export interface IUploadBoothPhotoResult {
  photo: IBoothPhoto;
  xp: number;
  questCompleted: boolean;
  message: string;
  levelUp?: ILevelProgress;
  newBanners: IBannerProgress[];
}

export interface IListBoothPhotosInput {
  locationId: string;
  attendeeId?: string;
  limit?: number;
}

export interface IBoothPhotoList {
  locationId: string;
  photos: IBoothPhoto[];
  count: number;
}

export interface IBoothPhotoActionInput {
  attendeeId: string;
  photoId: string;
}

export interface IReportBoothPhotoResult {
  photoId: string;
  reports: number;
  hidden: boolean;
  message: string;
}

export interface IDeleteBoothPhotoResult {
  photoId: string;
  deleted: boolean;
}

export interface IMessage {
  id: string;
  meetId: string;
  fromMe: boolean;
  text: string;
  at: IsoDateString;
}

export interface ISendMessageInput {
  attendeeId: string;
  meetId: string;
  text: string;
}

export interface INotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  createdAt: IsoDateString;
  readAt: IsoDateString | null;
}

export interface IListNotificationsInput {
  attendeeId: string;
  limit?: number;
}

export interface IListNotificationsResult {
  items: INotification[];
  unread: number;
}

export interface IMarkNotificationsReadInput {
  attendeeId: string;
  ids?: string[];
  all?: boolean;
}

export interface IMarkNotificationsReadResult {
  marked: number;
  unread: number;
}

export interface IListMessagesInput {
  attendeeId: string;
  meetId: string;
  since?: IsoDateString;
}

export interface IRecapTalk {
  talkId: string;
  title: string;
  room: string;
  at: IsoDateString;
  quizCorrect?: number;
  quizTotal?: number;
}

export interface IRecapPerson {
  playerId: string;
  handle: string;
  faceSeed: string;
  metAt: IsoDateString;
  question?: string;
  theirAnswer?: string;
  sharedTopics: string[];
  githubLogin?: string;
  nextStep: string;
}

export interface IRecapBooth {
  locationId: string;
  name: string;
  boothNumber?: string;
  liked: string;
  thoughts?: string;
  followUp: boolean;
  nextStep: string;
}

export interface IRecapTotals {
  xp: number;
  talks: number;
  people: number;
  booths: number;
  quizCorrect: number;
}

export interface IRecap {
  player: IPublicPlayer;
  generatedAt: IsoDateString;
  totals: IRecapTotals;
  talks: IRecapTalk[];
  people: IRecapPerson[];
  booths: IRecapBooth[];
  nextSteps: string[];
  emailSubject: string;
  emailHtml: string;
}

export interface IItineraryEntry {
  talkId: string;
  addedAt: IsoDateString;
}

export interface IScheduleSession {
  id: string;
  title: string;
  speakers: string[];
  sessionType: SessionType;
  track: Track;
  material: Material;
  start: IsoDateString;
  end: IsoDateString;
  locationId: string;
  building: string;
  level: string;
  room: string;
  isBoss: boolean;
  checkedInCount: number;
  inItinerary?: boolean;
}

export interface IScheduleSlot {
  start: IsoDateString;
  end: IsoDateString;
  sessions: IScheduleSession[];
}

export interface IListScheduleInput {
  attendeeId?: string;
  day?: string;
  from?: IsoDateString;
  to?: IsoDateString;
  track?: Track;
  building?: string;
  query?: string;
}

export interface ISchedule {
  day: string;
  days: string[];
  now: IsoDateString;
  from: IsoDateString;
  to: IsoDateString;
  total: number;
  buildings: string[];
  slots: IScheduleSlot[];
}

export interface IGetItineraryInput {
  attendeeId: string;
  day?: string;
}

export interface IItineraryChangeInput {
  attendeeId: string;
  talkId: string;
}

export interface IPlanItem {
  id: string;
  kind: ItineraryItemKind;
  title: string;
  start: IsoDateString;
  end?: IsoDateString;
  place?: IQuestPlace;
  walkMinutes?: number;
  walkFrom?: string;
  gapMinutes?: number;
  conflictsWith: string[];
  talkId?: string;
  questId?: string;
  meetId?: string;
  session?: IScheduleSession;
  quizAvailable?: boolean;
  isNow?: boolean;
}

export interface IItinerary {
  now: IsoDateString;
  day?: string;
  plannedCount: number;
  maxItems: number;
  conflictCount: number;
  items: IPlanItem[];
}

export interface IItineraryChangeResult {
  talkId: string;
  inItinerary: boolean;
  plannedCount: number;
  maxItems: number;
}

export interface IToolContracts {
  sign_in: { input: ISignInInput; output: ISignInResult };
  sign_up: { input: ISignUpInput; output: ISignUpResult };
  get_profile: { input: IAttendeeInput; output: IProfile };
  update_settings: { input: IUpdateSettingsInput; output: IProfile };
  check_in: { input: ICheckInInput; output: ICheckInResult };
  screen_token: { input: IScreenTokenInput; output: IScreenToken };
  demo_scan_token: { input: IScreenTokenInput; output: IDemoScanToken };
  whats_around_me: { input: IAttendeeInput; output: IWhatsAroundMe };
  whats_next: { input: IAttendeeInput; output: IWhatsNext };
  search: { input: ISearchInput; output: ISearchResponse };
  recommend_talks: { input: IRecommendTalksInput; output: ITalkMatch[] };
  recommend_people: { input: IRecommendPeopleInput; output: IPersonMatch[] };
  quest_board: { input: IAttendeeInput; output: IQuestBoard };
  respond_quest: { input: IRespondQuestInput; output: IRespondQuestResult };
  make_quest: { input: IMakeQuestInput; output: IQuest };
  quiz_for_talk: { input: IQuizForTalkInput; output: IQuiz };
  submit_quiz: { input: ISubmitQuizInput; output: IQuizResult };
  boss_state: { input: IBossStateInput; output: IBossState };
  propose_meet: { input: IProposeMeetInput; output: IMeet };
  respond_meet: { input: IRespondMeetInput; output: IRespondMeetResult };
  list_meets: { input: IAttendeeInput; output: IMeet[] };
  pending_meet_requests: { input: IAttendeeInput; output: IPendingMeetRequests };
  leaderboard: { input: ILeaderboardInput; output: ILeaderboard };
  inventory: { input: IAttendeeInput; output: IInventory };
  world: { input: IWorldInput; output: IWorld };
  organizer_stats: { input: IOrganizerStatsInput; output: IOrganizerStats };
  list_exhibitors: { input: IListExhibitorsInput; output: IExhibitorDirectory };
  get_exhibitor: { input: IGetExhibitorInput; output: IExhibitorPage };
  exhibitor_dashboard: { input: IExhibitorDashboardInput; output: IExhibitorDashboard };
  admin_overview: { input: IAdminOverviewInput; output: IAdminOverview };
  handshake_code: { input: IAttendeeInput; output: IHandshakeCode };
  start_handshake: { input: IStartHandshakeInput; output: IHandshake };
  handshake_state: { input: IHandshakeStateInput; output: IHandshakeStateResult };
  answer_handshake: { input: IAnswerHandshakeInput; output: IHandshake };
  save_booth_note: { input: ISaveBoothNoteInput; output: ISaveBoothNoteResult };
  list_booth_notes: { input: IAttendeeInput; output: IBoothNote[] };
  upload_booth_photo: { input: IUploadBoothPhotoInput; output: IUploadBoothPhotoResult };
  list_booth_photos: { input: IListBoothPhotosInput; output: IBoothPhotoList };
  report_booth_photo: { input: IBoothPhotoActionInput; output: IReportBoothPhotoResult };
  delete_booth_photo: { input: IBoothPhotoActionInput; output: IDeleteBoothPhotoResult };
  send_message: { input: ISendMessageInput; output: IMessage };
  list_messages: { input: IListMessagesInput; output: IMessage[] };
  recap: { input: IAttendeeInput; output: IRecap };
  import_profile: { input: IImportProfileInput; output: IImportedProfile };
  list_notifications: { input: IListNotificationsInput; output: IListNotificationsResult };
  mark_notifications_read: { input: IMarkNotificationsReadInput; output: IMarkNotificationsReadResult };
  list_schedule: { input: IListScheduleInput; output: ISchedule };
  get_itinerary: { input: IGetItineraryInput; output: IItinerary };
  add_to_itinerary: { input: IItineraryChangeInput; output: IItineraryChangeResult };
  remove_from_itinerary: { input: IItineraryChangeInput; output: IItineraryChangeResult };
}

export interface IToolInfo {
  name: ToolName;
  description: string;
  awardsXp: boolean;
  inputSchema: unknown;
}

export interface IApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface IClientConfig {
  appVersion: string;
  publicBaseUrl: string;
  conferenceTimeZone: string;
  demoSimulateScans: boolean;
  traceUrlTemplate?: string;
  rum?: {
    endpoint: string;
    authToken: string;
  };
}
