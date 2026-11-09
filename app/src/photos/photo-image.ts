import { ToolError } from '../tools/tool-errors';
import { gameRules } from '../types/kubequest.constants';

export interface IDecodedPhoto {
  mimeType: string;
  base64: string;
  bytes: number;
  width: number;
  height: number;
}

interface ISize {
  width: number;
  height: number;
}

const dataUrlPattern = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;
const jpegSofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function jpegSize(buffer: Buffer): ISize | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return undefined;
  }

  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1] ?? 0;

    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }

    const length = buffer.readUInt16BE(offset + 2);

    if (jpegSofMarkers.has(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }

    offset += 2 + length;
  }

  return undefined;
}

function pngSize(buffer: Buffer): ISize | undefined {
  const signature = '89504e470d0a1a0a';

  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== signature || buffer.subarray(12, 16).toString('ascii') !== 'IHDR') {
    return undefined;
  }

  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function webpSize(buffer: Buffer): ISize | undefined {
  if (buffer.length < 30 || buffer.subarray(0, 4).toString('ascii') !== 'RIFF' || buffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
    return undefined;
  }

  const chunk = buffer.subarray(12, 16).toString('ascii');

  if (chunk === 'VP8X') {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }

  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);

    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }

  if (chunk === 'VP8 ') {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }

  return undefined;
}

const sizeReaders: Record<string, (buffer: Buffer) => ISize | undefined> = {
  'image/jpeg': jpegSize,
  'image/png': pngSize,
  'image/webp': webpSize,
};

export function decodePhoto(dataUrl: string): IDecodedPhoto {
  const match = dataUrlPattern.exec(dataUrl.trim());

  if (!match || !match[1] || !match[2]) {
    throw new ToolError(415, 'unsupported_image', 'Send the photo as a JPEG, PNG or WebP image.');
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');

  if (buffer.length > gameRules.PHOTO_MAX_BYTES) {
    throw new ToolError(413, 'image_too_large', 'That photo is too large. Try again; the app shrinks it before sending.');
  }

  const reader = sizeReaders[mimeType];
  const size = reader ? reader(buffer) : undefined;

  if (!size || size.width < 1 || size.height < 1) {
    throw new ToolError(415, 'unsupported_image', 'That file is not a readable JPEG, PNG or WebP image.');
  }

  if (Math.max(size.width, size.height) > gameRules.PHOTO_MAX_EDGE) {
    throw new ToolError(413, 'image_too_large', `That photo is bigger than ${gameRules.PHOTO_MAX_EDGE} pixels on its long edge.`);
  }

  return { mimeType, base64: buffer.toString('base64'), bytes: buffer.length, width: size.width, height: size.height };
}
