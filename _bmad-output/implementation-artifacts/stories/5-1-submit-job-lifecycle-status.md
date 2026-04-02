---
story_key: 5-1-submit-job-lifecycle-status
epic: 5
story: 5.1
frs: FR-8, FR-9
ux_drs: UX-DR7, UX-DR10
---

# Story 5.1: Submit job and show lifecycle status

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **blog author**,  
I want **to run generation and see progress and clear errors**,  
so that **I know whether to wait, fix config, or retry**.

## Acceptance Criteria

1. **Given** saved **per-model credentials** (base URL + API key) for the **selected manifest model** and **valid** dynamic **input** values per Story **4.1** / **4.2** (`validateAiInputSchema` passes, `canSubmitInputs` is true)  
   **When** I activate **Run generation**  
   **Then** the app calls **`AiHttpTransport.submitJob`** with **`AiSubmitJobInput`** built from the manifest’s **provider `model`** string and a **`body`** object derived from **`inputValues`** (field mapping documented in Dev Notes; no secrets in `body`).

2. **And** the UI enters a **running** phase: **Run** is disabled while the job is non-terminal; the **job status area** (UX **§7.2** item **6**) shows **queued** → **running** as reported by **`pollStatus`** until **succeeded** or **failed** (**UX-DR7**).

3. **And** on **terminal success**, the status area shows an explicit **succeeded** state (e.g. checkmark + short message). **Video preview, `<video>` embed, and writing output to `mediaDB`** are **Story 5.2** — this story may show a **non-sensitive** hint only (e.g. optional `assetUrl` from **`fetchResult`** as plain text/link) if already available, but **must not** block on full ingestion.

4. **And** on **terminal failure** (including **`pollStatus`** returning **`failed`**, **`submitJob`** throw, or transport error), the user sees an **inline** error using **`var(--danger)`** with an **i18n** message (**FR-9**); **no toast-only** for blocking errors (**UX** §7.2 item **7**).

5. **And** **FR-9** / **actionable errors:** map common cases to dedicated **i18n keys** (not English literals in core logic), including at minimum: **network / fetch failure**, **HTTP 401 / 403** (auth), **429** (rate limit), **4xx/5xx** generic bucket, **CORS / opaque failure** where the browser cannot read the response — document the mapping in code comments. Use **`MockAiHttpTransport`** for unit tests and dev without network; real **`fetch`**-based transport may stub or forward errors into the same mapping.

6. **And** **NFR-1:** do not **log** decrypted API keys, full prompts, or raw error bodies containing secrets in production paths.

7. **And** all **new** user-visible strings use **svelte-i18n** and are added to **every** `src/lib/i18n/*.js` file (English in `en.js`; other locales may mirror English until translated).

8. **And** **UX-DR9:** do **not** read or write translation **Settings** keys **`aiApiKey` / `aiApiUrl`** for this flow.

9. **And** **RTL:** job status row and error text align with **`AiManager`** **`dir`** / **`$isRTL`** patterns (**UX-DR10**).

10. **Not in scope:** **Story 5.2** — ingest output video into `mediaDB`, attach to draft, markdown insertion; **persistent job history** documents in AI DB (optional follow-up); **cancel job** API if vendor does not support it; **dynamic import** bundle split (NFR-3) unless already trivial.

## Tasks / Subtasks

- [x] **Task 1 — Job payload + transport wiring (AC: 1, 5, 6)**  
  - [x] Add a small **pure helper** (e.g. `buildSubmitJobInput(manifest, inputValues): AiSubmitJobInput`) or equivalent, documented with **how** `inputValues` map to provider **`body`** (Kling/Atlas field names per [Atlas Kling image-to-video API](https://www.atlascloud.ai/models/kwaivgi/kling-v3.0-pro/image-to-video?tab=api) at implementation time).  
  - [x] Add **`fetch`-based `AiHttpTransport`** implementation (e.g. `AtlasAiHttpTransport` or `FetchAiHttpTransport`) in `src/lib/ai/` that implements **`submitJob` / `pollStatus` / `fetchResult`** using **`baseUrl` + `apiKey`** from credentials — **or** clearly stub **`submit`/`poll`** with `fetch` and throw **`not implemented`** for result until paths are verified, while keeping **mock** for tests.  
  - [x] Ensure **credentials** come from **`loadAiCredentialDetailed`** + **`getProviderModelForId`** — same path as **save** in **`AiManager`**.

- [x] **Task 2 — Run control + lifecycle state (AC: 2, 4, 7–9)**  
  - [x] Add **Run generation** button to **`AiManager.svelte`** (or extracted subcomponent): disabled when **`!canSubmitInputs`**, **`loadingCredential`**, missing **`aiDB`/`identitySeed32`**, or no saved key for model, or while job **in flight**.  
  - [x] Implement **async lifecycle** loop: **`submitJob` → poll until `succeeded` \| `failed`** (respect **`MockAiHttpTransport`** needing multiple polls). Use **`$state`** / **`$derived`** for **`jobPhase`**: `idle` \| `running` \| `succeeded` \| `failed`.  
  - [x] On success, optionally call **`fetchResult`** to show **`assetUrl`** hint; catch errors without failing the whole UX if **5.2** will handle media.  
  - [x] **Inline** error display + **spinner** / status text per **UX-DR7**.

- [x] **Task 3 — Error mapping (AC: 4, 5)**  
  - [x] Centralize **HTTP → i18n key** mapping in a **pure** function (e.g. `mapAiTransportError(err): string` returning an **i18n key**).  
  - [x] Cover **CORS** / **TypeError** / **status codes** paths used in **FR-9** tests.

- [x] **Task 4 — Tests + check (AC: all)**  
  - [x] Unit tests: error mapper, **mock transport** lifecycle (happy path + failure), optional **buildSubmitJobInput** shape.  
  - [x] Extend **`test/postFormAiI18n.test.ts`** `KEYS` for new **`ai_job_*`** / **`ai_run_*`** keys.  
  - [x] **`pnpm check`** and **`pnpm test`** green.

### Review Findings

_(BMad code-review — 2026-04-02; single-pass blind + edge + acceptance audit.)_

- [x] [Review][Patch] **Poll cap uses generic unknown error** — When the poll loop hits `maxPolls` (~6 minutes at 2s), the UI sets `ai_job_error_unknown`. Users cannot tell **timeout** from other failures. Prefer a dedicated i18n key (e.g. `ai_job_error_timeout`) and set `jobErrorKey` to it when the loop exits without a terminal status. [`AiManager.svelte` ~299–300] — **Fixed:** `AI_JOB_ERROR_KEYS.timeout` + `ai_job_error_timeout` in all locales; poll exhaustion sets timeout key.

- [x] [Review][Defer] **Sprint hygiene: Epic 4 story status** — `4-1-json-schema-field-renderer` remains `in-progress` in `sprint-status.yaml` while 5.1 was developed; reconcile when convenient. [pre-existing tracking]

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — API patterns, FR-9] — UI calls **transport**, not scattered **`fetch`**; **job state machine** `queued` → `running` → `succeeded` \| `failed` aligned with **`AiPollStatusResult`**.  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Jobs in AI DB] — **5.1** may stay **ephemeral UI state**; persisting **`job:{uuid}`** docs is optional and not required for AC.  
- [Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — §7.2 items 5–7] — **Run** disabled rules; **job status area**; **inline** errors.

