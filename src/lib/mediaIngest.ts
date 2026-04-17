import { unixfs } from '@helia/unixfs';
import { MEDIA_MAX_FILE_SIZE_BYTES } from './mediaConfig.js';

/** i18n keys for ingest failures (FR-8, Story 5.2). */
export const AI_INGEST_ERROR_KEYS = {
  network: 'ai_ingest_error_network',
  corsOrBlocked: 'ai_ingest_error_cors_or_blocked',
  http: 'ai_ingest_error_http',
  tooLarge: 'ai_ingest_error_too_large',
} as const;

export class AiIngestError extends Error {
  constructor(public readonly i18nKey: string) {
    super(i18nKey);
    this.name = 'AiIngestError';
  }
}

export interface IngestRemoteVideoParams {
  assetUrl: string;
  mediaDB: { put: (doc: unknown) => Promise<unknown> };
  helia: unknown;
  /** Default from `VITE_MEDIA_MAX_FILE_SIZE_MB` (100 MB fallback). */
  maxBytes?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Downloads a remote video URL, stores bytes on IPFS, and writes a `mediaDB` document
 * matching the shape used by `MediaUploader` / `AiImageField`.
 */
export async function ingestRemoteVideoToMedia(
  params: IngestRemoteVideoParams,
): Promise<{ cid: string; mediaId: string; createdAt: string }> {
  const maxBytes = params.maxBytes ?? MEDIA_MAX_FILE_SIZE_BYTES;
  const fetchImpl = params.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await fetchImpl(params.assetUrl, { mode: 'cors' });
  } catch {
    throw new AiIngestError(AI_INGEST_ERROR_KEYS.network);
  }
  if (res.type === 'opaque') {
    throw new AiIngestError(AI_INGEST_ERROR_KEYS.corsOrBlocked);
  }
  if (!res.ok) {
    throw new AiIngestError(AI_INGEST_ERROR_KEYS.http);
  }
  const cl = res.headers.get('Content-Length');
  if (cl) {
    const n = parseInt(cl, 10);
    if (!Number.isNaN(n) && n > maxBytes) {
      throw new AiIngestError(AI_INGEST_ERROR_KEYS.tooLarge);
    }
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new AiIngestError(AI_INGEST_ERROR_KEYS.tooLarge);
  }
  const ct = res.headers.get('Content-Type') ?? '';
  const type = ct.startsWith('video/')
    ? ct.split(';')[0].trim()
    : 'video/mp4';

  const fs = unixfs(params.helia as Parameters<typeof unixfs>[0]);
  const cid = await fs.addBytes(buf);
  const cidStr = cid.toString();
  const mediaId = crypto.randomUUID();
  const nameFromUrl = (() => {
    try {
      const u = new URL(params.assetUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1] || 'video.mp4';
      return last.includes('.') ? last : `${last}.mp4`;
    } catch {
      return 'generated-video.mp4';
    }
  })();

  const createdAt = new Date().toISOString();
  await params.mediaDB.put({
    _id: mediaId,
    name: nameFromUrl,
    type,
    size: buf.byteLength,
    cid: cidStr,
    createdAt,
  });

  return { cid: cidStr, mediaId, createdAt };
}
