import {
  AiTransportError,
  AI_JOB_ERROR_KEYS,
  mapHttpStatusToAiJobErrorKey,
} from './aiJobErrors.js';
import type {
  AiFetchResultInput,
  AiFetchResultOutput,
  AiHttpTransport,
  AiHttpTransportOptions,
  AiJobLifecycleStatus,
  AiPollStatusInput,
  AiPollStatusResult,
  AiSubmitJobInput,
  AiSubmitJobResult,
} from './types.js';

/** Atlas Cloud queue API (see https://www.atlascloud.ai/docs/models/video). */
const GENERATE_VIDEO_PATH = '/api/v1/model/generateVideo';
const GET_RESULT_PATH = '/api/v1/model/getResult';

function resolveAgainstBase(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  return new URL(path, `${base}/`).toString();
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { _parseError: true };
  }
}

function mapAtlasStatusToLifecycle(raw: string): AiJobLifecycleStatus {
  const s = raw.toLowerCase();
  if (s === 'completed' || s === 'succeeded' || s === 'success') return 'succeeded';
  if (s === 'failed' || s === 'error') return 'failed';
  if (s === 'queued' || s === 'pending' || s === 'waiting') return 'queued';
  return 'running';
}

function extractPredictionId(json: Record<string, unknown>): string | undefined {
  const id =
    json.predictionId ?? json.prediction_id ?? json.id ?? json.jobId ?? json.job_id;
  return id !== undefined && id !== null ? String(id) : undefined;
}

function extractOutputUrl(json: Record<string, unknown>): string | undefined {
  const out = json.output ?? json.data;
  if (typeof out === 'string') return out;
  if (out && typeof out === 'object') {
    const o = out as Record<string, unknown>;
    const u = o.url ?? o.video_url ?? o.assetUrl ?? o.href;
    if (typeof u === 'string') return u;
  }
  return undefined;
}

/**
 * Atlas Cloud `fetch`-based {@link AiHttpTransport}.
 * Uses `Authorization: Bearer <apiKey>` and JSON bodies per Atlas docs.
 */
export class FetchAiHttpTransport implements AiHttpTransport {
  async submitJob(
    input: AiSubmitJobInput,
    options?: AiHttpTransportOptions,
  ): Promise<AiSubmitJobResult> {
    const baseUrl = options?.baseUrl?.trim();
    const apiKey = options?.apiKey;
    if (!baseUrl || !apiKey) {
      throw new AiTransportError(AI_JOB_ERROR_KEYS.unknown);
    }
    const url = resolveAgainstBase(baseUrl, GENERATE_VIDEO_PATH);
    const payload = { model: input.model, ...input.body };
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new AiTransportError(AI_JOB_ERROR_KEYS.network);
    }
    if (res.type === 'opaque') {
      throw new AiTransportError(AI_JOB_ERROR_KEYS.corsOrBlocked);
    }
    if (!res.ok) {
      throw new AiTransportError(mapHttpStatusToAiJobErrorKey(res.status));
    }
    const json = (await parseJsonSafe(res)) as Record<string, unknown>;
    const jobId = extractPredictionId(json);
    if (!jobId) {
      throw new AiTransportError(AI_JOB_ERROR_KEYS.badResponse);
    }
    return { jobId, raw: json };
  }

  async pollStatus(
    input: AiPollStatusInput,
    options?: AiHttpTransportOptions,
  ): Promise<AiPollStatusResult> {
    const baseUrl = options?.baseUrl?.trim();
    const apiKey = options?.apiKey;
    if (!baseUrl || !apiKey) {
      throw new AiTransportError(AI_JOB_ERROR_KEYS.unknown);
    }
    const u = new URL(resolveAgainstBase(baseUrl, GET_RESULT_PATH));
    u.searchParams.set('predictionId', input.jobId);
    const url = u.toString();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch {
      throw new AiTransportError(AI_JOB_ERROR_KEYS.network);
    }
    if (res.type === 'opaque') {
      throw new AiTransportError(AI_JOB_ERROR_KEYS.corsOrBlocked);
    }
    if (!res.ok) {
      throw new AiTransportError(mapHttpStatusToAiJobErrorKey(res.status));
    }
    const json = (await parseJsonSafe(res)) as Record<string, unknown>;
    const rawStatus =
      typeof json.status === 'string' ? json.status : String(json.status ?? 'running');
    const status = mapAtlasStatusToLifecycle(rawStatus);
    return { status, raw: json };
  }

  async fetchResult(
    input: AiFetchResultInput,
    options?: AiHttpTransportOptions,
  ): Promise<AiFetchResultOutput> {
    const baseUrl = options?.baseUrl?.trim();
    const apiKey = options?.apiKey;
    if (!baseUrl || !apiKey) {
      throw new AiTransportError(AI_JOB_ERROR_KEYS.unknown);
    }
    const u = new URL(resolveAgainstBase(baseUrl, GET_RESULT_PATH));
    u.searchParams.set('predictionId', input.jobId);
    const url = u.toString();
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch {
      throw new AiTransportError(AI_JOB_ERROR_KEYS.network);
    }
    if (res.type === 'opaque') {
      throw new AiTransportError(AI_JOB_ERROR_KEYS.corsOrBlocked);
    }
    if (!res.ok) {
      throw new AiTransportError(mapHttpStatusToAiJobErrorKey(res.status));
    }
    const json = (await parseJsonSafe(res)) as Record<string, unknown>;
    const assetUrl = extractOutputUrl(json);
    return { assetUrl, raw: json };
  }
}
