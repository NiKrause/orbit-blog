import {
  isImageUiProperty,
  isInputSchemaStructureSupported,
  orderPropertyKeys,
} from './inputSchema.js';
import type { AiInputPropertySchema, AiModelManifest, AiSubmitJobInput } from './types.js';

function isEmptyForBody(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

/**
 * Atlas `generateVideo` expects an HTTPS URL for the start frame. Values from the UI may be:
 * - a full URL (pasted), or
 * - an IPFS CID string from Story 4.2 — converted to a public gateway URL (no secrets in body).
 */
export function cidOrHttpToImageUrl(value: string): string {
  const t = value.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://dweb.link/ipfs/${t}`;
}

/**
 * Builds {@link AiSubmitJobInput} from the manifest registry entry and bound field values.
 *
 * **Field mapping (Kling image-to-video on Atlas):** `inputValues` keys match `inputSchema.properties`
 * and are sent on the JSON body as the same names where supported: `prompt`, `duration`, and `image`
 * (image URL string). Provider `model` comes from {@link AiModelManifest.model}, not `manifest.id`.
 */
export function buildSubmitJobInput(
  manifest: AiModelManifest,
  inputValues: Record<string, unknown>,
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
      /** Atlas `generateVideo` uses `image_url` (see Atlas video docs). */
      body.image_url = cidOrHttpToImageUrl(typeof raw === 'string' ? raw : String(raw ?? ''));
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
