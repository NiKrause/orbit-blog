---
story_key: 3-3-per-model-url-key-form
epic: 3
story: 3.3
frs: FR-2, FR-3
ux_drs: UX-DR3, UX-DR4, UX-DR9, UX-DR10
---

# Story 3.3: Per-model URL and key form with save and mask

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **blog author**,  
I want **to enter base URL and API key for the selected model and save**,  
so that **I can run jobs later without retyping secrets every session**.

## Acceptance Criteria

1. **Given** a **selected model** from the Story 3.2 registry (manifest id / provider `model` string known)  
   **When** the user enters **base URL** and **API key** and clicks **Save**  
   **Then** credentials persist via **`saveAiCredential`** on **`$aiDB`** with encryption (Epic 2 / `src/lib/ai/aiCredentialStore.ts`) using the **same `modelId`** the registry uses for Atlas payloads (the manifest’s `model` field, e.g. `kwaivgi/kling-v3.0-pro/image-to-video`).

2. **And** after a successful save, the API key field is **not** left filled with plaintext in the UI; the user sees a **masked** representation (**UX-DR4**), e.g. dot prefix + **last 4 characters** of the key (pattern in [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — §7.2 Credentials]).

3. **And** **base URL** is shown/stored as saved (trimmed); invalid empty save is rejected with inline validation.

4. **And** **translation** Settings storage is **not** used: do **not** read or write `aiApiKey` / `aiApiUrl` from `$lib/store.ts` for this flow (**UX-DR9**). AI Manager credentials use **only** the AI OrbitDB path.

5. **And** all **new** user-visible strings use **svelte-i18n** and are added to **every** `src/lib/i18n/*.js` file (same pattern as Stories 3.1–3.2).

6. **And** RTL: credential row layout respects existing **`$isRTL`** / `rtl` usage from the parent form (**UX-DR10**).

7. **Not in scope:** JSON schema–driven dynamic fields (Epic 4), job submit / HTTP calls (Epic 5), changing Epic 2 crypto algorithms, new OrbitDB schemas beyond existing `AiCredentialDocument`.

8. **Prerequisite:** Story **3.2** is implemented (`modelRegistry`, manifest-backed model selection in `AiManager`). This story extends that UI; **do not** invent a parallel model list.

## Tasks / Subtasks

- [x] **Task 1 — Identity seed + DB wiring (AC: 1, 7)**  
  - [x] Ensure **`$aiDB`** (from `$lib/store.ts`) and a **32-byte identity seed** are available to `AiManager` (or a child component) in the same way other features use `convertTo32BitSeed` + identity material (see **`LeSpaceBlog.svelte`** bootstrap and [Source: `src/lib/ai/aiCredentialStore.ts` — header comment]).  
  - [x] Preferred pattern: add a small **`identitySeed32` store** (or pass props **`LeSpaceBlog` → `PostForm` → `AiManager`**) set once when the blog identity is ready; **do not** log the seed or API key.  
  - [x] If `$aiDB` is null (DB not ready), disable Save and show a short i18n message.

- [x] **Task 2 — Credential form UI (AC: 1–3, 5–6)**  
  - [x] In **`AiManager.svelte`** (after Story 3.2 model selector): add **Base URL** (`type="url"` or text with validation), **API key** (`type="password"` while editing), and **Save** (`type="button"`).  
  - [x] Bind **`modelId`** for `saveAiCredential` to **`manifest.model`** (Atlas provider string). The manifest’s **`id`** (e.g. `kwaivgi-kling-v3-pro-i2v`) is **only** for UI selection — **never** pass `id` to `saveAiCredential`. Use `getProviderModelForId(selectedId)` from **`src/lib/ai/modelRegistry.ts`** or the bound manifest’s **`.model`** field.  
  - [x] On Save: `trim` URL and key; validate non-empty URL and non-empty key on first save; call `saveAiCredential($aiDB, identitySeed32, { modelId, baseUrl, apiKey })`; handle errors inline (no `console.log` of secrets — **NFR-1**).