### Previous story intelligence (4.x)

- **`AiManager`**: **`aiInputValidation`**, **`canSubmitInputs`**, **`data-can-submit-inputs`**, **`getManifestById`**, **`getProviderModelForId`**, credentials, **`AiSchemaFields`**, image fields (**4.2**) with **CID**-backed values — **`buildSubmitJobInput`** must define how **CIDs** / URLs appear in the **Atlas** body (e.g. `image` URL field — confirm against vendor docs).  
- **`MockAiHttpTransport`**: deterministic **`pollStatus`** sequence — use in tests; avoid timing flakes with **`await`** in tests.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `src/lib/components/AiManager.svelte` | Run button, job status UI, wire transport |
| `src/lib/ai/*.ts` | Transport impl, **`buildSubmitJobInput`**, error mapper |
| `src/lib/ai/index.ts` | Export public types/helpers |
| `src/lib/i18n/*.js` | New keys |
| `test/*.ts` | Mock lifecycle + mapper tests |

### Testing standards

- No real API keys in repo; use **mocks** and **fake** URLs.  
- Follow existing **Mocha** + **`ts-node/esm`** patterns in **`package.json`** test script.

### Git / conventions

- **NodeNext** `import` with **`.js`** suffix in TS sources.  
- Match **`AiManager`** styling tokens (**`var(--danger)`**, **`btn`**, **`max-w-md`**).

## Dev Agent Record

### Agent Model Used

Cursor agent — 2026-04-02

### Debug Log References

— 

### Completion Notes List

- **`FetchAiHttpTransport`**: Atlas `POST /api/v1/model/generateVideo`, `GET /api/v1/model/getResult?predictionId=` per Atlas video docs; maps `completed`/`failed`/etc. to `AiJobLifecycleStatus`.
- **`buildSubmitJobInput`**: schema-ordered body; **`x-ui: image`** maps to Atlas **`image`** (HTTPS URL) via **`cidOrHttpToImageUrl`** for bare CIDs.
- **`AiManager`**: **`runEpoch`** abandons in-flight runs on model change; **`handleRunGeneration`** uses **`loadAiCredentialDetailed`** + **`FetchAiHttpTransport`**; **`hasSavedCredential`** requires a saved key (masked), not only a typed key; max **180** polls (~6 min at 2s); job status UI + **`ai_job_*`** / **`ai_run_generation`**.
- **`aiJobErrors.ts`**: **`AiTransportError`**, **`mapAiTransportError`**, **`mapHttpStatusToAiJobErrorKey`** (401 → auth, **403 → `ai_job_error_forbidden`**, 429, 4xx/5xx, CORS/status 0).

### File List

- `src/lib/ai/aiJobErrors.ts`
- `src/lib/ai/fetchAiHttpTransport.ts`
- `src/lib/ai/buildSubmitJobInput.ts`
- `src/lib/ai/index.ts`
- `src/lib/components/AiManager.svelte`
- `src/lib/i18n/*.js`
- `test/aiJobErrors.test.ts`
- `test/buildSubmitJobInput.test.ts`
- `test/fetchAiHttpTransport.test.ts`
- `test/aiJobLifecycle.test.ts`
- `test/postFormAiI18n.test.ts`
- `package.json`

### Change Log

- **2026-04-02:** Story 5.1 — Run generation, Atlas fetch transport, error i18n mapping, tests; sprint status → review.
- **2026-04-02:** Code-review patch — poll exhaustion uses `ai_job_error_timeout` (not `unknown`); `el.js` indent normalized for `show_preview` block.

---

## Project context reference

- `_bmad-output/project-context.md` — Svelte 5, i18n, `pnpm check`.

---

**Completion note (create-story):** Ultimate context engine analysis completed — comprehensive developer guide created (BMad create-story workflow).
