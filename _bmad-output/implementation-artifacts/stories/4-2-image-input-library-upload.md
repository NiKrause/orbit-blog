---
story_key: 4-2-image-input-library-upload
epic: 4
story: 4.2
frs: FR-7
ux_drs: UX-DR3, UX-DR4, UX-DR9, UX-DR10
---

# Story 4.2: Image input from library and upload

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **blog author**,  
I want **to pick an existing image from my media library or upload a new one for the job**,  
so that **the provider receives an image consistent with my blog’s media pipeline**.

## Acceptance Criteria

1. **Given** **`$mediaDB`** and **`$helia`** are available (same global stores as the post editor)  
   **When** the manifest’s **input schema** marks an image field (see Dev Notes — e.g. **`x-ui: "image"`** on a **`string`-typed** property, aligned with Story **4.1**)  
   **Then** **`AiSchemaFields`** (or equivalent) renders an **image control** with two explicit paths: **pick from library** and **upload**, not a single opaque text box for that field (**FR-7**, [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — §7.2 item 4]).

2. **And** **upload** uses the **same persistence path** as post media: new files are stored via the existing **media pipeline** (OrbitDB **`mediaDB`** + IPFS/Helia content addressing) — **no** parallel “AI-only” upload implementation that bypasses **`MediaUploader`** patterns ([Source: `_bmad-output/planning-artifacts/architecture.md` — FR-7 / media reuse]).

3. **And** **library pick** lists **existing images** from **`mediaDB`** (same query/filter semantics as **`MediaUploader.svelte`** for `type.startsWith('image/')`); selecting an item sets the field’s bound value to a **stable reference** the transport can use (e.g. **CID string** and/or **`Media`** identity — document the chosen contract in code comments and keep it consistent with Epic **5** job payload mapping).

4. **And** after upload or pick, the UI shows a **non-secret** confirmation: thumbnail and/or filename/CID short form; **no** full binary or raw token in logs (**NFR-1**, **UX-DR4**).

5. **And** when **`$mediaDB`** or **`$helia`** is missing, the control is **disabled** with a short **i18n** explanation (same spirit as **`MediaUploader`** / **`ai_credential_db_not_ready`** patterns).

6. **And** all **new** user-visible strings use **svelte-i18n** and are added to **every** `src/lib/i18n/*.js` file.

7. **And** **do not** read or write **`aiApiKey` / `aiApiUrl`** for this flow (**UX-DR9**).

8. **And** RTL: image row / picker layout respects **`$isRTL`** and the same **`dir`** patterns as **`AiManager`** (**UX-DR10**).

9. **Not in scope:** **Run** / job submit (Epic **5**), output video ingestion, changing **`Media`** document schema in OrbitDB, new npm dependencies unless justified in Dev Notes.

10. **Prerequisite:** Story **4.1** (`AiSchemaFields`, manifest **`inputSchema`**) is implemented or implemented in parallel — this story **extends** the schema renderer with an **image** widget; do not hardcode a second parallel form outside the schema system.

## Tasks / Subtasks

- [x] **Task 1 — Detect image fields (AC: 1, 10)**  
  - [x] In **`src/lib/ai/types.ts`** / **`AiInputPropertySchema`**, add optional **`x-ui?: 'image'`** (or agreed key). Update **`isPropertySchemaSupported`** in **`inputSchema.ts`** so **`string` + `x-ui: image`** does not fail **`isInputSchemaStructureSupported`** (extra keys must not invalidate the manifest).  
  - [x] **`AiSchemaFields`**: when rendering that property, mount **`AiImageField`** (or inline equivalent) instead of `<input type="text">`.

- [x] **Task 2 — Upload path (AC: 2, 4)**  
  - [x] Reuse **`MediaUploader.svelte`** behavior: either **embed** **`MediaUploader`** behind an “Upload” affordance or **extract** shared upload logic into a small module **only if** duplication would otherwise occur — preference: **compose existing component** or call the same functions **`MediaUploader`** uses after reading that file.  
  - [x] On success, receive **CID** / **`Media`** the same way **`onMediaSelected`** does today; bind into schema **`values`**.

- [x] **Task 3 — Library picker (AC: 1, 3)**  
  - [x] Implement a **compact** picker (grid or list) sourcing **`mediaDB.all()`** + image filter; thumbnails via existing **Helia/unixfs** or **gateway** fallback patterns from **`MediaUploader`**.  
  - [x] Selecting a row sets the field value consistently with Task 2.

- [x] **Task 4 — Wire + guards (AC: 5, 7, 8)**  
  - [x] **`AiManager`** / parent passes nothing that violates **UX-DR9**; use **`mediaDB`**, **`helia`** from **`$lib/store`**.  
  - [x] Disable + i18n when DB/IPFS not ready.

- [x] **Task 5 — Verification (AC: all)**  
  - [x] **`pnpm check`** and **`pnpm test`** pass.  
  - [x] Unit tests for pure helpers (e.g. “is image field”, value normalization) in **`test/`**; extend **`test/postFormAiI18n.test.ts`** `KEYS` for new **`ai_image_*`** (or chosen prefix) keys.  
  - [x] Document **manual** check: upload new image → appears in library → pick same image → value stable.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — FR-7, FR-8] — Reuse **media service** patterns; output **`Media`** creation is Epic **5** / **5.2**; this story is **input** only.  