- [x] **Task 3 — Masked key after save (AC: 2)**  
  - [x] After successful save: clear the password input; set local UI state to **masked** display using last 4 characters of the key that was saved (compute from the value submitted in that save). Match UX §7.2: `••••••` + last4 where feasible.  
  - [x] On panel open / model change: if a credential exists for that `modelId`, **`loadAiCredential`** may be used **once** to populate `baseUrl` and derive **last 4** for mask only; **never** echo full plaintext in the UI after load. If decrypt fails, treat as “not configured” with inline message.  
  - [x] **Edit / rotate key:** When the user chooses to change the API key, clear the masked state and show an **empty** password field; they must enter the **full** new key (no editing of the masked string). Optional i18n “Change API key” / “Replace key” control.

- [x] **Task 4 — Separation guard (AC: 4)**  
  - [x] Confirm no imports of `aiApiKey` / `aiApiUrl` from `store.ts` in `AiManager` or new credential components.

- [x] **Task 5 — Verification**  
  - [x] `pnpm check` passes.  
  - [x] `pnpm test` passes; extend **`test/postFormAiI18n.test.ts`** (or add **`test/aiCredentialForm.test.ts`**) with keys for new i18n strings **or** a small unit test for a pure **`maskApiKeyHint`** helper if extracted.  
  - [x] Manual: save for Pro model, switch to Standard, save different URL/key, switch back — each model retains its own row per Epic 2 multi-model behavior.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Data / Security] — Per-model credentials in **AI OrbitDB**; **encrypt** with identity-derived key; **no** translation `localStorage` keys for AI Manager.  
- [Source: `src/lib/ai/aiCredentialStore.ts`] — `saveAiCredential`, `loadAiCredential`, `normalizeModelId`; document `_id` prefix `credential:`.  
- [Source: `src/lib/ai/credentialTypes.ts`] — `AiCredentialDocument` shape; no plaintext API key on disk.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `src/lib/components/AiManager.svelte` | Base URL + API key + Save; masked state; optional load on model change |
| `src/lib/components/PostForm.svelte` and/or `LeSpaceBlog.svelte` | Thread identity seed / or init store — **only if** no seed access yet |
| `src/lib/store.ts` | Optional: `identitySeed32` writable — **only if** chosen pattern |
| `src/lib/i18n/*.js` | New keys (labels, errors, save, masked hint, DB-not-ready) |
| `test/*` | i18n key coverage and/or mask helper test |

### Previous story intelligence (3.2)

- **`AiModelManifest`** in **`src/lib/ai/types.ts`**: **`id`** (selection state) ≠ **`model`** (provider string). **`getProviderModelForId(id)`** / **`getManifestById`** in **`src/lib/ai/modelRegistry.ts`** are the supported accessors.  
- **`saveAiCredential`**’s `modelId` **must** equal **`manifest.model`** (e.g. `kwaivgi/kling-v3.0-pro/image-to-video`), **not** `manifest.id`. Wrong id breaks Atlas jobs and multi-model isolation.  
- **Do not** duplicate registry data; extend **`AiManager.svelte`** in place.

### Previous story intelligence (Epic 2)

- **`saveAiCredential` / `loadAiCredential`** are implemented and tested under **`test/aiCredentialCrypto.test.ts`** — reuse patterns (mock `put`/`get`) for any new unit tests.  
- Multi-model isolation was verified in Story 2.3 tests — saving for model A must not overwrite model B.

### Library / versions

- No new npm dependencies expected.  
- Web Crypto path already used by **`aiCredentialCrypto.ts`**.

### Testing standards

- `pnpm check` required.  
- Keep **secrets out of** test fixtures in logs; use obvious fakes like existing tests.

### Git / conventions

