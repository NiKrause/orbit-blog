/**
 * FR-8b: persist each Generate run in the AI OrbitDB (`aiDB`).
 * Document ids use prefix `run:` — distinct from `credential:` in aiCredentialStore.
 */

import type { OrbitDB } from '../types.js';
import type { AiJobLifecycleStatus } from './types.js';

export const AI_RUN_DOC_PREFIX = 'run:' as const;

export type AiRunRecordStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

export interface AiRunDocument {
  schemaVersion: 1;
  kind: 'aiRun';
  _id: string;
  /** Manifest registry id (selection key). */
  manifestModelId: string;
  /** Provider model string (Atlas `model`). */
  providerModelId: string;
  /** JSON-serializable copy of dynamic inputs — no API keys (NFR-1). */
  inputsSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  status: AiRunRecordStatus;
  providerJobId?: string;
  lastPollLifecycle?: AiJobLifecycleStatus;
  /** svelte-i18n key when `status === 'failed'`. */
  errorKey?: string;
  /** Optional non-sensitive URL hint after success (Story 5.1). */
  resultAssetUrl?: string;
}

export function newAiRunDocumentId(): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return `${AI_RUN_DOC_PREFIX}${uuid}`;
}

/** Deep snapshot for OrbitDB; strips functions / non-JSON values. */
export function snapshotAiInputs(inputValues: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(inputValues)) as Record<string, unknown>;
}

export function createPendingAiRunDoc(input: {
  runId?: string;
  manifestModelId: string;
  providerModelId: string;
  inputValues: Record<string, unknown>;
}): AiRunDocument {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    kind: 'aiRun',
    _id: input.runId ?? newAiRunDocumentId(),
    manifestModelId: input.manifestModelId,
    providerModelId: input.providerModelId,
    inputsSnapshot: snapshotAiInputs(input.inputValues),
    createdAt: now,
    updatedAt: now,
    status: 'pending',
  };
}

export type AiRunDocPatch = Partial<{
  status: AiRunRecordStatus;
  providerJobId: string;
  lastPollLifecycle: AiJobLifecycleStatus;
  errorKey: string;
  resultAssetUrl: string;
}>;

export function patchAiRun(doc: AiRunDocument, patch: AiRunDocPatch): AiRunDocument {
  return {
    ...doc,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

export async function persistAiRunDoc(
  aiDb: Pick<OrbitDB, 'put'>,
  doc: AiRunDocument,
): Promise<void> {
  await aiDb.put(doc);
}
