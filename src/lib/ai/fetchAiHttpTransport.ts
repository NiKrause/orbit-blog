import {
  AiTransportError,
  AI_JOB_ERROR_KEYS,
  mapHttpStatusToAiJobErrorKey,
} from './aiJobErrors.js';
import { extractOutputText } from './aiFetchResultParse.js';
import { aiLog } from '../utils/logger.js';
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
const RESULT_BY_ID_PATH = '/api/v1/model/result';
const MAX_LOG_STRING_LENGTH = 4000;

type LoggedResponseBody = {
  json: unknown;
  text: string;
  parseError: boolean;
};

function resolveAgainstBase(baseUrl: string, path: string): string {
  const base = baseUrl.trim().replace(/\/+$/, '');
  return new URL(path, `${base}/`).toString();
}

function isVerboseAiLoggingEnabled(): boolean {
  return !Boolean(import.meta.env?.PROD);
}

function clipLogString(value: string, limit = MAX_LOG_STRING_LENGTH): string {
  if (value.length <= limit) return value;
  const hiddenChars = value.length - limit;
  return `${value.slice(0, limit)}... [truncated ${hiddenChars} chars]`;
}

function sanitizeUrlForLog(value: string): string {
  try {
    const url = new URL(value);
    const query = url.search ? '?<redacted>' : '';
    const hash = url.hash ? '#<redacted>' : '';
    return `${url.origin}${url.pathname}${query}${hash}`;
  } catch {
    return clipLogString(value, 240);
  }
}

function summarizeStringForLog(value: string, key?: string, verbose = isVerboseAiLoggingEnabled()): string {
  if (/^Bearer\s+/i.test(value)) return '[redacted]';
  if (/(authorization|api[_-]?key|token|secret|password)/i.test(key ?? '')) return '[redacted]';
  if (verbose) return clipLogString(value);
  if (/(prompt|caption|description|negative[_-]?prompt|output[_-]?text|text)$/i.test(key ?? '')) {
    return `[redacted:${value.length} chars]`;
  }
  if (/(url|uri|href)$/i.test(key ?? '')) {
    return sanitizeUrlForLog(value);
  }
  if (value.includes('\n') || value.length > 160) {
    return `[string:${value.length} chars]`;
  }
  return value;
}

export function sanitizeAiLogValue(
  value: unknown,
  options: { key?: string; verbose?: boolean } = {},
): unknown {
  const { key, verbose = isVerboseAiLoggingEnabled() } = options;
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return value;
  }
  if (typeof value === 'string') {
    return summarizeStringForLog(value, key, verbose);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAiLogValue(item, { key, verbose }));
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(verbose && value.stack ? { stack: clipLogString(value.stack) } : {}),
    };
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeAiLogValue(entryValue, { key: entryKey, verbose }),
      ]),
    );
  }
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getAtlasPayload(json: Record<string, unknown>): Record<string, unknown> {
  const nested = json.data;
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : json;
}

function getStringField(
  json: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = json[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function extractPredictionUrl(json: Record<string, unknown>): string | undefined {
  const sources = [getAtlasPayload(json), json];
  for (const source of sources) {
    const urls = asRecord(source.urls);
    const direct =
      getStringField(urls, ['get', 'result', 'poll', 'href', 'url']) ??
      getStringField(source, ['resultUrl', 'pollUrl']);
    if (direct) return direct;
  }
  return undefined;
}

function resolveResultUrl(
  baseUrl: string,
  input: { jobId: string; resultUrl?: string },
): string {
  const direct = input.resultUrl?.trim();
  if (direct) {
    return /^https?:\/\//i.test(direct)
      ? direct
      : new URL(direct.replace(/^\/+/, ''), `${baseUrl.replace(/\/+$/, '')}/`).toString();
  }
  return resolveAgainstBase(baseUrl, `${RESULT_BY_ID_PATH}/${encodeURIComponent(input.jobId)}`);
}

function extractUrlFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractUrlFromUnknown(item);
      if (found) return found;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      getStringField(record, ['url', 'video_url', 'assetUrl', 'href']) ??
      extractUrlFromUnknown(record.output) ??
      extractUrlFromUnknown(record.outputs)
    );
  }
  return undefined;
}

