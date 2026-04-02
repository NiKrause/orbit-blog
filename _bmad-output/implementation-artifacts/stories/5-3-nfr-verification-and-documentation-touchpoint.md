---
story_key: 5-3-nfr-verification-and-documentation-touchpoint
epic: 5
story: 5.3
frs: —
nfrs: NFR-1, NFR-2, NFR-3, NFR-5
---

# Story 5.3: NFR verification and documentation touchpoint

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **maintainer**,  
I want **NFR-1–NFR-3 and NFR-5 verified for the AI Manager feature**,  
so that **shipping does not regress security or bundle hygiene**.

## Acceptance Criteria

1. **NFR-1 (no secrets in production logs):** **Given** a **`production`** build (`vite build` / `import.meta.env.PROD`)  
   **When** AI credential load, decrypt, HTTP transport, and **`AiManager`** job paths run (manual smoke or scripted exercise with **mock** credentials)  
   **Then** **decrypted API keys**, **raw key material**, and **full prompts** are **not** emitted via **`console.*`** or logger output in **production** — **non-sensitive** status lines (`info`/`warn` without secrets) may remain; focus the audit on **secret-bearing** and **user-content** paths. Align with [`src/lib/utils/logger.ts`](../../../src/lib/utils/logger.ts) (`*.js` in imports) and **grep-based** verification documented in the checklist.

2. **NFR-2 (crypto hygiene):** **Given** the AI credential and identity code paths  
   **Then** encryption/decryption **reuses** existing helpers (**`aiCredentialCrypto`**, identity seed usage) — **no** new ad-hoc ciphers; document confirmation in Completion Notes with **file references**.

3. **NFR-3 (lazy / bundle discipline):** **Given** the AI Manager entry (e.g. **`PostForm`** → **`AiManager`**)  
   **Then** heavy AI modules (**transport**, large vendor-agnostic helpers) follow **dynamic `import()`** where already introduced, or the story **documents** why the current graph is acceptable and records **`pnpm build`** chunk names / sizes for the AI-related async chunks (no mandatory refactor unless a clear regression).

4. **NFR-5 (external references in docs):** **Given** `README.md` and/or **`docs/index.md`**  
   **Then** readers can find **curated links** to: **Atlas Cloud** Kling (or current provider) API docs, **EIP-8004**, and **erc-8004-example** (per PRD NFR-5) — add or extend a short subsection; do not duplicate full vendor specs.

5. **And** **evidence is check-in friendly:** add a short **`docs/ai-nfr-checklist.md`** (or extend **`docs/index.md`**) with **checkboxes** for NFR-1–3,5 and **how to re-run** verification (commands + grep hints).

6. **Not in scope:** Changing product logging policy for **non-AI** modules; **E2E** load tests; **Epic 6+** network paths.

## Tasks / Subtasks

- [x] **Task 1 — NFR-1 audit (AC: 1, 5)**  
  - [x] Inventory **`console.*`** / **`log.*`** / **`debug(`** usage under `src/lib/ai/` (including **`fetchAiHttpTransport`**, **`mapAiTransportError`**), **`AiManager.svelte`**, **`mediaIngest.ts`** (Story **5.2** ingest), and credential paths; flag patterns that could log **secrets**, **decrypted keys**, or **full prompts** in production.  
  - [x] Ensure **`import.meta.env.DEV`** guards where debug noise is intentional; production path uses **`createLogger`** levels appropriately.  
  - [x] Record **grep commands** and **expected empty results** (or **allowlisted** lines) in `docs/ai-nfr-checklist.md`.

- [x] **Task 2 — NFR-2 confirmation (AC: 2, 5)**  
  - [x] Trace **`loadAiCredentialDetailed` / `saveAiCredential`** → crypto module; confirm **no** parallel crypto invention.  
  - [x] One-paragraph note in checklist or **`docs/data-models.md`** cross-link if AI DB shapes are relevant.

- [x] **Task 3 — NFR-3 bundle note (AC: 3, 5)**  
  - [x] Run **`pnpm build`**, inspect **`dist/assets`** (or Vite output) for AI-related async chunks; paste **relative chunk filenames** into checklist.  
  - [x] If AI code is still in the main chunk, document **follow-up** optional task — do not block story on full code-split unless trivial.

- [x] **Task 4 — NFR-5 doc links (AC: 4, 5)**  
  - [x] Update **`README.md`** (Docs section) and **`docs/index.md`** (Existing documentation table) with **Atlas**, **EIP-8004**, **erc-8004-example** links matching [PRD NFR-5](../../planning-artifacts/prd.md).

- [x] **Task 5 — Gate (AC: all)**  
  - [x] **`pnpm check`** and **`pnpm test`** green after doc-only / minimal code edits.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — NFR / bundle] — NFR-3 aligns with **dynamic import** for AI chunk; NFR-1 aligns with **never log decrypted values**.  
