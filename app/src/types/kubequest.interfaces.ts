import {
  AiProvider,
  BannerId,
  BossStatus,
  CheckInRejection,
  CheckInStatus,
  DeclineReason,
  HandshakeQuestionSource,
  HandshakeRole,
  HandshakeStatus,
  IsoDateString,
  ItineraryItemKind,
  LeaderboardBoard,
  LeaderboardPeriod,
  LocationKind,
  Material,
  MaterialCounts,
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

export interface IToolContracts {
  sign_in: { input: ISignInInput; output: ISignInResult };
  sign_up: { input: ISignUpInput; output: ISignUpResult };
  get_profile: { input: IAttendeeInput; output: IProfile };
  update_settings: { input: IUpdateSettingsInput; output: IProfile };
  check_in: { input: ICheckInInput; output: ICheckInResult };
  screen_token: { input: IScreenTokenInput; output: IScreenToken };
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
  leaderboard: { input: ILeaderboardInput; output: ILeaderboard };
  inventory: { input: IAttendeeInput; output: IInventory };
  world: { input: IWorldInput; output: IWorld };
  organizer_stats: { input: IOrganizerStatsInput; output: IOrganizerStats };
  handshake_code: { input: IAttendeeInput; output: IHandshakeCode };
  start_handshake: { input: IStartHandshakeInput; output: IHandshake };
  handshake_state: { input: IHandshakeStateInput; output: IHandshakeStateResult };
  answer_handshake: { input: IAnswerHandshakeInput; output: IHandshake };
  save_booth_note: { input: ISaveBoothNoteInput; output: ISaveBoothNoteResult };
  list_booth_notes: { input: IAttendeeInput; output: IBoothNote[] };
  send_message: { input: ISendMessageInput; output: IMessage };
  list_messages: { input: IListMessagesInput; output: IMessage[] };
  recap: { input: IAttendeeInput; output: IRecap };
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
  traceUrlTemplate?: string;
  rum?: {
    endpoint: string;
    authToken: string;
  };
}
