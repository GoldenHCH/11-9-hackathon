import { IBarListItem } from '../../shared/components/bar-list/bar-list.interfaces';
import {
  ISponsorAuctionRow,
  ISponsorDayVisits,
  ISponsorFunnelStep,
  ISponsorKpi,
  ISponsorPackageItem,
  ISponsorStory,
  ISponsorTouchPoint,
  ISponsorWeek,
} from './sponsor.interfaces';

export const sponsorName = 'AWS';
export const sponsorTier = 'Platinum';

export const sponsorKpis: ISponsorKpi[] = [
  { label: 'Booth visits from quests', value: '2,910', detail: '1,020 from boosts', icon: 'flag' },
  { label: 'Booth notes written', value: '1,760', detail: '60% of visitors', icon: 'edit_note' },
  { label: 'Asked for follow-up', value: '520', detail: 'opted in, warm', icon: 'mark_email_read' },
  { label: 'Cost per booth visit', value: '$47.56', detail: '$138.4k total spend', icon: 'payments' },
  { label: 'Cost per sale', value: '$4,465', detail: '31 closed-won in 90 days', icon: 'sell' },
  { label: 'Attributed revenue', value: '$1.86M', detail: '13.4× return on spend', icon: 'trending_up' },
];

export const sponsorIncluded: ISponsorPackageItem[] = [
  { label: 'Quest slots', detail: '6 an hour, matched to attendees whose goals fit you' },
  { label: 'Booth QR and notes', detail: 'Every visitor’s takeaways land in your lead list' },
  { label: 'Recap email placement', detail: 'Your booth and next step in every visitor’s recap' },
  { label: 'One campfire', detail: 'A named meetup spot on the map for all 3 days' },
];

export const sponsorAddOns: ISponsorPackageItem[] = [
  { label: 'Quest boost', detail: 'Bid per booth visit for extra slots at peak hours', price: 'from $3 / visit' },
  { label: 'Talk follow-up quest', detail: 'Send attendees of your talk to the booth after', price: '$2,500 / talk' },
  { label: 'Sponsored campfire', detail: 'Host a themed meetup with a matched guest list', price: '$5,000 / day' },
  { label: 'Recap feature', detail: 'Top slot in the post-event recap email', price: '$7,500' },
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

export const sponsorAuctionContext = 'Day 3 · 2:00–3:00 pm · attendees whose goal mentions “platform engineering” · 3 quest slots';

export const sponsorAuction: ISponsorAuctionRow[] = [
  { sponsor: 'AWS', isYou: true, maxBid: 9.0, relevance: 0.92, slotWon: 1, pricePaid: 7.41 },
  { sponsor: 'Cloud vendor B', isYou: false, maxBid: 11.0, relevance: 0.62, slotWon: 2, pricePaid: 8.39 },
  { sponsor: 'Cloud vendor C', isYou: false, maxBid: 6.5, relevance: 0.8, slotWon: 3, pricePaid: 4.5 },
  { sponsor: 'Observability vendor D', isYou: false, maxBid: 8.0, relevance: 0.45 },
];

export const sponsorTouchPoints: ISponsorTouchPoint[] = [
  { label: 'Quest sent them to your booth', icon: 'flag', share: 100 },
  { label: 'Wrote a booth note', icon: 'edit_note', share: 94 },
  { label: 'Went to your talk', icon: 'co_present', share: 61 },
  { label: 'Verified handshake with your staff', icon: 'handshake', share: 55 },
  { label: 'Opened the recap email', icon: 'mail', share: 87 },
  { label: 'Booked a call from the recap', icon: 'event_available', share: 48 },
];

export const sponsorAverageTouchPoints = 6.4;

export const sponsorReasons: IBarListItem[] = [
  { label: 'Pricing was clear and cheaper for their workload', value: 38 },
  { label: 'Managed service fit (less to run themselves)', value: 27 },
  { label: 'Talked to an AWS engineer in person', value: 19 },
  { label: 'Compliance and data region answered on the spot', value: 10 },
  { label: 'Already on AWS, wanted to go deeper', value: 6 },
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
