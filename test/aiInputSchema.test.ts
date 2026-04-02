import assert from 'node:assert/strict';
import {
  AI_SCHEMA_I18N,
  initialValuesForSchema,
  isImageUiProperty,
  isInputSchemaStructureSupported,
  isPropertySchemaSupported,
  orderPropertyKeys,
  validateAiInputSchema,
} from '../src/lib/ai/inputSchema.js';
import type { AiInputSchema } from '../src/lib/ai/types.js';

describe('orderPropertyKeys', () => {
  it('uses x-order when it lists every property key exactly once', () => {
    const schema: AiInputSchema = {
      type: 'object',
      required: ['a'],
      properties: {
        a: { type: 'string', titleKey: 'k' },
        b: { type: 'string', titleKey: 'k' },
        c: { type: 'string', titleKey: 'k' },
      },
      'x-order': ['c', 'a', 'b'],
    };
    assert.deepStrictEqual(orderPropertyKeys(schema), ['c', 'a', 'b']);
  });

  it('deduplicates duplicate keys in required[] while preserving first-seen order', () => {
    const schema: AiInputSchema = {
      type: 'object',
      required: ['prompt', 'prompt', 'duration'],
      properties: {
        duration: { type: 'integer', titleKey: 'k' },
        prompt: { type: 'string', titleKey: 'k' },
        extra: { type: 'string', titleKey: 'k' },
      },
    };
    assert.deepStrictEqual(orderPropertyKeys(schema), ['prompt', 'duration', 'extra']);
  });

  it('falls back to required order then optional A–Z when x-order is incomplete', () => {
    const schema: AiInputSchema = {
      type: 'object',
      required: ['prompt'],
      properties: {
        image: { type: 'string', titleKey: 'k' },
        duration: { type: 'integer', titleKey: 'k' },
        prompt: { type: 'string', titleKey: 'k' },
      },
      'x-order': ['prompt', 'image'],
    };
    assert.deepStrictEqual(orderPropertyKeys(schema), ['prompt', 'duration', 'image']);
  });
});

describe('validateAiInputSchema', () => {
  it('requires non-empty string for required fields', () => {
    const schema: AiInputSchema = {
      type: 'object',
      required: ['prompt'],
      properties: {
        prompt: { type: 'string', titleKey: 'ai_schema_field_prompt' },
      },
    };
    const r = validateAiInputSchema(schema, { prompt: '  ' });
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.strictEqual(r.fieldErrors.prompt, AI_SCHEMA_I18N.fieldRequired);
    }
  });

  it('accepts valid enum value', () => {
    const schema: AiInputSchema = {
      type: 'object',
      properties: {
        mode: { type: 'string', titleKey: 'k', enum: ['a', 'b'] },
      },
    };
    const r = validateAiInputSchema(schema, { mode: 'a' });
    assert.strictEqual(r.ok, true);
  });

  it('rejects invalid enum value', () => {
    const schema: AiInputSchema = {
      type: 'object',
      properties: {
        mode: { type: 'string', titleKey: 'k', enum: ['a', 'b'] },
      },
    };
    const r = validateAiInputSchema(schema, { mode: 'z' });
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.strictEqual(r.fieldErrors.mode, AI_SCHEMA_I18N.fieldInvalidEnum);
    }
  });

  it('fails closed for empty properties object', () => {
    const schema = {
      type: 'object' as const,
      properties: {},
    };
    assert.strictEqual(isInputSchemaStructureSupported(schema), false);
  });

  it('fails closed when a property mixes number with enum', () => {
    const schema: AiInputSchema = {
      type: 'object',
      properties: {
        n: { type: 'number', titleKey: 'k', enum: ['1', '2'] },
      },
    };
    assert.strictEqual(isInputSchemaStructureSupported(schema), false);
  });

  it('enforces integer min/max', () => {
    const schema: AiInputSchema = {
      type: 'object',
      required: ['duration'],
      properties: {
        duration: { type: 'integer', minimum: 1, maximum: 60, titleKey: 'k' },
      },
    };
    const low = validateAiInputSchema(schema, { duration: 0 });
    assert.strictEqual(low.ok, false);
    if (!low.ok) {
      assert.strictEqual(low.fieldErrors.duration, AI_SCHEMA_I18N.fieldBelowMinimum);
    }
    const high = validateAiInputSchema(schema, { duration: 61 });
    assert.strictEqual(high.ok, false);
    if (!high.ok) {
      assert.strictEqual(high.fieldErrors.duration, AI_SCHEMA_I18N.fieldAboveMaximum);
    }
    const ok = validateAiInputSchema(schema, { duration: 30 });
    assert.strictEqual(ok.ok, true);
  });

  it('rejects non-integer numeric values for integer fields', () => {
    const schema: AiInputSchema = {
      type: 'object',
      required: ['duration'],
      properties: {
        duration: { type: 'integer', titleKey: 'k', minimum: 1, maximum: 60 },
      },
    };
    const r = validateAiInputSchema(schema, { duration: 12.7 });
    assert.strictEqual(r.ok, false);
    if (!r.ok) {
      assert.strictEqual(r.fieldErrors.duration, AI_SCHEMA_I18N.fieldInvalidInteger);
    }
  });
});

describe('isImageUiProperty / x-ui (Story 4.2)', () => {
  it('accepts string + x-ui image', () => {
    const prop = { type: 'string' as const, titleKey: 'k', 'x-ui': 'image' as const };
    assert.strictEqual(isPropertySchemaSupported(prop), true);
    assert.strictEqual(isImageUiProperty(prop), true);
  });

  it('rejects string + x-ui image + enum', () => {
    const prop = {
      type: 'string' as const,
      titleKey: 'k',
      'x-ui': 'image' as const,
      enum: ['a'],
    };
    assert.strictEqual(isPropertySchemaSupported(prop), false);
  });

  it('rejects unknown x-ui value', () => {
    const prop = { type: 'string' as const, titleKey: 'k', 'x-ui': 'video' as any };
    assert.strictEqual(isPropertySchemaSupported(prop), false);
  });

  it('validates required image field as non-empty string', () => {
    const schema: AiInputSchema = {
      type: 'object',
      required: ['image'],
      properties: {
        image: { type: 'string', titleKey: 'k', 'x-ui': 'image' },
      },
    };
    const bad = validateAiInputSchema(schema, { image: '' });
    assert.strictEqual(bad.ok, false);
    if (!bad.ok) {
      assert.strictEqual(bad.fieldErrors.image, AI_SCHEMA_I18N.fieldRequired);
    }
    const good = validateAiInputSchema(schema, { image: 'bafybeig' });
    assert.strictEqual(good.ok, true);
  });
});

describe('initialValuesForSchema', () => {
  it('sets string and number-like fields to empty string and boolean to false', () => {
    const schema: AiInputSchema = {
      type: 'object',
      properties: {
        x: { type: 'string', titleKey: 'k' },
        y: { type: 'integer', titleKey: 'k' },
        z: { type: 'boolean', titleKey: 'k' },
      },
    };
    const v = initialValuesForSchema(schema);
    assert.strictEqual(v.x, '');
    assert.strictEqual(v.y, '');
    assert.strictEqual(v.z, false);
  });
});