async function readResponseBodySafe(res: Response): Promise<LoggedResponseBody> {
  const text = await res.text();
  if (!text) {
    return {
      json: {},
      text: '',
      parseError: false,
    };
  }
  try {
    return {
      json: JSON.parse(text) as unknown,
      text,
      parseError: false,
    };
  } catch {
    return {
      json: { _parseError: true },
      text,
      parseError: true,
    };
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
  const payload = getAtlasPayload(json);
  const direct =
    getStringField(payload, ['predictionId', 'prediction_id', 'id', 'jobId', 'job_id']) ??
    getStringField(json, ['predictionId', 'prediction_id', 'id', 'jobId', 'job_id']);
  if (direct) return direct;
  const predictionUrl = extractPredictionUrl(json);
  if (!predictionUrl) return undefined;
  const parts = predictionUrl.split('/').filter(Boolean);
  return parts[parts.length - 1];
}

function extractOutputUrl(json: Record<string, unknown>): string | undefined {
  const payload = getAtlasPayload(json);
  return (
    extractUrlFromUnknown(payload.outputs) ??
    extractUrlFromUnknown(payload.output) ??
    extractUrlFromUnknown(json.outputs) ??
    extractUrlFromUnknown(json.output)
  );
}

function responseBodyForLog(body: LoggedResponseBody): unknown {
  if (!body.text) {
    return { _empty: true };
  }
  if (!body.parseError) {
    return sanitizeAiLogValue(body.json);
  }
  return {
    _parseError: true,
    text: sanitizeAiLogValue(body.text, { key: 'responseText' }),
  };
}

function serializeRequestLog(input: {
  operation: 'submitJob' | 'pollStatus' | 'fetchResult';
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: unknown;
}): Record<string, unknown> {
  return {
    operation: input.operation,
    method: input.method,
    url: sanitizeUrlForLog(input.url),
    headers: sanitizeAiLogValue(input.headers),
    ...(input.body !== undefined ? { body: sanitizeAiLogValue(input.body) } : {}),
  };
}

function serializeResponseLog(input: {
  operation: 'submitJob' | 'pollStatus' | 'fetchResult';
  url: string;
  response: Response;
  body: LoggedResponseBody;
}): Record<string, unknown> {
  return {
    operation: input.operation,
    url: sanitizeUrlForLog(input.url),
    status: input.response.status,
    ok: input.response.ok,
    type: input.response.type,
    contentType: input.response.headers.get('content-type') ?? '',
    body: responseBodyForLog(input.body),
  };
}

function serializeErrorLog(error: unknown): unknown {
  return sanitizeAiLogValue(error);
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
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
    aiLog.debug('AI transport submitJob request', serializeRequestLog({
      operation: 'submitJob',
      method: 'POST',
      url,
      headers,
      body: payload,
    }));
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (error) {
      aiLog.error('AI transport submitJob request failed', {
        operation: 'submitJob',
        url: sanitizeUrlForLog(url),
        error: serializeErrorLog(error),
      });
      throw new AiTransportError(AI_JOB_ERROR_KEYS.network);
    }
    if (res.type === 'opaque') {
      aiLog.error('AI transport submitJob received opaque response', {
        operation: 'submitJob',
        url: sanitizeUrlForLog(url),
      });
      throw new AiTransportError(AI_JOB_ERROR_KEYS.corsOrBlocked);
    }
    const responseBody = await readResponseBodySafe(res);
    aiLog.debug('AI transport submitJob response', serializeResponseLog({
      operation: 'submitJob',
      url,
      response: res,
      body: responseBody,
    }));
    if (!res.ok) {
      aiLog.error('AI transport submitJob HTTP error', {
        operation: 'submitJob',
        url: sanitizeUrlForLog(url),
        status: res.status,
        mappedErrorKey: mapHttpStatusToAiJobErrorKey(res.status),
      });
      throw new AiTransportError(mapHttpStatusToAiJobErrorKey(res.status));
    }
    const json = asRecord(responseBody.json);
    const jobId = extractPredictionId(json);
    if (!jobId) {
      aiLog.error('AI transport submitJob missing prediction id', {
        operation: 'submitJob',
        url: sanitizeUrlForLog(url),
        body: responseBodyForLog(responseBody),
      });
      throw new AiTransportError(AI_JOB_ERROR_KEYS.badResponse);
    }
    return { jobId, resultUrl: extractPredictionUrl(json), raw: json };
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
    const url = resolveResultUrl(baseUrl, input);
    const headers = { Authorization: `Bearer ${apiKey}` };
    aiLog.debug('AI transport pollStatus request', serializeRequestLog({
      operation: 'pollStatus',
      method: 'GET',
      url,
      headers,
    }));
    let res: Response;
    try {
      res = await fetch(url, {
        headers,
      });
    } catch (error) {
      aiLog.error('AI transport pollStatus request failed', {
        operation: 'pollStatus',
        url: sanitizeUrlForLog(url),
        error: serializeErrorLog(error),
      });
      throw new AiTransportError(AI_JOB_ERROR_KEYS.network);
    }
    if (res.type === 'opaque') {
      aiLog.error('AI transport pollStatus received opaque response', {
        operation: 'pollStatus',
        url: sanitizeUrlForLog(url),
      });
      throw new AiTransportError(AI_JOB_ERROR_KEYS.corsOrBlocked);
    }
    const responseBody = await readResponseBodySafe(res);
    aiLog.debug('AI transport pollStatus response', serializeResponseLog({
      operation: 'pollStatus',
      url,
      response: res,
      body: responseBody,
    }));
    if (!res.ok) {
      aiLog.error('AI transport pollStatus HTTP error', {
        operation: 'pollStatus',
        url: sanitizeUrlForLog(url),
        status: res.status,
        mappedErrorKey: mapHttpStatusToAiJobErrorKey(res.status),
      });
      throw new AiTransportError(mapHttpStatusToAiJobErrorKey(res.status));
    }
    const json = asRecord(responseBody.json);
    const payload = getAtlasPayload(json);
    const rawStatus =
      getStringField(payload, ['status']) ??
      getStringField(json, ['status']) ??
      'running';
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
    const url = resolveResultUrl(baseUrl, input);
    const headers = { Authorization: `Bearer ${apiKey}` };
    aiLog.debug('AI transport fetchResult request', serializeRequestLog({
      operation: 'fetchResult',
      method: 'GET',
      url,
      headers,
    }));
    let res: Response;
    try {
      res = await fetch(url, {
        headers,
      });
    } catch (error) {
      aiLog.error('AI transport fetchResult request failed', {
        operation: 'fetchResult',
        url: sanitizeUrlForLog(url),
        error: serializeErrorLog(error),
      });
      throw new AiTransportError(AI_JOB_ERROR_KEYS.network);
    }
    if (res.type === 'opaque') {
      aiLog.error('AI transport fetchResult received opaque response', {
        operation: 'fetchResult',
        url: sanitizeUrlForLog(url),
      });
      throw new AiTransportError(AI_JOB_ERROR_KEYS.corsOrBlocked);
    }
    const responseBody = await readResponseBodySafe(res);
    aiLog.debug('AI transport fetchResult response', serializeResponseLog({
      operation: 'fetchResult',
      url,
      response: res,
      body: responseBody,
    }));
    if (!res.ok) {
      aiLog.error('AI transport fetchResult HTTP error', {
        operation: 'fetchResult',
        url: sanitizeUrlForLog(url),
        status: res.status,
        mappedErrorKey: mapHttpStatusToAiJobErrorKey(res.status),
      });
      throw new AiTransportError(mapHttpStatusToAiJobErrorKey(res.status));
    }
    const json = asRecord(responseBody.json);
    const assetUrl = extractOutputUrl(json);
    const outputText = extractOutputText(json, assetUrl);
    return { assetUrl, outputText, raw: json };
  }
}
