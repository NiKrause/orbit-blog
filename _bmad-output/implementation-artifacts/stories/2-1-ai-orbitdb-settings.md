---
story_key: 2-1-ai-orbitdb-settings
epic: 2
story: 2.1
frs: FR-4
---

# Story 2.1: Create AI OrbitDB and settings registration

Status: done

## Story

As a **blog author**,  
I want **my AI configuration stored in the same blog replica as my other databases**,  
so that **credentials and jobs sync with my OrbitDB identity**.

## Acceptance Criteria

1. **Given** a writable settings DB and OrbitDB bootstrap  
   **When** the app initializes or creates a database set  
   **Then** an AI **documents** database is opened or created following existing `dbUtils` patterns (same access model as `media`: IPFS access controller, writer = identity).

2. **And** its address is persisted in settings with `_id: 'aiDBAddress'` (analogous to `mediaDBAddress`).

3. **And** existing blogs that already have settings/posts/comments/media **without** `aiDBAddress` gain the pointer when the app opens and the user can write settings (upgrade path without deleting unrelated data).

4. **And** `switchToRemoteDB` / remote settings load path reads `aiDBAddress` when present and opens the AI DB (same async pattern as comments/media where applicable).

5. **Not in scope for this story:** encrypting credentials (Epic 2.2), storing credential documents (Epic 2.2–2.3), AI Manager UI. Empty AI DB is acceptable.

6. **Regression:** Database **clone** and **drop** flows must not leave stale `aiDBAddress` or skip dropping the AI DB (see Task 7).

## Tasks / Subtasks

- [x] **Task 1 — Stores (AC: 1–2)**  
  - [x] Add `aiDB` and `aiDBAddress` writable stores in `src/lib/store.ts` (mirror `mediaDB` / `mediaDBAddress`).

- [x] **Task 2 — createDatabaseSet (AC: 1–2)**  
  - [x] In `createDatabaseSet` (`src/lib/dbUtils.ts`), create `{name}-ai` documents DB with directory `./orbitdb/ai`, `AccessController` write `[identity.id]` like media.  
  - [x] `settingsDb.put({ _id: 'aiDBAddress', value: aiDb.address.toString() })`.  
  - [x] Return `aiDb` in the result object for callers that need it.

- [x] **Task 3 — openOrCreateDB bootstrap path (AC: 1–3)**  
  - [x] In the same function where `mediaDBAddress` is loaded (`switchToRemoteDB` flow in `dbUtils.ts`), add `openOrCreateDB` for `aiDBAddress` with config `name: 'ai'`, `directory: './orbitdb/ai'`, `store: aiDB`, `addressStore: aiDBAddress`, non-blocking async like media if that matches current behavior.  
  - [x] Ensure `dbContents` parsing includes reading `aiDBAddress` where other addresses are read (for remote switch).

- [x] **Task 4 — LeSpaceBlog settings sync (AC: 3)**  
  - [x] In `LeSpaceBlog.svelte`, extend settings `switch`/effects that persist `mediaDBAddress` to also persist `aiDBAddress` when `aiDB` exists and user can write settings (copy the pattern used for media).  
  - [x] Optional: handle `case 'aiDBAddress'` in initial settings load loop if other DB addresses are handled there.

- [x] **Task 5 — Documentation (AC: all)**  
  - [x] Update `docs/data-models.md` table with **AI** DB row (`aiDBAddress` in settings, AI DB role). One sentence is enough.

- [x] **Task 6 — Tests / verification**  
  - [x] Add or extend a test so `createDatabaseSet` (or an isolated OrbitDB test) verifies `aiDBAddress` appears in settings after creation **or** document manual QA steps in Dev Agent Record if full stack test is too heavy. Prefer minimal automated check.

