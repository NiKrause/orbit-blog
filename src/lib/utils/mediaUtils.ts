import type { UnixFS } from '@helia/unixfs';
import { error } from './logger'

export async function getImageUrlFromHelia(cid: string, fs: UnixFS | null): Promise<string> {
  console.log('getImageUrlFromHelia', cid, fs);
  if (!cid || !fs) return '';
  
  try {
    console.log('Getting image data from Helia for CID:', cid);
    const chunks = [];
    for await (const chunk of fs.cat(cid)) {
      chunks.push(chunk);
    }
    const blob = new Blob(chunks, { type: 'image/jpeg' }); // You might want to make the type configurable
    const url = URL.createObjectURL(blob);
    console.log('Created blob URL:', url);
    return url;
  } catch (error) {
    error('Error getting image URL from Helia:', error);
    return '';
  }
}

// Optional: Add a cleanup function for blob URLs
export function revokeImageUrl(url: string) {
  if (url) {
    URL.revokeObjectURL(url);
  }
} 