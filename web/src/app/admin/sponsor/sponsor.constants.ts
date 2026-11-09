import { IBarListItem } from '../../shared/components/bar-list/bar-list.interfaces';
import {
  ISponsorAuctionRow,
  ISponsorDayVisits,
  ISponsorFunnelStep,
  ISponsorKpi,
  ISponsorPackageItem,
  ISponsorRequestOption,
  ISponsorStory,
  ISponsorTouchPoint,
  ISponsorWeek,
} from './sponsor.interfaces';

export const sponsorTabs = [
  { path: '/admin/sponsor', label: 'Insights', icon: 'insights' },
  { path: '/admin/sponsor/why', label: 'Why it works', icon: 'lightbulb' },
] as const;

export const sponsorName = 'AWS';
export const sponsorTier = 'Platinum';

export const sponsorKpis: ISponsorKpi[] = [
  { label: 'Booth visits', value: '2,910', detail: '1,020 boosted', icon: 'flag' },
  { label: 'Notes', value: '1,760', detail: '60% of visits', icon: 'edit_note' },
  { label: 'Follow-ups', value: '520', detail: 'opted in', icon: 'mark_email_read' },
  { label: 'Cost / visit', value: '$47.56', detail: '$138.4k spend', icon: 'payments' },
  { label: 'Cost / sale', value: '$4,465', detail: '31 deals, 90 days', icon: 'sell' },
  { label: 'Revenue', value: '$1.86M', detail: '13.4× ROI', icon: 'trending_up' },
];

export const sponsorIncluded: ISponsorPackageItem[] = [
  { label: 'Quest slots', detail: '6 an hour, goal-matched' },
  { label: 'Booth QR and notes', detail: 'Takeaways go to your lead list' },
  { label: 'Recap placement', detail: 'In every visitor’s recap email' },
  { label: 'One campfire', detail: 'Meetup spot, all 3 days' },
];

export const sponsorAddOns: ISponsorPackageItem[] = [
  { label: 'Quest boost', detail: 'Extra slots at peak hours', price: 'from $3 / visit' },
  { label: 'Talk follow-up quest', detail: 'Talk audience → your booth', price: '$2,500 / talk' },
  { label: 'Sponsored campfire', detail: 'Themed meetup, matched guests', price: '$5,000 / day' },
  { label: 'Recap feature', detail: 'Top slot in the recap email', price: '$7,500' },
];

export const sponsorDailyVisits: ISponsorDayVisits[] = [
  { day: 'Day 1', included: 640, boosted: 210 },
  { day: 'Day 2', included: 650, boosted: 360 },
  { day: 'Day 3', included: 600, boosted: 450 },
];

export const sponsorFunnel: ISponsorFunnelStep[] = [
  { label: 'Quest shown', value: 14200 },
  { label: 'Quest accepted', value: 4380 },
  { label: 'Arrived at the booth', value: 2910 },
  { label: 'Wrote a booth note', value: 1760 },
  { label: 'Asked for a follow-up', value: 520 },
  { label: 'Opportunity opened', value: 118 },
  { label: 'Closed-won (90 days)', value: 31 },
];

export const sponsorAuctionContext = 'Day 3 · 2–3 pm · goal: platform engineering · 3 slots';

export const sponsorAuction: ISponsorAuctionRow[] = [
  { sponsor: 'AWS', isYou: true, maxBid: 9.0, relevance: 0.92, slotWon: 1, pricePaid: 7.41 },
  { sponsor: 'Cloud vendor B', isYou: false, maxBid: 11.0, relevance: 0.62, slotWon: 2, pricePaid: 8.39 },
  { sponsor: 'Cloud vendor C', isYou: false, maxBid: 6.5, relevance: 0.8, slotWon: 3, pricePaid: 4.5 },
  { sponsor: 'Observability vendor D', isYou: false, maxBid: 8.0, relevance: 0.45 },
];

export const sponsorTouchPoints: ISponsorTouchPoint[] = [
  { label: 'Quest to your booth', icon: 'flag', share: 100 },
  { label: 'Wrote a booth note', icon: 'edit_note', share: 94 },
  { label: 'Went to your talk', icon: 'co_present', share: 61 },
  { label: 'Handshake with staff', icon: 'handshake', share: 55 },
  { label: 'Opened the recap email', icon: 'mail', share: 87 },
  { label: 'Booked a call', icon: 'event_available', share: 48 },
];

