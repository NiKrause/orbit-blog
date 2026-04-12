import {
  isImageUiProperty,
  isInputSchemaStructureSupported,
  orderPropertyKeys,
} from './inputSchema.js';
import { relayOnlyIpfsUrlForCid } from '../relay/relayEnv.js';
import type { AiInputPropertySchema, AiModelManifest, AiSubmitJobInput } from './types.js';

function isEmptyForBody(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

/**
 * Atlas `generateVideo` expects an HTTPS URL for the start frame. Values from the UI may be:
 * - a full URL (pasted), or
 * - an IPFS CID string from Story 4.2 — converted to the configured relay `/ipfs/{cid}` URL.
 */
export function cidOrHttpToImageUrl(
  value: string,
  options?: { cidToUrl?: (cid: string) => string },
): string {
  const t = value.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return options?.cidToUrl?.(t) ?? relayOnlyIpfsUrlForCid(t);
}

/**
 * Builds {@link AiSubmitJobInput} from the manifest registry entry and bound field values.
 *
 * **Field mapping (Kling image-to-video on Atlas):** `inputValues` keys match `inputSchema.properties`
 * and are sent on the JSON body as the same names where supported: `prompt`, `duration`, and `image`
 * (image URL string). Provider `model` comes from {@link AiModelManifest.model}, not `manifest.id`.
 *
 * **At most one `x-ui: image` field** is supported: Atlas uses a single `image`; additional image
 * properties in the same schema are ignored after the first mapped image (schema key order via
 * {@link orderPropertyKeys}).
 */
export function buildSubmitJobInput(
  manifest: AiModelManifest,
  inputValues: Record<string, unknown>,
  options?: { cidToUrl?: (cid: string) => string },
): AiSubmitJobInput {
  const schema = manifest.inputSchema;
  if (!schema || !isInputSchemaStructureSupported(schema)) {
    return { model: manifest.model, body: {} };
  }

  const body: Record<string, unknown> = {};

  for (const key of orderPropertyKeys(schema)) {
    const prop: AiInputPropertySchema | undefined = schema.properties[key];
    if (!prop) continue;
    const raw = inputValues[key];
    if (isEmptyForBody(raw)) continue;

    if (prop.type === 'boolean') {
      body[key] = raw === true;
      continue;
    }

    if (prop.type === 'string' && prop.enum && prop.enum.length > 0) {
      body[key] = typeof raw === 'string' ? raw : String(raw ?? '');
      continue;
    }

    if (prop.type === 'string' && isImageUiProperty(prop)) {
      if (body.image !== undefined) continue;
      /** Atlas `generateVideo` uses `image` (see Atlas video docs / API examples). */
      const imageUrl = cidOrHttpToImageUrl(
        typeof raw === 'string' ? raw : String(raw ?? ''),
        options,
      );
      if (imageUrl) body.image = imageUrl;
      continue;
    }

    if (prop.type === 'string') {
      body[key] = typeof raw === 'string' ? raw : String(raw ?? '');
      continue;
    }

    if (prop.type === 'number' || prop.type === 'integer') {
      if (typeof raw === 'number') {
        body[key] = raw;
      } else if (typeof raw === 'string' && raw.trim() !== '') {
        const n = prop.type === 'integer' ? parseInt(raw, 10) : Number(raw);
        if (!Number.isNaN(n)) body[key] = n;
      }
    }
  }

  return { model: manifest.model, body };
}
