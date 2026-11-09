export type { IClientConfig, ILeaderboard, ILeaderboardRow, IWorld } from '../../../../app/src/types/kubequest.interfaces';

export interface IScreenToken {
  locationId: string;
  token: string;
  expiresAt: string;
  scanUrl: string;
}