export const sponsorAverageTouchPoints = 6.4;

export const sponsorReasons: IBarListItem[] = [
  { label: 'Clear, lower pricing', value: 38 },
  { label: 'Managed service fit', value: 27 },
  { label: 'Met an AWS engineer', value: 19 },
  { label: 'Compliance answered', value: 10 },
  { label: 'Already on AWS', value: 6 },
];

export const sponsorStories: ISponsorStory[] = [
  {
    role: 'Platform lead · fintech, 420 engineers',
    faceSeed: 'story-fintech',
    goal: 'Cut our EKS bill and stop hand-rolling node autoscaling.',
    noteOnYou: 'Karpenter demo on spot was exactly our problem. They showed consolidation savings on a workload shaped like ours.',
    competitor: 'Cloud vendor B',
    noteOnCompetitor: 'Nice console, but autoscaling needed a third-party tool.',
    whyYou: 'Karpenter plus Savings Plans, and the engineer they met through a handshake ran the proof of concept.',
    daysToClose: 34,
    dealSize: '$186k ARR',
    attribution: 'Strong',
    path: ['Quest', 'Booth note', 'Handshake', 'Recap click', 'POC', 'Closed'],
  },
  {
    role: 'SRE manager · healthcare SaaS',
    faceSeed: 'story-health',
    goal: 'Find managed observability that keeps patient data in one region.',
    noteOnYou: 'Managed Prometheus and Grafana, data stays in us-west-2. Answered our compliance question in two minutes.',
    competitor: 'Observability vendor D',
    noteOnCompetitor: 'Strong tracing, but couldn’t promise region pinning.',
    whyYou: 'Region pinning and a signed BAA, confirmed at the booth instead of after three sales calls.',
    daysToClose: 58,
    dealSize: '$92k ARR',
    attribution: 'Strong',
    path: ['Quest', 'Talk', 'Booth note', 'Recap click', 'Closed'],
  },
  {
    role: 'Staff engineer · retail',
    faceSeed: 'story-retail',
    goal: 'Schedule GPUs for ML inference on Kubernetes without wasting them.',
    noteOnYou: 'Inferentia pricing next to GPUs was eye-opening. Want a benchmark on our model.',
    competitor: 'Cloud vendor C',
    noteOnCompetitor: 'Great GPU availability talk, pricing unclear.',
    whyYou: 'The benchmark came back 40% cheaper per inference. Their account team was already talking to them.',
    daysToClose: 71,
    dealSize: '$240k ARR',
    attribution: 'Medium',
    path: ['Talk', 'Quest', 'Booth note', 'Benchmark', 'Closed'],
  },
];

export const sponsorWeeks: ISponsorWeek[] = [
  { week: 1, deals: 0 },
  { week: 2, deals: 1 },
  { week: 3, deals: 2 },
  { week: 4, deals: 3 },
  { week: 5, deals: 5 },
  { week: 6, deals: 4 },
  { week: 7, deals: 3 },
  { week: 8, deals: 4 },
  { week: 9, deals: 3 },
  { week: 10, deals: 2 },
  { week: 11, deals: 2 },
  { week: 12, deals: 1 },
  { week: 13, deals: 1 },
];

export const sponsorRequestOptions: ISponsorRequestOption[] = [
  { key: 'talkQuest', label: 'Talk follow-up quest', unitLabel: 'talks', unitPrice: 2500, max: 5, icon: 'co_present' },
  { key: 'campfire', label: 'Sponsored campfire', unitLabel: 'days', unitPrice: 5000, max: 3, icon: 'local_fire_department' },
  { key: 'recapFeature', label: 'Recap feature', unitLabel: 'slot', unitPrice: 7500, max: 1, icon: 'mail' },
];

export const sponsorRequestDefaults = {
  boostBid: 9,
  boostVisits: 500,
  talkQuest: 1,
  campfire: 0,
  recapFeature: 0,
};

export const sponsorBoostVisitLimits = { min: 50, max: 3000 };
export const sponsorBoostBidLimits = { min: 3, max: 50 };