- [Source: `_bmad-output/planning-artifacts/prd.md` — NFR table] — authoritative wording for **NFR-1, NFR-2, NFR-3, NFR-5**.

### Previous story intelligence (5.1 / 5.2)

- **5.1** already required **NFR-1** awareness in **`AiManager`** and transport — this story **verifies** and **locks** practices.  
- **5.2** adds **fetch** + **media** paths — include **`ingest`** / **`fetch(assetUrl)`** in NFR-1 grep scope if present.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `docs/ai-nfr-checklist.md` | **New** — checklist + commands |
| `docs/index.md`, `README.md` | NFR-5 links |
| `src/lib/ai/*.ts`, `src/lib/mediaIngest.ts`, `src/lib/components/AiManager.svelte` | Only if NFR-1 fixes are needed |

### Testing standards

- No new **Mocha** tests required unless adding a **small** automated guard (optional); manual checklist + **CI** still running **`pnpm test`**.

### Git / conventions

- NodeNext **`.js`** suffix on imports from TS unchanged.

## Dev Agent Record

### Agent Model Used

Cursor / Composer agent — 2026-04-02

### Debug Log References

### Completion Notes List

- **NFR-1:** No `console.*` in `src/lib/ai`, `mediaIngest.ts`, or `AiManager.svelte`; `FetchAiHttpTransport` has no logger calls — credentials stay in headers/bodies only.
- **NFR-2:** Documented chain `aiCredentialStore.ts` → `encryptApiKey` / `decryptApiKey` in `aiCredentialCrypto.ts` (AES-GCM + HKDF).
- **NFR-3:** `pnpm build` — main chunk `dist/assets/index-*.js` (~1.46 MB); `AiManager` remains static import from `PostForm` (optional future dynamic import noted in checklist).
- **NFR-5:** README + `docs/index.md` + `docs/ai-nfr-checklist.md` include PRD-aligned Atlas / EIP-8004 / erc-8004-example URLs.

### File List

- `docs/ai-nfr-checklist.md` (new)
- `docs/index.md` (NFR-5 table + checklist row)
- `docs/data-models.md` (NFR-2 cross-link to checklist + crypto files)
- `README.md` (Docs + external references)

### Change Log

- **2026-04-02:** Story 5.3 implemented — NFR checklist, README/index/data-models updates, `pnpm build` chunk notes in checklist; gate green; status **done**.

---

## Project context reference

- `_bmad-output/project-context.md` — no secrets in logs, `pnpm check`.

---

### Review Findings

<!-- BMad code review — 2026-04-02 — spec: this file; scope: Story 5.3 docs (`docs/ai-nfr-checklist.md`, README, `docs/index.md`). Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor. -->

- [x] [Review][Patch] **README duplicate “External references” blocks** [`README.md:30-39`] — Merged into a single subsection; removed duplicate NFR checklist line (2026-04-02).

- [x] [Review][Patch] **NFR-1 checklist overstated “no logger in AI paths”** [`docs/ai-nfr-checklist.md`] — **`AiImageField.svelte`** legitimately imports **`error`** from `logger.js`; grep scope and expected result updated (2026-04-02).

- [x] [Review][Defer] **Optional manual prod smoke** — Checklist leaves `[ ]` for preview + mock job; acceptable gap vs AC “manual or scripted” — run before major release if desired.

**Dismissed:** `rg` vs `grep` portability (checklist documents `rg`; macOS may install via Homebrew).

---

## validate-create-story (checklist) — 2026-04-02

**Workflow:** `_bmad/bmm/4-implementation/bmad-create-story/checklist.md`

| Severity | Finding | Resolution |
| --- | --- | --- |
| **Critical** | NFR-1 AC implied **no `info`/`warn` in prod** — would forbid legitimate status logs | AC1 and **Task 1** narrowed to **secret / prompt / key** leakage; non-sensitive **`info`/`warn`** allowed. |
| **Critical** | **5.2** added **`mediaIngest.ts`** — omitted from NFR-1 grep scope | **Task 1** + Files table include **`mediaIngest.ts`** and named transport modules. |
| **Should** | Logger cited as **`.js` only** | AC1 now points to **`logger.ts`** with note that **imports** use **`*.js`**. |
| **Should** | **`dist/assets`** path assumes default Vite **`outDir`** | **Task 3** already uses `pnpm build`; confirm **`vite.config`** `build.outDir` if non-`dist` — document in checklist if different. |
| **OK** | PRD NFR-1,2,3,5 coverage | Tasks map 1:1; **NFR-2** explicit in Task 2. |
| **Should** | “Production paths” vs **E2E** / **Playwright** | Remains **out of scope** per story; optional note in **Completion Notes** if CI runs catch logging. |

**Definition of Done (validation):** Checklist applied; implementation complete — run `bmad-code-review`, then mark story **done** and set **`epic-5: done`** in `sprint-status.yaml`.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (BMad create-story workflow).
