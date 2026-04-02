import type { AiModelManifest } from './types.js';
import klingI2v from './manifests/kling-i2v.json' with { type: 'json' };

const KLING_I2V: AiModelManifest[] = klingI2v as AiModelManifest[];

/** Kling image-to-video models (Atlas) for M1 model dropdown. */
export function listKlingI2vManifests(): AiModelManifest[] {
  return [...KLING_I2V];
}

export function getManifestById(id: string): AiModelManifest | undefined {
  return KLING_I2V.find((m) => m.id === id);
}

/** Provider `model` string for the selected manifest id, if any. */
export function getProviderModelForId(id: string): string | undefined {
  return getManifestById(id)?.model;
}
