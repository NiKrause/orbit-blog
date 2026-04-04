---
story_key: 6-1-advertise-supported-models-to-peers
epic: 6
story: 6.1
frs: FR-11
ux_drs: UX placeholder for M2 remote (peer list + model badges — full UI can follow in 6.x)
---

# Story 6.1: Advertise supported models to peers

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **provider**,  
I want **peers to see which AI models I host**,  
so that **consumers can choose me in the network layer** (FR-11).

## Acceptance Criteria

1. **Given** the app’s existing **single libp2p + Helia** stack (NFR-4)  
   **When** the node is running and pubsub is available  
   **Then** the implementation **does not** create a second gossipsub instance or duplicate `libp2p` — it uses **`libp2p.services.pubsub`** from the existing Helia/libp2p wiring in [`src/lib/config.ts`](../../../src/lib/config.ts) / [`LeSpaceBlog.svelte`](../../../src/lib/components/LeSpaceBlog.svelte).

2. **And** a **versioned capability payload** is defined and documented in code (e.g. `AI_REMOTE_PROTOCOL_VERSION = 1`) such that **future** peers can negotiate compatibility. Payload **must** include:
   - **`protocolVersion`** (number, matches the constant), and  
   - **`models`** — **non-empty** `string[]` of **manifest ids** (same ids as `AiModelManifest.id` from [`src/lib/ai/modelRegistry.ts`](../../../src/lib/ai/modelRegistry.ts); for v1, advertising the built-in Kling manifests is sufficient).

3. **And** **discovery** uses the **architecture-approved** direction: **pubsub topic** (alternative *identify push* is out of scope for this story unless explicitly needed — prefer one mechanism). A **single stable topic name** is chosen and exported as a constant (e.g. `LE_SPACE_AI_CAPABILITIES_TOPIC`), documented next to the payload type.

4. **And** the local peer **publishes** the capability message on a **reasonable cadence** (e.g. on an interval and/or on **`peer:connect`**) so that **newly connected peers** can observe capabilities without bespoke UI yet.

5. **And** the local peer **subscribes** to the same topic and **parses** incoming messages from other peers: validate JSON shape, ignore malformed messages **without throwing** in the hot path; optionally merge into an in-memory structure keyed by **peer id string** for later UI (minimal surface OK — **full UX** “Network (peer)” toggle and badges is UX §M2 and may land in a follow-up story).

6. **And** **no secrets** in the payload: **no** API keys, **no** decrypted credentials, **no** full prompts (NFR-1).

7. **And** **tests**: unit tests for **pure** helpers — payload **encode/decode**, validation, topic constant; use **mocks** for pubsub if a full libp2p harness is heavy; **`pnpm check`** + **`pnpm test`** green.

8. **Not in scope:** **Story 6.2** — consumer job execution over streams; **payment** (M3); **ERC-8004** (M4); full **AI Manager** UI for peer selection (may wire a debug readout or dev-only log line only).

## Tasks / Subtasks

- [x] **Task 1 — Types + protocol constants (AC: 2, 3, 6)**  
  - [x] Add a small module under `src/lib/ai/` (e.g. `aiRemoteCapabilities.ts` or `network/aiCapabilities.ts`) exporting `AI_REMOTE_PROTOCOL_VERSION`, topic string, and TypeScript types for the capability message.  
  - [x] Document payload JSON shape in a file-level comment; reference [architecture.md — Discovery & M2 transport](../../planning-artifacts/architecture.md).

- [x] **Task 2 — Pubsub publish/subscribe wiring (AC: 1, 4, 5)**  
  - [x] From a **single** initialization path (likely `LeSpaceBlog.svelte` after `$libp2p` exists, or a helper imported from e.g. `src/lib/ai/aiCapabilitiesPubsub.ts`), obtain **`libp2p.services.pubsub`** (project typings use `any` for pubsub today — see `src/lib/types.ts` / `src/types/libp2p.d.ts`). **Subscribe** to `LE_SPACE_AI_CAPABILITIES_TOPIC` **before** publishing.  
  - [x] **Wire format:** gossipsub carries **`Uint8Array`** — use **`new TextEncoder().encode(JSON.stringify(payload))`** for publish; on message, **`new TextDecoder().decode(data)`** then **`JSON.parse`** inside **try/catch** (invalid UTF-8 / JSON → ignore per AC5).  
  - [x] **Sender key:** use the gossipsub message’s **sender peer id** (libp2p gossipsub `Message` / event detail — use the API exposed by `@chainsafe/libp2p-gossipsub` for **from** / **propagationSource**) to key the in-memory map of remote capabilities — **do not** trust a `peerId` field inside JSON unless validated.  
  - [x] Publish local capabilities using `listKlingI2vManifests().map((m) => m.id)`; if the array is empty (future registry), **skip publish** or document no-op — AC2 requires **non-empty** `models` when advertising.  
  - [x] Ensure cleanup on teardown (unsubscribe / clear interval) to avoid duplicate listeners on hot reload.

- [x] **Task 3 — Tests + check (AC: 7)**  
  - [x] Unit tests for parse/validate and version mismatch handling.  
  - [x] `pnpm check` and `pnpm test` green.

### Review Findings

- [ ] [Review][Decision] Unsplit vs split PR — The same working tree combines Story 6.1 code (`aiCapabilitiesPubsub`, `LeSpaceBlog`, tests) with large PRD v1.1 / epics / UX edits, Story 4.2 markdown updates, sprint-status moves across epics, and lockfile churn. Decide whether to ship as one changeset or split commits/PRs for traceability and revert safety.