- NodeNext **`.js`** suffix on TS imports.  
- **NFR-1:** no `console.log` of API keys or decrypted material.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Added **`identitySeed32`** writable in `store.ts`, set in **`LeSpaceBlog.svelte`** after `convertTo32BitSeed(masterSeed)` (same material as OrbitDB identity).
- **`AiManager.svelte`**: credential section with base URL, API key, Save; **`$effect`** loads **`loadAiCredentialDetailed`** per selected manifest **`model`** (Atlas id); save uses **`saveAiCredential`** with **`getProviderModelForId`**; masked display via **`maskApiKeyLast4`** on **`keyLast4Suffix`**; “Change API key” clears mask; URL-only updates merge prior key via **`loadAiCredentialDetailed`** when the password field is empty.
- **`aiCredentialStore.ts`**: **`loadAiCredentialDetailed`** distinguishes **`missing`** vs **`decrypt_failed`** for inline copy; **`loadAiCredential`** unchanged for callers.
- **`maskApiKey.ts`** + **`test/maskApiKey.test.ts`**; i18n keys in all locales; **`postFormAiI18n.test.ts`** and **`test/aiCredentialCrypto.test.ts`** extended.
- No `aiApiKey` / `aiApiUrl` imports in `AiManager`.

### File List

- `src/lib/store.ts`
- `src/lib/components/LeSpaceBlog.svelte`
- `src/lib/components/AiManager.svelte`
- `src/lib/ai/maskApiKey.ts`
- `src/lib/ai/aiCredentialStore.ts`
- `src/lib/ai/index.ts`
- `src/lib/i18n/*.js`
- `test/maskApiKey.test.ts`
- `test/aiCredentialCrypto.test.ts`
- `test/postFormAiI18n.test.ts`
- `package.json`
- `_bmad-output/implementation-artifacts/stories/3-3-per-model-url-key-form.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- **2026-04-02:** Story 3.3 implemented — per-model credentials form, mask, `identitySeed32` wiring, tests.

### Review Findings

_Senior Developer Review (AI) — 2026-04-02_

- [x] [Review][Patch] **Error text color token** — Resolved: `saveError` uses `var(--danger)` in `AiManager.svelte`.

- [x] [Review][Patch] **Masked key state naming** — Resolved: state is `keyLast4Suffix` with an inline comment (last four chars for mask only).

- [x] [Review][Defer] **`identitySeed32` not cleared on session teardown** [`store.ts` / `LeSpaceBlog.svelte`] — deferred, pre-existing pattern; address if the app adds logout / identity reset that must zero sensitive material.

**Layers:** Blind Hunter (security/logging, duplication of decrypt on save-merge), Edge Case Hunter (race/`loadSeq`, decrypt-fail path, RTL `dir` + button row), Acceptance Auditor (AC: `getProviderModelForId` for `modelId`, no `aiApiKey`/`aiApiUrl` in `AiManager`, masked UX, `loadAiCredentialDetailed` for decrypt vs missing). **Dismissed:** non-`en` locales using English for new strings (matches project placeholder pattern).

---

## Project context reference

- `_bmad-output/project-context.md` — Svelte 5, i18n, `pnpm check`.

---

## validate-create-story (checklist) — 2026-04-02

**Workflow:** `_bmad/bmm/4-implementation/bmad-create-story/checklist.md`

| Severity | Finding | Resolution |
| --- | --- | --- |
| **Critical** | Risk of passing manifest **`id`** instead of provider **`model`** to `saveAiCredential`, breaking credentials and jobs. | Tasks + Dev Notes now name **`getProviderModelForId`**, **`AiModelManifest`**, and forbid using **`id`** as `modelId`. |
| **Should** | Edit flow after mask was unspecified (incremental edit of masked text is invalid). | Task 3: full re-entry on key change; optional “Change API key” pattern. |
| **Should** | Story 3.2 dependency implicit. | AC8 prerequisite: 3.2 / registry present. |
| **Should** | UX §7.2 shows dot + last4 explicitly. | Task 3 references that pattern. |
| **OK** | Epics 3.3 AC aligns with `_bmad-output/planning-artifacts/epics.md` and FR-2 / FR-3. | — |
| **OK** | Separation from `aiApiKey` / `aiApiUrl` explicit (UX-DR9). | — |

**Optional (not added as AC):** UX inventory “trust copy” for encryption-at-rest — add short i18n line under credential section if product wants it in M1.

**Definition of Done (validation):** Story updated; ready for `bmad-dev-story` after 3.2 is done.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (BMad create-story workflow).
