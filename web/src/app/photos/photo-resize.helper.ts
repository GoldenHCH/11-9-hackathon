import { photoFallbackQuality, photoJpegQuality, photoMaxEdge, photoTargetBytes } from './photos.constants';

export interface IResizedPhoto {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not an image we can read.'));
    };
    image.src = url;
  });
}

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);

  return Math.floor((base64.length * 3) / 4);
}

export class PhotoResizeHelper {
  public static async resize(file: File): Promise<IResizedPhoto> {
    const image = await loadImage(file);
    const scale = Math.min(1, photoMaxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('This browser cannot resize photos.');
    }

    context.drawImage(image, 0, 0, width, height);
    let dataUrl = canvas.toDataURL('image/jpeg', photoJpegQuality);

    if (dataUrlBytes(dataUrl) > photoTargetBytes) {
      dataUrl = canvas.toDataURL('image/jpeg', photoFallbackQuality);
    }

    return { dataUrl, width, height, bytes: dataUrlBytes(dataUrl) };
  }
}
