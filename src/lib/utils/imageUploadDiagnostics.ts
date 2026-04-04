import { mediaLog } from './logger.js';

export type ImageUploadSource =
  | 'AiImageField'
  | 'MediaUploader'
  | 'SettingsProfilePicture';

export interface ImageUploadMediaRecord {
  _id: string;
  cid: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
}

/**
 * Browser-console-friendly trace for the media pipeline: IPFS block then mediaDB document.
 */
export function logImageUploadIpfsStored(
  source: ImageUploadSource,
  detail: { name: string; type: string; size: number; cid: string; bytesOnWire: number },
): void {
  mediaLog.info(`[image upload] ${source} — IPFS block added`, detail);
}

export function logImageUploadMediaDbRegistered(
  source: ImageUploadSource,
  detail: {
    record: ImageUploadMediaRecord;
    mediaDbAddress?: string;
  },
): void {
  mediaLog.info(`[image upload] ${source} — mediaDB.put complete`, detail);
}
