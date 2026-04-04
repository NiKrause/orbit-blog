/**
 * AI remote capability advertisement over libp2p pubsub (Story 6.1, FR-11).
 *
 * Peers publish a versioned JSON payload on a stable gossipsub topic so others can
 * discover which manifest ids (`AiModelManifest.id`) the node supports — without
 * exposing API keys or prompts (NFR-1).
 *
 * JSON payload shape (UTF-8):
 * ```json
 * { "protocolVersion": 1, "models": ["kwaivgi-kling-v3-pro-i2v"] }
 * ```
 *
 * - `protocolVersion` must equal {@link AI_REMOTE_PROTOCOL_VERSION} for this build
 *   to accept the message (future versions ignore unknown versions until negotiated).
 * - `models` must be a non-empty array of non-empty strings (registry manifest ids).
 *
 * Discovery direction: single pubsub topic (see `_bmad-output/planning-artifacts/architecture.md`
 * — Discovery & M2 transport). Reuses `libp2p.services.pubsub` from existing Helia wiring.
 */

/** Bump when the JSON contract changes; peers must agree on this to interpret `models`. */
export const AI_REMOTE_PROTOCOL_VERSION = 1 as const;

/**
 * Stable gossipsub topic for AI capability announcements (distinct from peer-discovery topics).
 */
export const LE_SPACE_AI_CAPABILITIES_TOPIC = 'le-space.ai.capabilities.v1';

export interface AiRemoteCapabilitiesPayload {
  protocolVersion: number;
  /** Manifest ids aligned with `AiModelManifest.id` / `getManifestById`. */
  models: string[];
}

export type ValidateCapabilitiesResult =
  | { ok: true; value: AiRemoteCapabilitiesPayload }
  | { ok: false };

/**
 * Validates a parsed JSON value. Unknown `protocolVersion` values are rejected so we
 * do not misinterpret future payloads.
 */
export function validateAiCapabilitiesPayload(
  raw: unknown,
  acceptedProtocolVersion: number
): ValidateCapabilitiesResult {
  if (raw === null || typeof raw !== 'object') return { ok: false };
  const o = raw as Record<string, unknown>;
  const pv = o.protocolVersion;
  if (typeof pv !== 'number' || !Number.isInteger(pv)) return { ok: false };
  if (pv !== acceptedProtocolVersion) return { ok: false };
  const models = o.models;
  if (!Array.isArray(models) || models.length === 0) return { ok: false };
  for (const m of models) {
    if (typeof m !== 'string' || m.length === 0) return { ok: false };
  }
  return { ok: true, value: { protocolVersion: pv, models: [...models] as string[] } };
}

export function encodeAiCapabilitiesPayload(payload: AiRemoteCapabilitiesPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(payload));
}

/**
 * Decodes UTF-8 JSON bytes to a validated payload. Invalid UTF-8, JSON, or shape → `{ ok: false }`
 * (never throws).
 */
export function decodeAiCapabilitiesPayload(
  bytes: Uint8Array,
  acceptedProtocolVersion: number
): ValidateCapabilitiesResult {
  if (!bytes || bytes.length === 0) return { ok: false };
  let text: string;
  try {
    text = new TextDecoder().decode(bytes);
  } catch {
    return { ok: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  return validateAiCapabilitiesPayload(parsed, acceptedProtocolVersion);
}
