---
story_key: 3-2-register-kling-manifests
epic: 3
story: 3.2
frs: FR-5, FR-6
ux_drs: UX-DR3, UX-DR9
---

# Story 3.2: Register Kling Pro and Standard I2V manifests

Status: done

## Story

As a **blog author**,  
I want **to choose Kling Pro and Standard image-to-video from a dropdown**,  
so that **I pick the correct Atlas model id**.

## Acceptance Criteria

1. **Given** the AI panel is open (`AiManager` visible from Story 3.1)  
   **When** the user views the model selector  
   **Then** at least **two** entries exist: **Kling v3.0 Pro — Image to video** and **Kling v3.0 Standard — Image to video** (labels must reflect product intent; use i18n keys, not hardcoded English in source).

2. **And** each entry maps to the correct provider **`model`** string Atlas expects in job/API payloads:  
   - Pro: `kwaivgi/kling-v3.0-pro/image-to-video`  
   - Standard: `kwaivgi/kling-v3.0-std/image-to-video`  
   (Verify against [Atlas model pages](https://www.atlascloud.ai/models/kwaivgi/kling-v3.0-pro/image-to-video) / [std](https://www.atlascloud.ai/models/kwaivgi/kling-v3.0-std/image-to-video) if vendor renames; update registry in one place.)

3. **And** manifests live in a **maintainable registry** under `src/lib/ai/manifests/` (static JSON and/or a small `registry.ts` that re-exports them — avoid scattering magic strings in Svelte).

4. **And** all **new** user-visible strings use **svelte-i18n** with keys added to **every** `src/lib/i18n/*.js` file (same pattern as Story 3.1).

5. **And** AI Manager does **not** yet persist credentials or call the API — no `aiApiKey` / `aiApiUrl` from translation settings (UX-DR9); Epic 2 save flows are Story 3.3.

6. **Not in scope:** Per-model URL/key form, encrypt/save, schema-driven dynamic fields (Epic 4), job submit, OrbitDB writes beyond what already exists.

## Tasks / Subtasks

- [x] **Task 1 — Manifest data (AC: 2–3)**  
  - [x] Add `src/lib/ai/manifests/` with one file per model **or** a single `kling-i2v.json` listing both; include stable internal `id`, human-facing label **key**, and `model` (provider string).  
  - [x] Add `src/lib/ai/modelRegistry.ts` (or `manifests/index.ts`) exporting `listKlingI2vManifests()` / `getManifestById(id)` (or equivalent) so UI and future job code share one source of truth.  
  - [x] Export types if useful (e.g. `AiModelManifest`) in `src/lib/ai/types.ts` **only** if needed; keep minimal — full JSON Schema lives in Epic 4.

- [x] **Task 2 — AiManager UI (AC: 1, 4)**  
  - [x] Extend `src/lib/components/AiManager.svelte`: replace placeholder-only body with a **model `<select>`** (or styled list) when the panel is shown; bind selected manifest id to local state (e.g. `selectedModelId` with sensible default to Pro or first entry).  
  - [x] Use existing design tokens (`var(--border)`, `var(--bg-tertiary)`, form controls consistent with `PostForm` / UX spec §5).

- [x] **Task 3 — i18n (AC: 4)**  
  - [x] Add keys for the two model labels (and optional section label e.g. “Model”).  
  - [x] Mirror keys across **all** locale files under `src/lib/i18n/*.js`.

- [x] **Task 4 — Tests (AC: 2)**  
  - [x] Add a small **unit test** (Mocha + TS like `test/aiHttpTransport.test.ts` or a dedicated `test/aiModelRegistry.test.ts`) asserting registry contains exactly the two entries and `model` strings match the AC strings.  
  - [x] `pnpm test` and `pnpm check` green.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Frontend / `src/lib/ai/`] — Manifests + registry file; **single registry** for new models per architecture “Plugin interface (conceptual)”.  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — §5 Model selection] — Vendor + model name in dropdown (e.g. Kling v3.0 Pro — Image to video).  