- [x] **Task 7 — DBManager.svelte (regression / clone / drop) — CRITICAL**  
  - [x] **`cloneDatabase`:** Add `aiDBAddress` to the same **skip list** as `postsDBAddress` / `commentsDBAddress` / `mediaDBAddress` when copying generic settings (otherwise a stale AI address from the source blog would be copied). Open source AI DB if `sourceSettingsDb` has `aiDBAddress`; create **`newAiDb`** (same naming/access pattern as `newMediaDb`); copy documents from source AI DB if present; `await newSettingsDb.put({ _id: 'aiDBAddress', value: newAiDb.address })` after other address puts.  
  - [x] **`handleDatabaseDrop`:** Read `aiDBAddress` from settings in the `switch` over `_id` (alongside posts/comments/media); include that address in the **drop** list when `dropLocal` is true so orphaned AI DBs are not left on disk.  
  - [x] **Optional (if time):** `processQueue` / remote preview counts — follow media pattern for AI only if product needs AI counts in DB manager; otherwise document “deferred” in Completion Notes.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md`] — AI DB address in settings; follow `postsDBAddress` / `mediaDBAddress` conventions.
- [Source: `docs/data-models.md`] — settings keys pattern.
- **Do not** use `aiApiKey` / `aiApiUrl` for this DB (translation-only).

### Files to touch (expected)

| File | Change |
| --- | --- |
| `src/lib/store.ts` | `aiDB`, `aiDBAddress` |
| `src/lib/dbUtils.ts` | `createDatabaseSet`, `switchToRemoteDB` / `openOrCreateDB` block |
| `src/lib/components/LeSpaceBlog.svelte` | persist + load `aiDBAddress` |
| `src/lib/components/DBManager.svelte` | **cloneDatabase** + **handleDatabaseDrop** (Task 7) |
| `docs/data-models.md` | AI DB row |
| Tests (optional) | `test/` or extend existing |

### Previous story intelligence (1-2)

- `src/lib/ai/` holds transport types; this story adds **persistence layer** only. No change to `AiHttpTransport` required.
- `pnpm test` runs orbitdb tests then TS tests; keep green.

### Testing standards

- Run `pnpm test` after changes.  
- Run `pnpm check` — note pre-existing errors in `PostList.svelte` / `LeSpaceBlog.svelte` may remain until fixed elsewhere; new edits should not add errors in touched files.

### Git / conventions

- NodeNext imports: `.js` suffix in TS imports.  
- Match existing logging via `log` from logger, not raw `console` for sensitive paths.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- `pnpm test` (orbitdb + `aiHttpTransport`) and `pnpm check` both pass after implementation.
- **`processQueue` / AI counts:** deferred; not required for M1 per validation checklist (optional Task 7 item).
- **`RemoteDB.aiAddress`:** optional field set when creating a local DB set via `addRemoteDBToStore`; remote-queue entries may omit until loaded.

### File List

- `src/lib/store.ts`
- `src/lib/types.ts`
- `src/lib/dbUtils.ts`
- `src/lib/components/LeSpaceBlog.svelte`
- `src/lib/components/DBManager.svelte`
- `docs/data-models.md`
- `test/orbitdb-network.test.js`
- `_bmad-output/implementation-artifacts/stories/2-1-ai-orbitdb-settings.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- 2026-04-02: Story 2.1 implemented — AI OrbitDB, `aiDBAddress` in settings, clone/drop parity, orbitdb test extension.
- 2026-04-02: Code review — docs scope heading for Epic 2.2+ credential prose; `copying_ai` i18n + DBManager modal.

### Review Findings

- [x] [Review][Patch] **`docs/data-models.md` vs AC5 —** Long credential/encryption paragraph sat under 2.1 doc work without marking it as Epic 2.2–2.3. **Fixed:** Added `### AI credential documents (Epic 2.2–2.3 — not part of 2.1)` and intro sentence.

- [x] [Review][Patch] **Clone modal i18n —** `DBManager.svelte` used hardcoded English for AI DB copy step. **Fixed:** `modalMessage = $_('copying_ai')` and `copying_ai` added across `src/lib/i18n/*.js`.

- [x] [Review][Defer] **DB naming —** `createDatabaseSet` uses `${name}-ai`; `LeSpaceBlog` / `openOrCreateDB` use short name `ai` with `./orbitdb/ai` — mirrors existing posts vs `blog-posts` split; not introduced by 2.1 alone.

- [x] [Review][Defer] **`log.info('aiDBAddressValue', …)` in `dbUtils`** — Address is not a secret; optional downgrade to `debug` later.

- [x] [Review][Defer] **`console.error` on `aiDBAddress` persist failures in `LeSpaceBlog`** — Matches adjacent media pattern; migrate to `log` when touching that block holistically.

---

## Project context reference

- `_bmad-output/project-context.md` — OrbitDB, stores, tests.

---

## validate-create-story (checklist) — 2026-04-02

**Workflow:** `_bmad/bmm/4-implementation/bmad-create-story/checklist.md` (no separate `validate-create-story` binary in repo).

| Severity | Finding | Resolution |
| --- | --- | --- |
| **Critical** | `DBManager.svelte` **cloneDatabase** copies settings but only skips three DB address keys; adding `aiDBAddress` without updating the clone flow would **copy a stale pointer** to the old AI DB. | **Task 7** added: skip `aiDBAddress`, create new AI DB, copy rows, write new address. |
| **Critical** | **handleDatabaseDrop** only drops posts/comments/media sub-DBs; AI DB would be **orphaned**. | **Task 7** added: parse and drop AI DB address. |
| **Should** | `processQueue` opens media for remote DB stats; AI parity optional for M1. | Noted optional in Task 7. |
| **OK** | `createDatabaseSet` invoked from `dbUtils` init path (~line 87); covered by Task 2. | — |
| **OK** | Previous story `1-2` — transport only; no conflict. | — |

**Definition of Done (validation):** Story updated with Task 7; ready for `bmad-dev-story` unless you want another pass after implementation.
