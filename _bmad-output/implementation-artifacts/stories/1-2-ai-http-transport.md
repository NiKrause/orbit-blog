---
story_key: 1-2-ai-http-transport
epic: 1
story: 1.2
---

# Story 1.2: AiHttpTransport abstraction and tests

## Story

As a **developer**,  
I want **an `AiHttpTransport` interface with a mock implementation**,  
So that **UI and job logic can be tested without live Atlas calls**.

## Acceptance Criteria

1. **Given** the architecture decision for submit/poll/result  
   **When** a consumer calls the transport with a minimal job payload  
   **Then** the interface supports **submit**, **poll status**, and **fetch result** for M1.

2. Unit tests run against the **mock** without network.

3. **NFR-1:** Production-oriented code paths do not **console.log** API keys or raw secrets (mock and interface avoid logging credentials).

## Dev Notes

- Brownfield: TypeScript, NodeNext imports with `.js` suffix in source.
- Align naming with `_bmad-output/planning-artifacts/architecture.md` (`AiHttpTransport`).
- Atlas-specific URL shapes come in a later story; this story only defines the **contract** + **MockAiHttpTransport**.
- Export from `src/lib/ai/index.ts` and barrel-export from `src/lib/index.ts` for package consumers.

## Tasks / Subtasks

- [x] Add `src/lib/ai/types.ts` — job payload/result types and `AiHttpTransport` interface
- [x] Add `src/lib/ai/mockAiHttpTransport.ts` — in-memory mock with deterministic lifecycle
- [x] Add `src/lib/ai/index.ts` — public exports
- [x] Export from `src/lib/index.ts`
- [x] Add `test/aiHttpTransport.test.ts` — Mocha tests, no network
- [x] Run `pnpm test` and `pnpm check`

## Dev Agent Record

### Implementation Plan

- Define a minimal vendor-neutral contract: submit returns `jobId`; poll returns `queued` | `running` | `succeeded` | `failed`; fetch returns a placeholder result URL for tests.
- Mock holds state in memory per `jobId`; never logs `apiKey` or full secrets.

### Debug Log

_(none)_

### Completion Notes

- Implemented `AiHttpTransport`, `MockAiHttpTransport`, and unit tests. Mock advances poll counts per job without network calls.
- `pnpm test` runs `orbitdb*.test.js` then `aiHttpTransport.test.ts` (ESM + `ts-node/esm`). `pnpm check` still reports **2 pre-existing** errors in `PostList.svelte` and `LeSpaceBlog.svelte` (unrelated to this story).

## File List

- `src/lib/ai/types.ts`
- `src/lib/ai/mockAiHttpTransport.ts`
- `src/lib/ai/index.ts`
- `src/lib/index.ts` (export)
- `test/aiHttpTransport.test.ts`
- `tsconfig.test.json`
- `.mocharc.cjs` (removed default `spec` glob so CLI controls suites)
- `package.json` (`test` script: orbitdb suite + AI TS suite with `ts-node/esm`)
- `_bmad-output/implementation-artifacts/stories/1-2-ai-http-transport.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-04-02:** Story 1.2 — AI HTTP transport abstraction + mock + tests.
- **2026-04-02:** Code review — mock `fetchResult` guard + regression test; sprint → done.

## Status

done

### Review Findings

- [x] [Review][Patch] **`MockAiHttpTransport.fetchResult` before success —** [`src/lib/ai/mockAiHttpTransport.ts`](../../../src/lib/ai/mockAiHttpTransport.ts) allowed `fetchResult` after submit or while `queued`/`running`, which mis-models M1 submit → poll → fetch. **Fixed:** track `completedSuccessfully` on first `succeeded` poll; throw if `fetchResult` runs earlier. **Test:** [`test/aiHttpTransport.test.ts`](../../../test/aiHttpTransport.test.ts) `fetchResult throws if job has not reached succeeded`.

- [x] [Review][Defer] **`src/lib/ai/index.ts` re-exports credential/crypto (Epic 2)** — Story 1.2 text says contract + mock only; barrel also exposes `aiCredential*` for the same branch. Tests import crypto modules directly; acceptable until barrels are split per epic.

- [x] [Review][Defer] **`package.json` `test` runs `aiCredentialCrypto.test.ts`** — Harness bundles multiple suites; not exclusive to story 1.2.

- [x] [Review][Defer] **`pollStatus` vs `fetchResult` on unknown `jobId`** — Poll returns `{ status: 'failed' }`; fetch throws. Documented tradeoff for strict vs soft errors in a future real transport; mock kept as-is.