- [ ] [Review][Decision] Sprint status: Story 4.2 `review` + Epic 4 `in-progress` — `sprint-status.yaml` marks `4-2-image-input-library-upload` as `review` and sets `6-2-consumer-runs-remote-job-without-provider-api-secret` to `ready-for-dev` alongside 6.1. Confirm this reflects intentional Scrum state, not accidental coupling to the 6.1 branch.

- [ ] [Review][Patch] Use fatal UTF-8 decode for capability bytes [`src/lib/ai/aiRemoteCapabilities.ts`] — Default `TextDecoder` replaces malformed sequences instead of throwing; `{ fatal: true }` (with catch → `{ ok: false }`) aligns more tightly with AC5’s invalid UTF-8 handling.

- [ ] [Review][Patch] Clear `remoteCapabilitiesByPeerId` in the pubsub disposer [`src/lib/ai/aiCapabilitiesPubsub.ts`] — The module-level map outlives teardown; clearing on dispose avoids stale advertisements after libp2p re-init or HMR.

- [ ] [Review][Patch] Track `test/aiRemoteCapabilities.test.ts` in version control — `package.json` already includes it in the Mocha list; an untracked file breaks `pnpm test` for clones/CI until committed.

- [x] [Review][Defer] Cap incoming gossipsub payload size before `JSON.parse` [`src/lib/ai/aiCapabilitiesPubsub.ts`] — deferred, pre-existing hardening; max-bytes policy not specified in Story 6.1.

- [x] [Review][Defer] Silent `publish` failure path [`src/lib/ai/aiCapabilitiesPubsub.ts` `publishLocal`] — deferred, pre-existing tradeoff (no noisy logs / no payload leakage); revisit with debug metrics if mesh timing issues need diagnosis.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — M2 / Discovery] — **Pubsub topic or identify push** listing `aiCapabilities`-style payload; **must not duplicate gossipsub setup** — reuse `gossipsub` service from existing `libp2pOptions`.  
- [Source: `_bmad-output/planning-artifacts/architecture.md` — M2 transport] — Streams / UCEP alignment is **6.2+**; this story is **advertisement only**.  
- [Source: `_bmad-output/planning-artifacts/prd.md` — Milestone 2] — Discovery of peers that **advertise** AI capabilities; UCEP repos are **design references**, not mandatory code imports.

### Previous story intelligence (5.1)

- **M1 path** uses **`AiHttpTransport`**, **`buildSubmitJobInput`**, **`AiManager`** — unchanged for 6.1.  
- **Manifest ids** are the stable contract for **`models[]`** so remote peers can map to the same **`getManifestById`** / provider `model` string in later stories.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `src/lib/ai/*.ts` (new) | Capability types, topic, encode/decode/validate |
| `src/lib/components/LeSpaceBlog.svelte` (or small helper imported there) | Pubsub subscribe + publish lifecycle |
| `src/lib/index.ts` | Export types/constants if part of package API (optional) |
| `test/*.ts` | Unit tests for payload helpers |

### Testing standards

- Prefer **pure** functions tested without browser; mock pubsub interface where needed.  
- Do not log full payloads in **production** at `info` level if they could grow; **debug** only.

### Git / conventions

- NodeNext **`.js`** suffix on imports from TS.

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Debug Log References

### Completion Notes List

- Wired `startAiCapabilitiesPubsub` from `initializeApp` after `setupPeerEventListeners`, with dispose on re-init and `onDestroy`.
- Added `decodeAiCapabilitiesPayload` for encode/decode tests and reused it in the pubsub handler; fixed `Message` import path (`@libp2p/interface-pubsub`) and logger category for `pnpm check`.

### File List

- `src/lib/ai/aiRemoteCapabilities.ts`
- `src/lib/ai/aiCapabilitiesPubsub.ts`
- `src/lib/components/LeSpaceBlog.svelte`
- `test/aiRemoteCapabilities.test.ts`
- `package.json`

### Change Log

- 2026-04-04 — Story 6.1: AI capability pubsub advertisement, decode helper, unit tests, LeSpaceBlog lifecycle wiring; sprint status → review.

---

## Project context reference

- `_bmad-output/project-context.md` — single libp2p stack, `pnpm check`, `$lib` exports.

---

## validate-create-story (checklist) — 2026-04-02

**Workflow:** `_bmad/bmm/4-implementation/bmad-create-story/checklist.md`

| Severity | Finding | Resolution |
| --- | --- | --- |
| **Critical** | Gossipsub **publish** expects **binary** payloads; JSON-only ACs do not state **encode/decode** | Task 2 now requires **TextEncoder/TextDecoder** + safe **JSON.parse** in the handler. |
| **Critical** | Remote capabilities map must be keyed by **actual peer id** from the pubsub layer | Task 2: key by gossipsub **message sender**, not an unverified JSON field. |
| **Should** | **Subscribe before publish** and avoid bloating `LeSpaceBlog.svelte` | Task 2: optional helper module; subscribe ordering explicit. |
| **Should** | Empty **`models[]`** vs AC2 “non-empty” if registry is empty | Task 2: skip publish or document when **no** models to advertise. |
| **OK** | NFR-4 single libp2p / reuse `services.pubsub` | AC1 + architecture alignment. |
| **OK** | FR-11 traceability | Payload includes **protocolVersion** + **models** (manifest ids). |
| **Should** | Epic AC “M2 protocol design approved” | Story scopes to **pubsub advertisement**; **UCEP streams** remain **6.2**. |

**Definition of Done (validation):** Checklist applied; story strengthened for dev agent; ready for `bmad-dev-story`.

---

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (BMad create-story workflow).
