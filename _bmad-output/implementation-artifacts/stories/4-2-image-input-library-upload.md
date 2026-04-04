---
story_key: 4-2-image-input-library-upload
epic: 4
story: 4.2
frs: FR-7, FR-7b, FR-7e, FR-7f
ux_drs: UX-DR3, UX-DR4, UX-DR9, UX-DR10
prd_alignment: 'PRD v1.1 + epics.md (2026-04-04); FR-7c/FR-7d/LED → Story 4.3'
---

# Story 4.2: Image input from library and upload

Status: done

<!-- PRD v1.1 ACs satisfied; FR-7e remove control shipped 2026-04-04 (code review). -->

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **blog author**,  
I want **to pick an existing image from my media library or upload a new one for the job**,  
so that **the provider receives an image consistent with my blog’s media pipeline**.

## Acceptance Criteria

Aligned with **`_bmad-output/planning-artifacts/epics.md`** — Epic **4**, Story **4.2** and **`prd.md`** **FR-7**, **FR-7b**, **FR-7e**, **FR-7f**. **Out of scope here:** relay **LED**, replication/pin **detection**, **`VITE_RELAY_PINNED_CID_BASE`** preview loading — **Story 4.3** (**FR-7c**, **FR-7d**).

1. **Given** **`$mediaDB`** and **`$helia`** are available (same global stores as the post editor)  
   **When** the manifest’s **input schema** marks an image field (e.g. **`x-ui: "image"`** on a **`string`-typed** property, Story **4.1**)  
   **Then** **`AiSchemaFields`** renders an **image control** with two explicit paths: **pick from library** and **upload**, not a single opaque text box for that field (**FR-7**, UX spec §7.2).

2. **And** **upload** uses the **same persistence path** as post media: OrbitDB **`mediaDB`** + IPFS/Helia content addressing — **no** parallel “AI-only” upload that bypasses established **`MediaUploader`** / **`AiImageField`** patterns (architecture FR-7).

3. **And** **library pick** lists **existing images** from **`mediaDB`** (`type.startsWith('image/')`); selecting sets a **stable reference** for transport (**CID string**, consistent with Epic **5** payload mapping — document in code).

4. **And** **FR-7b — immediate mediaDB write:** a **`Media`** document exists in **`mediaDB`** **before** post save when the user uploads from **AI Manager** image fields, and the same immediate-write expectation applies to **Media Manager** uploads on the same screen where applicable ([Source: `prd.md` FR-7b, `epics.md` Story 4.2]).

5. **And** **FR-7f — single vs multi image:** for manifests with **one** image slot, a new upload **replaces** the prior input; for manifests with **multiple** image properties (or a declared multi-image shape per manifest), the UI supports **multiple concurrent** inputs as required by the schema ([Source: `prd.md` FR-7f]).

