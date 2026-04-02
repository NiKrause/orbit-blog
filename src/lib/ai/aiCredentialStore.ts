/**
 * Persist and load per-model AI credentials in the AI OrbitDB (`aiDB`).
 *
 * Translation feature keys `aiApiKey` / `aiApiUrl` in store.ts are NOT used here.
 * Callers must pass the same 32-byte identity seed used for OrbitDB identity
 * (e.g. from convertTo32BitSeed(generateMasterSeed(seedPhrase, ...)) in LeSpaceBlog / orbitdb bootstrap).
 */

import type { OrbitDB } from '../types.js';
import type { AiCredentialDocument } from './credentialTypes.js';
import { decryptApiKey, encryptApiKey } from './aiCredentialCrypto.js';

/** Prefix reserved for credential rows; job docs should use a different prefix (e.g. `job:`). */
const CRED_PREFIX = 'credential:';

/**
 * Validates and trims model id. Empty or whitespace-only values are rejected
 * so documents never share the ambiguous `_id` `credential:` alone.
 */
export function normalizeModelId(modelId: string): string {
  const t = typeof modelId === 'string' ? modelId.trim() : '';
  if (!t) {
    throw new TypeError('modelId must be a non-empty string');
  }
  return t;
}

/**
 * Stable document _id for a model id (URI-encoded so arbitrary model strings are safe).
 */
export function credentialDocumentId(modelId: string): string {
  return `${CRED_PREFIX}${encodeURIComponent(normalizeModelId(modelId))}`;
}

/** Unwrap OrbitDB document envelope (may nest `value`) until credential fields are visible. */
function unwrapCredentialEntry(entry: unknown): AiCredentialDocument | null {
  let cur: unknown = entry;
  for (let d = 0; d < 4 && cur && typeof cur === 'object'; d++) {
    const o = cur as Record<string, unknown>;
    if (
      o.schemaVersion === 1 &&
      typeof o.modelId === 'string' &&
      typeof o.baseUrl === 'string' &&
      o.encryptedApiKey &&
      typeof o.encryptedApiKey === 'object'
    ) {
      return o as unknown as AiCredentialDocument;
    }
    cur = o.value;
  }
  return null;
}

export interface SaveAiCredentialInput {
  modelId: string;
  baseUrl: string;
  apiKey: string;
}

/**
 * Writes or replaces the credential document for this model. API key is encrypted at rest.
 */
export async function saveAiCredential(
  aiDb: Pick<OrbitDB, 'put'>,
  identitySeed32: Uint8Array | Buffer,
  input: SaveAiCredentialInput
): Promise<void> {
  const modelId = normalizeModelId(input.modelId);
  const encryptedApiKey = await encryptApiKey(identitySeed32, input.apiKey);
  const doc: AiCredentialDocument = {
    schemaVersion: 1,
    modelId,
    baseUrl: input.baseUrl,
    encryptedApiKey,
  };
  const _id = credentialDocumentId(modelId);
  await aiDb.put({ _id, ...doc });
}

export interface LoadedAiCredential {
  modelId: string;
  baseUrl: string;
  apiKey: string;
}

export type LoadAiCredentialResult =
  | { status: 'missing' }
  | { status: 'decrypt_failed' }
  | { status: 'ok'; credential: LoadedAiCredential };

async function resolveLoadAiCredential(
  aiDb: Pick<OrbitDB, 'get'>,
  identitySeed32: Uint8Array | Buffer,
  modelId: string
): Promise<LoadAiCredentialResult> {
  const _id = credentialDocumentId(modelId);
  const entry = await aiDb.get(_id);
  const row = unwrapCredentialEntry(entry);
  if (!row) return { status: 'missing' };
  try {
    const apiKey = await decryptApiKey(identitySeed32, row.encryptedApiKey);
    return {
      status: 'ok',
      credential: { modelId: row.modelId, baseUrl: row.baseUrl, apiKey },
    };
  } catch {
    return { status: 'decrypt_failed' };
  }
}

/**
 * Same as {@link loadAiCredential} but distinguishes missing row vs decrypt failure (wrong seed / tamper).
 */
export async function loadAiCredentialDetailed(
  aiDb: Pick<OrbitDB, 'get'>,
  identitySeed32: Uint8Array | Buffer,
  modelId: string
): Promise<LoadAiCredentialResult> {
  return resolveLoadAiCredential(aiDb, identitySeed32, modelId);
}

/**
 * Loads and decrypts credentials for a model, or null if missing, unreadable, or decryption fails
 * (wrong identity seed, tampered ciphertext, unsupported format). Does not throw on decrypt errors
 * so UI layers can treat failure like a missing credential without logging secrets.
 */
export async function loadAiCredential(
  aiDb: Pick<OrbitDB, 'get'>,
  identitySeed32: Uint8Array | Buffer,
  modelId: string
): Promise<LoadedAiCredential | null> {
  const r = await resolveLoadAiCredential(aiDb, identitySeed32, modelId);
  return r.status === 'ok' ? r.credential : null;
}

/**
 * Lists model ids that have a v1 credential document in this AI DB (one document per model).
 * Job rows and other prefixes are ignored.
 */
export async function listAiCredentialModelIds(
  aiDb: Pick<OrbitDB, 'all'>
): Promise<string[]> {
  const rows = await aiDb.all();
  const seen = new Set<string>();
  for (const row of rows) {
    const doc = unwrapCredentialEntry(row);
    if (doc) seen.add(doc.modelId);
  }
  return [...seen].sort();
}

/**
 * Removes the credential document for this model id if it exists.
 */
export async function deleteAiCredential(
  aiDb: Pick<OrbitDB, 'del'>,
  modelId: string
): Promise<void> {
  const _id = credentialDocumentId(modelId);
  await aiDb.del(_id);
}