- [Source: `src/lib/components/MediaUploader.svelte`] — Reference implementation for **load**, **upload**, **CID**, **events**.  
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR-7] — Upload + pick from **mediaDB**.

### Previous story intelligence (4.1)

- **`inputSchema`** on **`AiModelManifest`**; **`AiSchemaFields`** + **`validateAiInputSchema`**.  
- Image may have been a **plain string** placeholder in **4.1** — **4.2** replaces that control when **`x-ui: "image"`** is set.

### Previous story intelligence (3.x)

- **`AiManager`**: credentials, **`$isRTL`**, i18n patterns, no translation **`localStorage`** keys for AI credentials.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `src/lib/components/AiSchemaFields.svelte` (from 4.1) | Branch for **`x-ui: "image"`** |
| `src/lib/components/AiImageField.svelte` (new) | Library + upload composition |
| `src/lib/ai/types.ts` or `inputSchema.ts` | Optional **`x-ui`** on property schema |
| `src/lib/ai/manifests/*.json` | Add **`x-ui: "image"`** on the Kling image field when 4.1 schema exists |
| `src/lib/i18n/*.js` | New keys |
| `test/*` | Helpers + i18n key coverage |

### Testing standards

- Keep **secrets** and **seed** material out of tests.  
- Use **obvious fake** CIDs if needed.

### Git / conventions

- NodeNext **`.js`** suffix on imports from TS/Svelte.

## Dev Agent Record

### Agent Model Used

Cursor / Composer agent

### Debug Log References

### Completion Notes List

- **`x-ui: "image"`** on manifest string fields; **`isImageUiProperty`**, **`isPropertySchemaSupported`** updates in **`inputSchema.ts`**.
- **`AiImageField.svelte`**: upload + library grid mirroring **`MediaUploader`** (Helia **`addBytes`**, **`mediaDB.put`**); bound value is **CID string**; **`ai_image_*`** i18n across locales.
- **`kling-i2v.json`**: image property includes **`"x-ui": "image"`**.
- **`AiManager.svelte`**: `validateAiInputSchema` narrowing fixed (`r.ok === false`) for **`svelte-check`**.

### File List

- `src/lib/ai/types.ts`
- `src/lib/ai/inputSchema.ts`
- `src/lib/ai/index.ts`
- `src/lib/ai/manifests/kling-i2v.json`
- `src/lib/components/AiImageField.svelte`
- `src/lib/components/AiSchemaFields.svelte`
- `src/lib/components/AiManager.svelte`
- `src/lib/i18n/*.js`
- `test/aiInputSchema.test.ts`
- `test/postFormAiI18n.test.ts`

### Change Log

- **2026-04-02:** Story 4.2 implemented — image field widget, manifest flag, tests.

---

## Project context reference

- `_bmad-output/project-context.md` — Svelte 5, i18n, `pnpm check`, `$lib` exports.

---

## validate-create-story (checklist) — 2026-04-02

**Workflow:** `_bmad/bmm/4-implementation/bmad-create-story/checklist.md`

| Severity | Finding | Resolution |
| --- | --- | --- |
| **Should** | **4.1** may not ship before **4.2**; dependency risk. | AC10 + Tasks: explicit prerequisite; implement **4.1** schema hooks first or same sprint with clear merge order. |
| **Should** | **Transport** payload shape (CID vs URL) undefined until Epic **5**. | AC3: document **bound value** contract in code comments; keep **string**-typed for validator compatibility. |
| **Should** | Duplicating **IPFS** upload logic would violate UX “no duplicate IPFS”. | Task 2: **reuse** **`MediaUploader`** or shared functions — **forbid** new ad-hoc `unixfs.add` in AI-only files unless extracted shared helper. |
| **OK** | **FR-7** / Epic **4.2** BDD in `epics.md` matches story. | — |
| **OK** | **UX §7.2** image sub-paths (library + upload) reflected in AC1–2. | — |
| **Critical** | Adding **`x-ui: "image"`** must not break **`isPropertySchemaSupported`** / **`isInputSchemaStructureSupported`** in `inputSchema.ts` (today only known keys on **`AiInputPropertySchema`**). | Task 1: extend **`AiInputPropertySchema`** with optional **`x-ui?: 'image'`** and update **`isPropertySchemaSupported`** so **`string` + `x-ui: image`** remains valid; **or** document an alternate flag already allowed by types. |
| **Should** | **`validateAiInputSchema`** treats image value as a **string** (CID or URL); required image fields stay empty until pick/upload — same as other required strings. | No validator change if bound value is a non-empty string; document in Dev Notes. |
| **Should** | **`MediaUploader.svelte`** uses **`onMediaSelected`** callback signature — **`AiImageField`** must match when composing. | Task 2: read **`MediaUploader`** props and align callback. |

**Definition of Done (validation):** Story file present; sprint-status updated; ready for `bmad-dev-story`.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (BMad create-story workflow). *Sprint file had no `backlog` row; story **4.2** was added from `epics.md` as the next Epic 4 item.*