6. **And** **FR-7e — remove control:** each input thumbnail (or selected-input preview region) exposes a **(×)** that clears that input from the job form and applies **media delete semantics** consistent with **Media Manager** ([Source: `prd.md` FR-7e, UX spec §7.2 / §7.5 via Story 4.3 for LED placement).

7. **And** after upload or pick, the UI shows a **non-secret** confirmation: thumbnail and/or filename/CID short form; **no** full binary or sensitive material in logs (**NFR-1**, **UX-DR4**).

8. **And** when **`$mediaDB`** or **`$helia`** is missing, the control is **disabled** with a short **i18n** explanation.

9. **And** all **new** user-visible strings use **svelte-i18n** across locales (**UX-DR3**).

10. **And** **do not** read or write **`aiApiKey` / `aiApiUrl`** for this flow (**UX-DR9**).

11. **And** RTL: layout respects **`$isRTL`** and **`dir`** like **`AiManager`** (**UX-DR10**).

12. **Not in scope:** **Run** / job submit (Epic **5**), output ingestion, **relay LED** / **FR-7c** / **FR-7d** (Story **4.3**), changing core **`Media`** schema unless required by delete semantics, new npm deps unless justified.

13. **Prerequisite:** Story **4.1** (`AiSchemaFields`, **`inputSchema`**) — this story **extends** the schema renderer with the **image** widget only.

## Tasks / Subtasks

- [x] **Task 1 — Detect image fields (AC: 1, 13)**  
  - [x] Optional **`x-ui?: 'image'`** on **`AiInputPropertySchema`**; **`inputSchema.ts`** allows **`string` + `x-ui: image`**.  
  - [x] **`AiSchemaFields`**: mount **`AiImageField`** for image UI properties.

- [x] **Task 2 — Upload path (AC: 2, 7)**  
  - [x] Same Helia **`addBytes`** + **`mediaDB.put`** pattern as **`MediaUploader`**; bind **CID string** into **`values`**.

- [x] **Task 3 — Library picker (AC: 1, 3)**  
  - [x] Grid from **`mediaDB.all()`** + image filter; pick sets **CID**.

- [x] **Task 4 — Wire + guards (AC: 8, 10, 11)**  
  - [x] **`AiManager`** / stores; **UX-DR9**; disable + i18n when DB/IPFS not ready; RTL.

- [x] **Task 5 — Verification (baseline)**  
  - [x] **`pnpm check`** / **`pnpm test`**; **`ai_image_*`** i18n keys; manual: upload → library → pick.

- [x] **Task 6 — PRD v1.1 gaps (AC: 4–6)**  
  - [x] **FR-7b:** **`AiImageField`** and **`MediaUploader`** **`put`** on upload (immediate **mediaDB** write) — spot-check **before post save** if regressions suspected.  
  - [x] **FR-7e:** **(×)** on selected preview (**`inset-inline-start`** so it does not overlap **`RelaySyncLed`** on **`inset-inline-end`**); **`mediaDB.del`** by resolving **`_id`** from **`cid`**; revokes cached blob URL; **`ai_image_remove_aria`** i18n.  
  - [x] **FR-7f (current manifests):** one **CID** per **`string` + `x-ui: image`** property; new upload **replaces** that field; multiple image **properties** (e.g. `image` + `end_image`) = multiple **`AiImageField`** instances. **Follow-up:** if a manifest uses **array-of-images** in one property, extend **`AiSchemaFields`** / types — not required by present Kling manifest.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — FR-7, FR-8] — Reuse **media service** patterns; output **`Media`** creation is Epic **5** / **5.2**; this story is **input** only.  
- [Source: `src/lib/components/MediaUploader.svelte`] — Reference implementation for **load**, **upload**, **CID**, **events**.  
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR-7, FR-7b, FR-7e, FR-7f] — Immediate **mediaDB** write, remove **(×)**, single vs multi image inputs.  
- **Relay LED / pin polling:** **FR-7c**, **FR-7d** — Story **4.3** only.

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
- **2026-04-04 (PRD v1.1 doc sync):** Story ACs and **FR** list updated; **FR-7c/d** wording defers LED to Story **4.3** (implementation later merged relay UI into **`AiImageField`** — see Review Findings).  
- **2026-04-04:** **FR-7e** remove control + **bmad-code-review** closure.

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
- **2026-04-04:** Aligned story with **PRD v1.1** / **`epics.md`** Story **4.2** — added **FR-7b**, **FR-7e**, **FR-7f**; deferred **LED** / **FR-7c**–**d** to **4.3**; status **review** pending **Task 6** (**FR-7e**).
- **2026-04-04:** **bmad-code-review** — **FR-7e** implemented; status **done**; sprint **4-2** → **done**.

### Review Findings

#### Code review — 2026-04-04 (BMad triage vs Story 4.2 + `AiImageField.svelte`)

- [x] [Review][Patch] **FR-7e missing (×) remove** — **AC6** was unmet; added remove control with **`mediaDB.del`**, **`onSelectCid('')`**, blob URL revoke, **`ai_image_remove_aria`** in all locales; **`pnpm check` / `pnpm test`** green. [`src/lib/components/AiImageField.svelte`, `src/lib/i18n/*.js`, `test/postFormAiI18n.test.ts`]

- [x] [Review][Defer] **Story AC12 vs implementation: relay LED in 4.2 component** — **`AiImageField`** includes **`RelaySyncLed`** + polling (**Story 4.3**). Story text still marks **FR-7c**/**d** as out of scope for 4.2; acceptable shared-widget delivery — **update epic cross-refs** when **4.3** is closed so docs match code.

- [x] [Review][Defer] **`getBlobUrl` concatenates chunks with spread in a loop** — **O(n²)** bytes copy for large images; pre-existing; revisit if large uploads become common. [`AiImageField.svelte`]

- [x] [Review][Dismiss] **Oversize upload throws English `Error`** — Caught by **`uploadFiles`** and logged only; no new plaintext secret leakage (**NFR-1**).

**Acceptance snapshot (auditor):** **AC1–5, 7–11, 13** **met** after **FR-7e** patch. **AC12** (LED out of 4.2): **implementation exceeds** narrow wording — tracked as defer above.

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

**Completion note:** Baseline **2026-04-02**; PRD v1.1 + **FR-7e** + code review **2026-04-04** — story **`done`**.
