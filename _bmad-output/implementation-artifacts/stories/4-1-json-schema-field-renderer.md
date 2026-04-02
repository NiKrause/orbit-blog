---
story_key: 4-1-json-schema-field-renderer
epic: 4
story: 4.1
frs: FR-5
ux_drs: UX-DR3, UX-DR6, UX-DR9, UX-DR10
---

# Story 4.1: JSON Schema (or subset) field renderer

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **blog author**,  
I want **fields for the selected model to appear automatically from its manifest**,  
so that **new models do not each require a custom hardcoded form**.

## Acceptance Criteria

1. **Given** a manifest that includes an **input schema** (subset of JSON Schema — see Dev Notes) for the selected model  
   **When** the user changes the **model** in the AI Manager dropdown  
   **Then** the dynamic field area **re-renders** to match that model’s `properties` / `required` (FR-5).

2. **And** fields follow **UX-DR6**: **required** properties are listed **before** optional properties. **Ordering rule:** (1) If **`x-order`** is present, use it as the full property order (must list every key in `properties`); (2) else **required** keys in the order listed in **`required[]`**, then **optional** keys sorted alphabetically. Document this in code comments on the order helper.

3. **And** supported control types for this story (subset only): **`string`** (text input), **`number`** / **`integer`**, **`boolean`** (checkbox), and **`string` with an `enum` array** (`{ "type": "string", "enum": ["a","b"] }`). Unsupported combinations (e.g. `number` + `enum`, missing `type`, `object`/`array` roots) fail **closed** with a clear i18n error for that model (no silent skip).

4. **And** **validation**: empty **required** fields produce **inline** errors; the story exposes a **single contract** Epic 5 can use to **block Run** until valid: e.g. **`validateAiInputSchema`** returns **`{ ok, fieldErrors }`** where **`fieldErrors`** maps field name → **i18n message key** (not English prose), and **`AiSchemaFields` / `AiManager`** runs `$_()` for display — **or** returns structured codes (e.g. `required`) that the component maps to keys. Avoid hardcoded English inside the pure validator (**UX-DR3**). (**Run** button is Epic 5; here only validation + inline errors.)

5. **And** all **new** user-visible strings use **svelte-i18n** and are added to **every** `src/lib/i18n/*.js` file (English in `en.js`; other locales may mirror English until translated).

6. **And** **no** translation Settings keys (`aiApiKey` / `aiApiUrl`) in this path (**UX-DR9**).

7. **And** RTL: new controls respect **`$isRTL`** / `dir` patterns consistent with **`AiManager`** (**UX-DR10**).

8. **Not in scope:** **Run** / job submit (Epic 5), **image library picker + upload** (Story 4.2 — schema may still declare an image field as `string` placeholder for URL/text until 4.2 swaps the control), full **JSON Schema** / **AJV** (use a **documented subset** and small validator), OrbitDB writes beyond existing credential docs.

## Tasks / Subtasks

