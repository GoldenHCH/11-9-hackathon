import { IConnection, ITalkNote } from '../types/connections.interfaces';
import { IPublicPlayer, IRecapBooth, IRecapTotals } from '../types/kubequest.interfaces';

export interface IRecapPdfTalk {
  talkId: string;
  title: string;
  room?: string;
  at?: string;
  speakers: string[];
  quizCorrect?: number;
  quizTotal?: number;
  note?: ITalkNote;
}

export interface IRecapPdfItineraryItem {
  title: string;
  when?: string;
  where?: string;
}

export interface IRecapPdfData {
  player: IPublicPlayer;
  realName?: string;
  faceSeed: string;
  totals: IRecapTotals;
  connections: IConnection[];
  talks: IRecapPdfTalk[];
  booths: IRecapBooth[];
  itinerary: IRecapPdfItineraryItem[];
  nextSteps: string[];
  generatedAt: string;
}
