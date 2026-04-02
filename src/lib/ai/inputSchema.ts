import type { AiInputPropertySchema, AiInputSchema } from './types.js';

/** i18n keys used as `fieldErrors` values (Story 4.1). */
export const AI_SCHEMA_I18N = {
  fieldRequired: 'ai_schema_field_required',
  fieldInvalidNumber: 'ai_schema_field_invalid_number',
  fieldInvalidInteger: 'ai_schema_field_invalid_integer',
  fieldBelowMinimum: 'ai_schema_field_below_minimum',
  fieldAboveMaximum: 'ai_schema_field_above_maximum',
  fieldInvalidEnum: 'ai_schema_field_invalid_enum',
  manifestUnsupported: 'ai_schema_manifest_unsupported',
  manifestInvalid: 'ai_schema_manifest_invalid',
} as const;

export type AiSchemaFieldErrors = Record<string, string>;

function propertyKeys(schema: AiInputSchema): string[] {
  return Object.keys(schema.properties ?? {});
}

/**
 * AC2: If `x-order` lists every property key exactly once, use it; else required keys in
 * declaration order, then remaining keys A–Z.
 */
export function orderPropertyKeys(schema: AiInputSchema): string[] {
  const keys = propertyKeys(schema);
  const order = schema['x-order'];
  if (
    Array.isArray(order) &&
    order.length === keys.length &&
    new Set(order).size === keys.length &&
    keys.every((k) => order.includes(k))
  ) {
    return [...order];
  }
  const req = schema.required ?? [];
  const requiredOrdered = [...new Set(req.filter((k) => keys.includes(k)))];
  const optional = keys.filter((k) => !req.includes(k)).sort((a, b) => a.localeCompare(b));
  return [...requiredOrdered, ...optional];
}

/** Story 4.2: string field with image picker + upload (mutually exclusive with `enum`). */
export function isImageUiProperty(prop: AiInputPropertySchema): boolean {
  return prop.type === 'string' && prop['x-ui'] === 'image';
}

export function isPropertySchemaSupported(prop: AiInputPropertySchema): boolean {
  const t = prop.type;
  if (t !== 'string' && t !== 'number' && t !== 'integer' && t !== 'boolean') {
    return false;
  }
  if (t === 'number' || t === 'integer') {
    if (prop.enum !== undefined && prop.enum.length > 0) {
      return false;
    }
  }
  if (t === 'string') {
    const ui = prop['x-ui'];
    if (ui !== undefined && ui !== 'image') {
      return false;
    }
    if (isImageUiProperty(prop) && prop.enum !== undefined && prop.enum.length > 0) {
      return false;
    }
  }
  if (typeof prop.titleKey !== 'string' || prop.titleKey.length === 0) {
    return false;
  }
  return true;
}

export function isInputSchemaStructureSupported(schema: AiInputSchema | undefined | null): boolean {
  if (!schema || schema.type !== 'object' || !schema.properties || typeof schema.properties !== 'object') {
    return false;
  }
  for (const key of Object.keys(schema.properties)) {
    const p = schema.properties[key];
    if (!p || !isPropertySchemaSupported(p)) {
      return false;
    }
  }
  return Object.keys(schema.properties).length > 0;
}

export function initialValuesForSchema(schema: AiInputSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of orderPropertyKeys(schema)) {
    const p = schema.properties[key];
    if (!p) continue;
    if (p.type === 'boolean') {
      out[key] = false;
    } else {
      out[key] = '';
    }
  }
  return out;
}

function isEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

export function validateAiInputSchema(
  schema: AiInputSchema,
  values: Record<string, unknown>,
): { ok: true } | { ok: false; fieldErrors: AiSchemaFieldErrors } {
  if (!isInputSchemaStructureSupported(schema)) {
    return {
      ok: false,
      fieldErrors: { _: AI_SCHEMA_I18N.manifestInvalid },
    };
  }

  const fieldErrors: AiSchemaFieldErrors = {};
  const required = new Set(schema.required ?? []);

  for (const key of orderPropertyKeys(schema)) {
    const prop = schema.properties[key];
    if (!prop) continue;
    const raw = values[key];

    if (required.has(key) && prop.type !== 'boolean' && isEmptyValue(raw)) {
      fieldErrors[key] = AI_SCHEMA_I18N.fieldRequired;
      continue;
    }
    if (required.has(key) && prop.type === 'boolean' && raw === undefined) {
      fieldErrors[key] = AI_SCHEMA_I18N.fieldRequired;
      continue;
    }

    if (prop.type === 'string') {
      if (prop.enum && prop.enum.length > 0) {
        const s = typeof raw === 'string' ? raw : String(raw ?? '');
        if (required.has(key) && s === '') {
          fieldErrors[key] = AI_SCHEMA_I18N.fieldRequired;
        } else if (s !== '' && !prop.enum.includes(s)) {
          fieldErrors[key] = AI_SCHEMA_I18N.fieldInvalidEnum;
        }
      }
      continue;
    }

    if (prop.type === 'boolean') {
      if (raw !== undefined && typeof raw !== 'boolean') {
        fieldErrors[key] = AI_SCHEMA_I18N.manifestUnsupported;
      }
      continue;
    }

    if (prop.type === 'number' || prop.type === 'integer') {
      if (isEmptyValue(raw)) {
        if (!required.has(key)) continue;
        fieldErrors[key] = AI_SCHEMA_I18N.fieldRequired;
        continue;
      }
      const n =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string'
            ? Number(raw)
            : NaN;
      if (Number.isNaN(n)) {
        fieldErrors[key] =
          prop.type === 'integer'
            ? AI_SCHEMA_I18N.fieldInvalidInteger
            : AI_SCHEMA_I18N.fieldInvalidNumber;
        continue;
      }
      if (prop.type === 'integer' && !Number.isInteger(n)) {
        fieldErrors[key] = AI_SCHEMA_I18N.fieldInvalidInteger;
        continue;
      }
      if (prop.minimum !== undefined && n < prop.minimum) {
        fieldErrors[key] = AI_SCHEMA_I18N.fieldBelowMinimum;
        continue;
      }
      if (prop.maximum !== undefined && n > prop.maximum) {
        fieldErrors[key] = AI_SCHEMA_I18N.fieldAboveMaximum;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }
  return { ok: true };
}
