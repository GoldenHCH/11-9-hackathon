export interface ISponsorKpi {
  label: string;
  value: string;
  detail: string;
  icon: string;
}

export interface ISponsorPackageItem {
  label: string;
  detail: string;
  price?: string;
}

export interface ISponsorDayVisits {
  day: string;
  included: number;
  boosted: number;
}

export interface ISponsorFunnelStep {
  label: string;
  value: number;
}

export interface ISponsorAuctionRow {
  sponsor: string;
  isYou: boolean;
  maxBid: number;
  relevance: number;
  slotWon?: number;
  pricePaid?: number;
}

export interface ISponsorTouchPoint {
  label: string;
  icon: string;
  share: number;
}

export interface ISponsorStory {
  role: string;
  faceSeed: string;
  goal: string;
  noteOnYou: string;
  noteOnCompetitor: string;
  competitor: string;
  whyYou: string;
  daysToClose: number;
  dealSize: string;
  attribution: 'Strong' | 'Medium';
  path: string[];
}

export interface ISponsorWeek {
  week: number;
  deals: number;
}