- [Source: `src/lib/ai/types.ts` — `AiSubmitJobInput.model`] — The `model` field must match what the HTTP transport will send; registry is the authoritative mapping for UI → `model` string.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `src/lib/ai/manifests/*` | New static manifest data |
| `src/lib/ai/modelRegistry.ts` (or `manifests/index.ts`) | List/get helpers |
| `src/lib/components/AiManager.svelte` | Model dropdown |
| `src/lib/ai/index.ts` | Re-export registry/types if needed for lib consumers |
| `src/lib/i18n/*.js` | New keys |
| `test/*.ts` | Registry assertions |

### Previous story intelligence (3.1)

- `AiManager.svelte` is a **placeholder shell** with only title + subtitle i18n; **extend in place** — do not duplicate a second AI card.  
- `PostForm.svelte` already embeds `AiManager` with panel visibility; **no change required** unless a prop (e.g. `helia`) is needed later — **not required for 3.2**.  
- i18n: keys `ai_toggle_*`, `ai_panel_*` exist; follow same **all-locales** rule.  
- `test/postFormAiI18n.test.ts` asserts AI keys exist — **extend or add** a parallel test for new keys if practical.

### Library / versions

- No new npm dependencies expected.  
- Atlas model slugs are **vendor-defined strings**; registry indirection allows updates without hunting through components.

### Testing standards

- `pnpm check` required.  
- `pnpm test`: include new TS test in the existing AI test invocation in `package.json` if a new file is added (mirror `aiHttpTransport.test.ts` pattern).

### Git / conventions

- NodeNext: `.js` suffix on imports from TS.  
- Do not log API keys; this story does not handle secrets.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

_(none)_

### Completion Notes List

- **`AiModelManifest`** + `src/lib/ai/manifests/kling-i2v.json` + `modelRegistry.ts` (`listKlingI2vManifests`, `getManifestById`, `getProviderModelForId`). JSON imported with `with { type: 'json' }` for NodeNext.
- **`AiManager.svelte`:** labeled `<select>` (`ai_model_section_label`, `data-testid="ai-model-select"`), `selectedModelId` defaults to Pro (first manifest row); helper text via `ai_panel_placeholder` (en copy updated).
- **i18n:** `ai_model_section_label`, `ai_model_kling_v3_pro_i2v`, `ai_model_kling_v3_std_i2v` in all 18 locales; `postFormAiI18n.test.ts` extended.
- **`package.json`:** `test` script runs `test/aiModelRegistry.test.ts`.
- **Selection** is in-memory only (not persisted) — Story 3.3.

### File List

- `src/lib/ai/types.ts`
- `src/lib/ai/manifests/kling-i2v.json`
- `src/lib/ai/modelRegistry.ts`
- `src/lib/ai/index.ts`
- `src/lib/components/AiManager.svelte`
- `src/lib/i18n/ar.js`, `de.js`, `el.js`, `en.js`, `es.js`, `fa.js`, `fr.js`, `he.js`, `hi.js`, `id.js`, `it.js`, `ka.js`, `nl.js`, `pt.js`, `ru.js`, `th.js`, `tr.js`, `zh.js`
- `test/aiModelRegistry.test.ts`
- `test/postFormAiI18n.test.ts`
- `package.json`

### Change Log

- **2026-04-02:** Story created (`bmad-create-story`) — next Epic 3 backlog after sprint entries were all `done`.
- **2026-04-02:** Implemented (`bmad-dev-story`) — Kling manifests registry, `AiManager` model dropdown, i18n, tests; status → review.
- **2026-04-02:** Code review (`bmad-code-review`) — clean; status → done.

### Review Findings

- [x] [Review][Defer] **Story 3.3 wiring —** `selectedModelId` is internal to `AiManager`; credential form / job runner will need `bind:` or shared store — plan in 3.3.

- [x] [Review][Defer] **Optional hardening —** Runtime validation of `kling-i2v.json` vs `AiModelManifest` (or assert every `labelKey` in `en`) if manifest editing becomes frequent.

---

## Project context reference

- `_bmad-output/project-context.md` — Svelte 5, i18n, NodeNext imports.  
- `docs/AI_AGENTS.md` — optional deep file map.

## Latest technical notes (Atlas)

- Unified queue API surface for Atlas is documented at [Atlas Cloud docs](https://www.atlascloud.ai/docs/get-started); model identifiers follow `kwaivgi/...` patterns on model catalog pages.  
- If Pro/Std slugs change on the vendor site, update **only** the manifest/registry files and the unit test expectations.
