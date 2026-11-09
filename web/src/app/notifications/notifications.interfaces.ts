import { IListNotificationsResult } from '../core/api.types';

export interface INotificationSnapshot {
  attendeeId: string | null;
  result: IListNotificationsResult;
}
