import { IRecap } from '../types/kubequest.interfaces';

export type RecapContent = Omit<IRecap, 'emailSubject' | 'emailHtml'>;
