---
story_key: 6-2-consumer-runs-remote-job-without-provider-api-secret
epic: 6
story: 6.2
frs: FR-12
depends_on:
  - 6-1-advertise-supported-models-to-peers
ux_drs: UX §10 M2 (source toggle / peer list — minimal or deferred; see AC8)
---

# Story 6.2: Consumer runs remote job without provider API secret

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **consumer**,  
I want **to request a generation from a remote provider over libp2p**,  
so that **I do not configure the provider’s Atlas API key locally** (FR-12, NFR-4).

## Acceptance Criteria

1. **Given** the existing **single** Helia + libp2p stack (NFR-4)  
   **When** remote job code runs  
   **Then** it does **not** spawn a second libp2p instance or duplicate gossipsub — it uses the same `libp2p` reference wired in [`LeSpaceBlog.svelte`](../../../src/lib/components/LeSpaceBlog.svelte) / [`config.ts`](../../../src/lib/config.ts).

2. **And** a **versioned stream protocol** is defined and exported next to Story **6.1** constants (e.g. in `src/lib/ai/`): e.g. `LE_SPACE_AI_JOB_PROTOCOL = '/le-space/ai/job/1.0.0'` (string must be stable; bump path segment when envelope breaks). **Consumer** and **provider** both register/handle this protocol on the **same** `AI_REMOTE_PROTOCOL_VERSION` semantic family as [`aiRemoteCapabilities.ts`](../../../src/lib/ai/aiRemoteCapabilities.ts) (document mapping in a short comment: stream job protocol v1 ↔ capability pubsub version 1).

3. **And** **provider side** (`libp2p.handle` or equivalent libp2p **2.x** API): on inbound stream, read a **bounded-size** request frame (JSON UTF-8), validate shape, then execute the job using the **provider’s local** `AiHttpTransport` + **saved credentials** for the requested **manifest id** (`modelId` must match a manifest the provider advertised in **6.1** `models[]`). **Never** write the API key onto the stream or into logs (**NFR-1**, FR-12).

4. **And** **consumer side**: given a **connected** remote peer id that appears in `getRemoteAiCapabilitiesSnapshot()` from [`aiCapabilitiesPubsub.ts`](../../../src/lib/ai/aiCapabilitiesPubsub.ts) with a **matching** `modelId`, open an **outbound** stream on `LE_SPACE_AI_JOB_PROTOCOL`, send the request JSON, read the response until **terminal** (success payload descriptor or error). The consumer **never** receives or persists the provider’s API key (FR-12).

5. **And** **request envelope (v1)** — minimum fields (extend only with version bump):  
   - `protocolVersion` (number, must match agreed constant)  
   - `jobId` (string, unique per attempt — consumer-generated UUID ok)  
   - `modelId` (string, manifest id)  
   - `inputs` — **JSON-serializable** snapshot aligned with what `buildSubmitJobInput` / manifest needs for Atlas (no secrets); **large binaries** are **out of scope for v1 wire** unless passed as **CID strings** already in consumer’s mediaDB — document limitation in Dev Notes if images must stay HTTP-only for first slice.

6. **And** **response envelope (v1)** — provider returns a **single JSON** line or small framed JSON (pick one pattern and document): **either** `{ "ok": true, "status": "...", "assetUrl"?: "...", "error"?: "..." }` mirroring concepts from `AiHttpTransport` result **or** chunked binary later — **MVP** may mirror **poll + result URL** semantics from M1 transport so consumer can reuse ingestion patterns from Story **5.2** where applicable.

7. **And** **errors**: malformed request, unknown `modelId`, missing provider credentials, Atlas failure → provider sends **structured error** on stream; consumer surfaces **i18n-safe** message in UI or test harness (no raw stack traces to peer).

8. **And** **UI scope**: full **AI Manager “Network”** toggle and peer picker may be **follow-up**; for this story, a **minimal** integration surface is acceptable: e.g. **dev-only** controls, **unit/integration tests** with **two mocked libp2p peers**, or a **thin** Svelte callback that dials a **selected peer id** from an existing debug list — **must** be **callable** without pasting API keys. Document chosen surface in Dev Notes.

9. **And** **tests**: `pnpm check` + `pnpm test` green. Prefer **pure** parsers + **mock streams**; if two-node integration is too heavy, document follow-up and keep **strong** unit coverage for envelope validation + **regression** that **no** credential field exists on request type.

