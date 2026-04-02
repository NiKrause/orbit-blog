---
story_key: 2-3-credential-multi-model
epic: 2
story: 2.3
frs: FR-2, FR-4
---

# Story 2.3: Credential document shape for multiple models

Status: done

## Story

As a **blog author**,  
I want **more than one model each with its own URL and key**,  
so that **I can use different vendors or tiers without overwriting settings**.

## Acceptance Criteria

1. **Given** the AI DB  
   **When** I save credentials for model A and then for model B  
   **Then** both documents coexist with distinct stable ids  
   **And** updating model A does not change model B’s record.

## Tasks / Subtasks

- [x] **Task 1 — List API**  
  - [x] Add `listAiCredentialModelIds(aiDb)` using `all()` + v1 credential unwrap (ignores non-credential rows).

- [x] **Task 2 — Delete API (supporting)**  
  - [x] Add `deleteAiCredential(aiDb, modelId)` for future UI / cleanup.

- [x] **Task 3 — Tests**  
  - [x] Automated tests: two models saved → distinct docs; update A → B unchanged; delete one → other remains.

- [x] **Task 4 — Docs**  
  - [x] Extend `docs/data-models.md` AI credential paragraph with multi-model + API names.

## Dev Notes

- Per-model `_id` remains `credential:{encodeURIComponent(modelId)}` from Story 2.2; no migration.
- UI (Epic 3) can call `listAiCredentialModelIds` for dropdowns.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Sprint had no `ready-for-dev` entry; story implemented from `epics.md` Story 2.3.
- `pnpm test` (14 tests) and `pnpm check` pass.

### File List

- `src/lib/ai/aiCredentialStore.ts`
- `src/lib/ai/index.ts`
- `test/aiCredentialCrypto.test.ts`
- `docs/data-models.md`
- `_bmad-output/implementation-artifacts/stories/2-3-credential-multi-model.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-02: `listAiCredentialModelIds`, `deleteAiCredential`, multi-model tests, data-models update.
- 2026-04-02: Code review — `data-models.md` wording aligned with shipped implementation; story **done**.

### Review Findings

- [x] [Review][Patch] **`docs/data-models.md`** — Section still said credentials were a “target shape once those epics land” while **2.2 / 2.3 are implemented**. Updated to present-tense and pointed at the real modules.

- [x] [Review][Defer] **`aiDb.all()` row shape** vs `unwrapCredentialEntry` — Still only covered by mocks; confirm against a live OrbitDB documents DB when Epic 3 wires the UI (same as Story 2.2 review).

- [x] [Review][Dismiss] **Tests** — `describe('aiCredentialStore multi-model')` matches AC1 (two models, update A, delete one); no further gaps for this story.

---

## Project context reference

- `_bmad-output/project-context.md`