- [x] **Task 1 — Schema types + manifest data (AC: 1, 3, 8)**  
  - [x] Define a **TypeScript** type for the manifest **input schema subset** (e.g. `AiInputSchema` in `src/lib/ai/types.ts` or `src/lib/ai/inputSchema.ts`).  
  - [x] Extend **`AiModelManifest`** (or parallel field on manifest JSON) with optional **`inputSchema`**; update **`src/lib/ai/manifests/kling-i2v.json`** (or per-model files) with a **minimal real** Kling-relevant subset aligned with [Atlas Kling image-to-video API](https://www.atlascloud.ai/models/kwaivgi/kling-v3.0-pro/image-to-video?tab=api) body fields at implementation time (e.g. prompt, duration, image URL placeholder — exact keys per vendor docs).  
  - [x] Use existing **`getManifestById(selectedModelId)`** from **`src/lib/ai/modelRegistry.ts`** to read **`inputSchema`** — do not duplicate manifest arrays in **`AiManager`**.

- [x] **Task 2 — Field renderer component (AC: 1–3, 5, 7)**  
  - [x] Add **`AiSchemaFields.svelte`** (or equivalent) under **`src/lib/components/`** that takes **`schema` + bindable `values: Record<string, unknown>`** and renders controls.  
  - [x] Implement **ordering** per AC2 and Dev Notes.  
  - [x] Map types to inputs; **`enum`** → `<select>`; **`boolean`** → checkbox; **number/integer** → numeric input with optional min/max if present.

- [x] **Task 3 — Validation API for Epic 5 (AC: 4)**  
  - [x] Pure function **`validateAiInputSchema(schema, values)`** returning **`{ ok: boolean, fieldErrors: Record<string, string> }`** where values of **`fieldErrors`** are **svelte-i18n keys** (e.g. `ai_schema_field_required`), not literal English.  
  - [x] **`AiManager`**: show **inline** errors under fields via **`$_()`**; document **`getInputValues()`** / **`validateAiInputSchema`** (or derived **`canSubmitInputs`**) for Epic 5 **Run** gating.

- [x] **Task 4 — Wire into AiManager (AC: 1, 6)**  
  - [x] Place dynamic fields **below** the per-model credential block (same card), without breaking existing **3.3** layout.  
  - [x] Reset **`values`** when **`selectedModelId`** changes (no leaking prior model’s field values).

- [x] **Task 5 — Tests + check (AC: 1–4)**  
  - [x] Unit tests: **ordering**, **required** validation, **enum**/**unsupported type** behavior (`test/aiInputSchema.test.ts` or similar).  
  - [x] Extend **`test/postFormAiI18n.test.ts`** `KEYS` with every new **`ai_schema_*`** (and related) i18n key, matching Stories 3.x.  
  - [x] `pnpm check` and `pnpm test` green.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Frontend / Dynamic forms] — JSON Schema subset → field renderer; manifests under **`src/lib/ai/manifests/`**.  
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 4 / Story 4.1] — BDD AC above.  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — §7.2 / dynamic inputs] — Required before optional where applicable (**UX-DR6**).

### Schema subset (minimum contract)

Document in code comments — example shape:

```json
{
  "type": "object",
  "required": ["prompt"],
  "properties": {
    "prompt": { "type": "string", "titleKey": "ai_schema_field_prompt" },
    "duration": { "type": "integer", "minimum": 1, "maximum": 60, "titleKey": "ai_schema_field_duration" }
  }
}
```

- Support **`titleKey`** on every property (i18n key for the label — required by `isPropertySchemaSupported`; not plain **`title`**).  
- Optional **`x-order`**: if present, **full** ordered list of every key in `properties` (required + optional); if absent, apply the **AC2** rule (required order from `required[]`, then optional A–Z).
- **`format` / `x-ui`:** For **image** inputs, Story 4.2 may introduce **`x-ui: "image"`** or similar; in 4.1, an image may remain a plain **`string`** (URL/text) until 4.2 swaps the control.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `src/lib/ai/types.ts` (and/or `inputSchema.ts`) | `AiInputSchema` + manifest extension |
| `src/lib/ai/manifests/*.json` | `inputSchema` for Kling entries |
| `src/lib/ai/modelRegistry.ts` | Re-exports if needed |
| `src/lib/components/AiSchemaFields.svelte` | Renderer |
| `src/lib/components/AiManager.svelte` | Wire schema + state |
| `src/lib/i18n/*.js` | New keys |
| `test/*.ts` | Schema validation / order tests |

### Previous story intelligence (Epic 3)

- **`AiManager.svelte`** already has model `<select>`, **`getProviderModelForId`**, credentials (**3.3**). **Extend**; do not fork a second AI panel.  
- **`AiModelManifest`** today: `id`, `labelKey`, `model` — add **`inputSchema`** without breaking consumers (optional field).

### Testing standards

- `pnpm check` required.  
- Prefer **pure** validation functions for unit tests (no Svelte mount required for core logic).

### Git / conventions

- NodeNext **`.js`** imports.  
- Do not log user prompts or field values in production paths (**NFR-1**).

## Dev Agent Record

### Agent Model Used

Cursor agent — 2026-04-02

### Debug Log References

— 

### Completion Notes List

- **2026-04-02 (dev-story / review follow-up):** Resolved remaining code-review items: `orderPropertyKeys` dedupes `required[]`; integer `<input>` uses `Number()` coercions aligned with validator; enum labels documented as API literals in Review Findings.
- Confirmed `AiInputSchema` / `validateAiInputSchema` / `orderPropertyKeys` in `src/lib/ai/inputSchema.ts` with AC2 comments; Kling manifests carry `inputSchema`; `AiManager` uses `getManifestById` + `$effect` reset of `inputValues` on model change.
- Merged validation into `aiInputValidation` derived state for correct TypeScript narrowing and single `validateAiInputSchema` pass; `canSubmitInputs` + `data-can-submit-inputs` documented for Epic 5.
- `AiSchemaFields`: bound `min`/`max` on number inputs when schema provides `minimum`/`maximum`.
- `AiImageField.svelte`: `CID.parse` for `unixfs.cat`; `removeListener` for OrbitDB events (fixes `pnpm check`).

### File List

- `src/lib/components/AiManager.svelte`
- `src/lib/components/AiSchemaFields.svelte`
- `src/lib/components/AiImageField.svelte`
- `test/aiInputSchema.test.ts`
- `test/postFormAiI18n.test.ts`

### Change Log

- **2026-04-02:** Review follow-up — `orderPropertyKeys` required dedupe, integer field coercion + tests; story marked **review**.
- **2026-04-02:** Story 4.1 closed for review — schema-driven fields, validation contract, tests, check fixes (`AiManager` validation derived, numeric min/max, `AiImageField` CID/events typing).
- **2026-04-02:** `dev-story` — code-review follow-ups closed (enum token decision, integer/`Number`, duplicate `required` dedupe); story status → **review**.
- **2026-04-02:** `bmad-code-review` second pass — clean; story status → **done** (sprint synced).

---

## Project context reference

- `_bmad-output/project-context.md` — Svelte 5, i18n, `pnpm check`.

---

## validate-create-story (checklist) — 2026-04-02

**Workflow:** `_bmad/bmm/4-implementation/bmad-create-story/checklist.md`

| Severity | Finding | Resolution |
| --- | --- | --- |
| **Should** | AC2 listed both `x-order` and `x-propertyOrder` while Dev Notes only mentioned `x-order` — ordering algorithm was ambiguous. | AC2 + Dev Notes aligned: **`x-order`** = full key list; else **`required[]`** order + optional alpha. |
| **Should** | **`enum`** + **`validateAiInputSchema`** risked English strings inside the pure validator (UX-DR3). | AC4 + Task 3: **`fieldErrors`** values are **i18n keys**; component calls **`$_()`**. |
| **Should** | **`getManifestById`** already exists — story said “export registry” vaguely. | Task 1: explicit **`getManifestById(selectedModelId)?.inputSchema`**. |
| **Should** | **`postFormAiI18n.test.ts`** pattern from Epic 3 not referenced. | Task 5: extend **`KEYS`** for **`ai_schema_*`**. |
| **OK** | Epic 4.1 / FR-5 / UX-DR3,6,9,10 alignment with `_bmad-output/planning-artifacts/epics.md` and architecture **Dynamic forms**. | — |
| **OK** | Out-of-scope for Run / 4.2 / AJV clearly bounded. | — |
| **Critical** | Dev Notes / example JSON used **`title`**; implementation requires **`titleKey`** on every property (`isPropertySchemaSupported`, `AiInputPropertySchema`). | Dev Notes + example updated to **`titleKey`** (validate-create-story 2026-04-02). |
| **OK** | **`orderPropertyKeys`** matches AC2: valid **`x-order`** wins; else **`required[]`** order (filtered to existing keys) then optional A–Z. | Matches `src/lib/ai/inputSchema.ts`. |
| **OK** | RTL: **`AiManager`** root sets **`dir={$isRTL ? 'rtl' : 'ltr'}`**; **`AiSchemaFields`** inherits. | — |

**Definition of Done (validation):** Story updated; ready for `bmad-dev-story`.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (BMad create-story workflow).

### Review Findings

<!-- BMad code review — 2026-04-02 — spec: this file; scope: story 4.1 implementation (AiManager, AiSchemaFields, AiImageField, inputSchema, tests). Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor. -->

- [x] [Review][Decision] **Enum `<option>` labels are raw manifest strings** — **Resolved:** option values are **opaque vendor/API tokens**; the field label uses `titleKey`. Per-option i18n deferred unless manifests add `x-enumLabels` later.

- [x] [Review][Patch] **Image field label `for` does not match any control id** [`AiSchemaFields.svelte` → `AiImageField.svelte:189`] — Fixed 2026-04-02: label `for` uses `ai-schema-field-${key}-file` when `isImageUiProperty(prop)`, matching the hidden file input `id` (`{fieldId}-file`).

- [x] [Review][Patch] **Integer inputs** — **Resolved:** integer branch uses `Number(raw)`; `validateAiInputSchema` rejects non-integers. Test: `rejects non-integer numeric values for integer fields`.

- [x] [Review][Patch] **Duplicate keys in `schema.required[]`** — **Resolved:** `orderPropertyKeys` uses `[...new Set(req.filter(...))]`; test `deduplicates duplicate keys in required[] while preserving first-seen order`.

- [x] [Review][Defer] **Blob `URL.createObjectURL` entries in `mediaCache` are never revoked** [`AiImageField.svelte:26-62`] — deferred, pre-existing pattern risk (long sessions); align with any future `MediaUploader` cleanup strategy.

- [x] [Review][Defer] **`loadImages` has no cancellation** [`AiImageField.svelte:68-113`] — deferred; rapid `mediaDB` / identity changes could apply stale rows after unmount or DB swap (low likelihood in typical use).

**Dismissed (noise / acceptable):** `removeListener` vs `dbUtils` `off` (both valid on EventEmitter); combined 4.1+4.2 delivery does not violate 4.1 ACs (4.2 is additive); internal English `throw` for oversize file is caught and only logged; optional-field `number`/`integer` with value `0` is handled; `canSubmitInputs` aligns with manifest-level invalid state.

**Second pass (`bmad-code-review`, 2026-04-02):** ✅ No new findings — prior patches/decisions verified in `AiSchemaFields.svelte` / `inputSchema.ts`. Dismissed: duplicate `enum` entries would break keyed `{#each}` — treat as invalid manifest authoring, out of scope for runtime guard in 4.1.