10. **Not in scope:** M3 payment, M4 reputation, **full** UCEP repo port, replacing **M1** HTTP path for local API jobs, **automatic** peer selection UX polish.

## Tasks / Subtasks

- [ ] **Task 1 — Protocol constant + types (AC: 2, 5, 6)**  
  - [ ] Add `aiRemoteJobProtocol.ts` (or extend `aiRemoteCapabilities.ts` with a clear section) exporting `LE_SPACE_AI_JOB_PROTOCOL`, `AI_REMOTE_JOB_ENVELOPE_VERSION`, TypeScript types for request/response, `validate` / `encode` / `decode` helpers (never throw on bad input — return `Result`).

- [ ] **Task 2 — Provider stream handler (AC: 1, 3, 6, 7)**  
  - [ ] Register handler once libp2p exists (same lifecycle hook as `startAiCapabilitiesPubsub` — consider `startAiRemoteJobService(libp2p)` returning disposer).  
  - [ ] Parse request, load provider credential via existing Epic **2** store for `modelId`, call **`AiHttpTransport`** (submit/poll/result) **server-side from provider browser** — keys stay local.  
  - [ ] Write JSON response; close stream cleanly on success/error.

- [ ] **Task 3 — Consumer client (AC: 1, 4, 5, 6, 7)**  
  - [ ] Given `PeerId` + validated `modelId` in snapshot, **`dialProtocol`** / **`connection.newStream`** (verify **libp2p 2.9** API in `node_modules` typings) to open stream.  
  - [ ] Write request bytes, read response with **timeout** and **size cap** (DoS guard).  
  - [ ] Return typed result to caller; **no** key material.

- [ ] **Task 4 — Minimal UI or test harness (AC: 8)**  
  - [ ] Wire smallest callable path (document in Dev Notes).

- [ ] **Task 5 — Tests + check (AC: 9)**  
  - [ ] Unit tests for envelopes; optional mock handler test.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — M2 transport] — **libp2p streams**; message envelope versioned; **UCEP** repos are **design references** only.  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — FR-12] — Consumer **never** receives provider API key.  
- [Source: `_bmad-output/planning-artifacts/prd.md` — Milestone 2] — Consumer runs without consumer-side API keys for **remote** models.

### Previous story intelligence (6.1)

- Use **`getRemoteAiCapabilitiesSnapshot()`** and **`AI_REMOTE_PROTOCOL_VERSION`** from [`aiRemoteCapabilities.ts`](../../../src/lib/ai/aiRemoteCapabilities.ts).  
- **Peer id** for dialing must match **pubsub-signed** sender keys from **6.1** — do not trust arbitrary multiaddr without connection.  
- **6.1** already publishes **manifest ids** — `modelId` in job request must be one of those strings for a happy path.

### libp2p 2.x stream API

- Confirm **`libp2p.handle`** / **`libp2p.dialProtocol`** (or `libp2p.components.registrar.handle`) against installed **`libp2p@2.9`** types. Use **`@libp2p/interface`** stream types; **duplex** `Uint8ArrayList` / async iteration — follow patterns from official **js-libp2p** examples if needed (UCEP references in PRD).

### Files to touch (expected)

| Area | Files |
| --- | --- |
| Protocol + types | `src/lib/ai/aiRemoteJobProtocol.ts` (new) |
| Provider + consumer wiring | `src/lib/ai/aiRemoteJobService.ts` (new) or split `…Provider.ts` / `…Consumer.ts` |
| Bootstrap | `LeSpaceBlog.svelte` — start/stop next to `startAiCapabilitiesPubsub` |
| UI (minimal) | Optional `src/lib/components/…` or dev-only |
| Tests | `test/*.ts` |

### Testing standards

- **Mocha** + **ts-node** per `project-context.md`; **no** secrets in fixtures.  
- Mock **duplex** streams where full libp2p is heavy.

### Git / conventions

- NodeNext **`.js`** import suffixes from TS.

## Dev Agent Record

### Agent Model Used

_(filled on implementation)_

### Debug Log References

### Completion Notes List

### File List

### Change Log

---

## Project context reference

- `_bmad-output/project-context.md` — single libp2p stack, `pnpm check`, `$lib` exports.

---

## Story completion status

Ultimate context engine analysis completed — comprehensive developer guide created for Story **6.2** (FR-12). **Prerequisite:** Story **6.1** capability map + pubsub must be present (peer discovery of `modelId`).
