export type {
  IBoothPhoto,
  IBoothPhotoList,
  IDeleteBoothPhotoResult,
  IReportBoothPhotoResult,
  IUploadBoothPhotoResult,
} from '../../../../app/src/types/kubequest.interfaces';

export type PhotoCaptureStep = 'idle' | 'preparing' | 'preview' | 'uploading' | 'done';
