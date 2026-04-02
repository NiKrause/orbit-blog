---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - ./prd.md
  - ../project-context.md
  - ../../docs/index.md
  - ../../docs/data-models.md
  - ../../docs/AI_AGENTS.md
workflowType: architecture
project_name: bolt-orbitdb-blog
user_name: Nandi
date: '2026-04-02'
lastStep: 8
status: complete
completedAt: '2026-04-02'
workflowNote: >-
  Consolidated architecture pass for AI Manager (PRD-aligned). Brownfield: extends existing
  Vite + Svelte 5 + Helia + OrbitDB stack; no new project scaffold.
---

# Architecture Decision Document — AI Manager & Distributed AI

_This document records solution design for the PRD in `planning-artifacts/prd.md`. It extends the existing **Le Space Blog** codebase; it does not replace the stack._

---

## Project Context Analysis

### Requirements Overview

**Functional requirements (from PRD):** AI Manager UI on create/edit post; configurable HTTP provider (base URL + API key) with **encrypted** storage; new **OrbitDB** for AI config/jobs registered via **settings**; **schema-driven** forms for models (Kling Pro/Std I2V first); **media** upload and **existing media** selection for inputs; **output video** as new **Media**; **CORS** decision before production HTTP; **M2–M4** remote UCEP-style execution, payments, ERC-8004 reputation.

**Non-functional:** No secrets in logs; reuse existing crypto/identity utilities; lazy-load heavy AI code; single libp2p stack; document external APIs (Atlas Cloud, EIP-8004).

**Scale and complexity:** **High** for the full four-milestone roadmap; **M1 alone** is **medium** (UI + OrbitDB + HTTP job runner + media integration + spike).

- **Primary domain:** Browser SPA (TypeScript), P2P (libp2p + OrbitDB), optional EVM (M3–M4).
- **Cross-cutting:** Identity and encryption, media CIDs, pubsub/streams for M2+.

### Technical Constraints and Dependencies

- **No backend** in-repo today; any **relay** for CORS or API key must be a **deliberate add-on** (tiny worker, separate service, or documented third-party proxy)—not assumed.
- **Existing state (separate feature):** `aiApiKey` / `aiApiUrl` in **`localStorage`** via `src/lib/store.ts` and Settings power **content translation** only (`translationService.ts`—LLM calls for translating posts/languages). **These must not be reused or migrated into AI Manager.** AI Manager credentials live only in the **AI OrbitDB** and support **many models**, each with its **own** base URL and API key (encrypted per document).
- **OrbitDB patterns:** `createDatabaseSet` / `openOrCreateDB` in `dbUtils.ts`; settings keys like `postsDBAddress`, `mediaDBAddress`—new pointer **`aiDBAddress`** (name TBD in implementation) follows the same pattern.

### Cross-Cutting Concerns

| Concern | Handling |
| --- | --- |
| Identity | Existing OrbitDB identity; encrypt AI secrets with key derived from identity private material (same abstraction as other app crypto—**no new hand-rolled crypto**). |
| Media | Reuse `Media` type and mediaDB put flow; AI output = new video blob + `Media` doc. |
| Network | M2+ registers **protocol** on existing libp2p instance; UCEP alignment is **protocol design**, not a second peer stack. |
| i18n | New strings via **svelte-i18n** per `project-context.md`. |

---

## Starter Template Evaluation

### Primary Technology Domain

**Brownfield SPA:** the product is already bootstrapped on **Vite 5 + Svelte 5 + Helia + libp2p + @orbitdb/core** (see `_bmad-output/project-context.md`).

### Selected Approach: Extend Existing Repository

**Rationale:** The PRD targets features **inside** Le Space Blog, not a greenfield app. No new `create-vite` or framework migration.

**Architectural decisions already provided by the repo:**

| Area | Current choice |
| --- | --- |
| Language / module | TypeScript, **NodeNext** imports with `.js` suffix |
| UI | Svelte 5 (`mount` API), Tailwind |
| P2P / data | Helia, OrbitDB document DBs, IPFS access controller |
| Tests | Mocha + Playwright (serial E2E) |
| Build | Vite, manual chunks for heavy deps |

**Note for implementers:** First implementation stories should **open** the new AI DB and wire UI; **do not** re-init the repo.

---

## Core Architectural Decisions

### Decision Priority

| Priority | Items |
| --- | --- |
| **Critical (M1)** | New OrbitDB for AI metadata + jobs; encrypted credential blob; HTTP client abstraction with **CORS spike** outcome; plugin/manifest model for UI; media input/output pipeline. |
| **Important (M2)** | UCEP-like **protocol ID**, capability advertisement (pubsub or identify protocol), stream request/response schema. |
| **Important (M3)** | Payment verification strategy (see below). |
| **Deferred (M4)** | ERC-8004 contract addresses per chain; feedback UX. |

### Data Architecture

| Decision | Choice | Rationale |
| --- | --- | --- |
| **AI persistent store** | New **OrbitDB document database** (e.g. `{blog}-ai` or similar), address stored in **settings** as `aiDBAddress` (exact `_id` to match `postsDBAddress` style). | Single-writer blog model; replicates with other DBs; avoids bloating settings with large job history. |
| **Documents (conceptual)** | (1) **Per-model (or per-provider) credentials** — stable id, display name, **base URL**, **encrypted API key**, optional metadata (e.g. vendor). Multiple rows: one per registered model that needs its own endpoint/key. (2) **Model manifest refs** — built-in JSON + future user overrides. (3) **Jobs** — id, model id, status, timestamps, error, refs to input/output **media IDs** / CIDs. | Supports many APIs (Kling, future Text2Image, etc.) without sharing one global key. |
| **Schema evolution** | Application-level versioning field on documents (`schemaVersion`). | Matches existing migration note in `docs/data-models.md`. |
| **Separation from Settings AI keys** | **`aiApiKey` / `aiApiUrl` unchanged** for the **translation** feature only; **no** reading or writing those stores from AI Manager code paths. | Translation LLM vs generative media APIs are separate products in one app. |

### Authentication and Security

| Decision | Choice | Rationale |
| --- | --- | --- |
| **API key at rest** | **Encrypt** with secret derived from **identity private key** (existing crypto helpers); store ciphertext + nonce in AI DB. | FR-3; NFR-2. |
| **In memory** | Decrypt only in RAM for the duration of a request; **never** log decrypted values (NFR-1). |
| **WebAuthn + PRF** | **Document only** in ADR/README: future key-wrapping replaces symmetric derivation; **not implemented** in M1. | PRD open question. |
| **Remote M2** | Consumer **never** receives provider API key; provider holds keys server-side (local to peer). | FR-12. |

### API and Communication Patterns

| Decision | Choice | Rationale |
| --- | --- | --- |
| **M1 transport** | **HTTPS** to Atlas-compatible base URL; abstract behind **`AiHttpTransport`** (or equivalent) implementing a small interface: `submitJob`, `pollStatus`, `fetchResult`. | Swap mock in tests; add relay later without changing UI. |
| **CORS spike** | **Mandatory pre-implementation:** follow [`docs/ai-api-browser-cors-spike-checklist.md`](../../docs/ai-api-browser-cors-spike-checklist.md) from a **real browser** (app served over HTTP/S, not Node `fetch` alone). **Outcome (2026-04-02):** [`docs/ai-api-cors-spike-outcome-2026-04-02.md`](../../docs/ai-api-cors-spike-outcome-2026-04-02.md) — Atlas Cloud allows localhost dev/preview origins for probed paths; re-validate for deployed HTTPS origin. If blocked: **same-origin relay** (minimal Cloudflare Worker, Vite dev proxy for dev only, or self-hosted edge)—**not** committed as mandatory until spike completes. | FR-10. |
| **Atlas queue semantics** | Follow vendor **Submit → Status → Result**; map to internal **job state machine** (`queued` → `running` → `succeeded` \| `failed`). Exact paths from [Atlas Cloud Kling API](https://www.atlascloud.ai/models/kwaivgi/kling-v3.0-pro/image-to-video?tab=api) docs at implementation time. | PRD open question #2. |
| **M2 transport** | **libp2p streams** (multiplexed over existing connection); message envelope: version, model id, job id, payload hashes (not necessarily full binary on wire—**stream** large assets). Align with **UCEP** patterns from referenced repos (`universal-connectivity/js-peer`, `js-libp2p-example-yjs-libp2p`) as **protocol design references**. | FR-11, FR-12; NFR-4. |
| **Discovery** | **Pubsub topic** or **identify push** listing `aiCapabilities: { protocolVersion, models: [...] }`**—exact mechanism chosen in M2 design; must not duplicate gossipsub setup. | PRD Milestone 2. |

### Frontend Architecture

| Decision | Choice | Rationale |
| --- | --- | --- |
| **UI placement** | `PostForm.svelte` (and `PostList` if edit-in-list): new **AI Manager** card toggled like **MediaManager**; shared layout primitives. | FR-1. |
| **Dynamic forms** | **JSON Schema** (or subset) → **field renderer** component; Kling manifests ship as static JSON under e.g. `src/lib/ai/manifests/`. | FR-5, FR-6. |
| **State** | Svelte stores for **ephemeral** UI; **persistent** config/jobs in OrbitDB; avoid duplicating large job payloads in stores. | Matches existing `store.ts` patterns. |
| **Bundle** | Dynamic `import()` for AI manager chunk if dependency weight grows (NFR-3). | |

### Infrastructure and Deployment

| Decision | Choice | Rationale |
| --- | --- | --- |
| **Hosting** | Unchanged: static PWA / IPFS deploy. | |
| **Optional relay** | If CORS requires it, relay is a **separate deployable** or **dev-only proxy**; env vars `VITE_*` for URL. | Browser-only rule in `project-context.md`. |

### Milestone 3 — Payment (Architecture Options)

| Option | Mechanism | Pros | Cons |
| --- | --- | --- | --- |
| **A — Direct USDT transfer + off-chain verification** | Consumer sends USDT to provider address; provider watches **wallet balance / Transfer events** or **signed message** tying `jobId` to `txHash`; protocol fee via **second transfer** or **off-chain** agreement. | Minimal contract; fast to prototype. | Disputes (“paid but no delivery”) need **off-chain** policy; fee split is **manual** unless encoded. |
| **B — Escrow / splitter contract** | Consumer deposits USDT for `jobId`; **release** to provider + fee on completion; **only** financial metadata on chain. | Clear settlement; **fee** enforceable. | Gas + deployment; **oracle** for “job done” or **timeout** pattern. |
| **C — Hybrid** | Small **deposit** on chain for **commitment** + **hash(jobId)**; rest off-chain settlement. | Balance of trust and cost. | More moving parts. |

**Recommendation for implementation planning:** Start with **Option A on testnet** for UX wiring; **revisit B** if fee-on-chain and dispute resolution become product requirements. **Never** put full prompts on chain (PRD).

### Milestone 4 — ERC-8004

| Decision | Choice |
| --- | --- |
| **Contracts** | Reuse **Identity / Reputation / Validation** registry pattern from [erc-8004-example](https://github.com/vistara-apps/erc-8004-example); **addresses per chain** in config (not hardcoded in PRD). |
| **Gas payer** | **TBD** product decision: provider pays registration, consumer pays feedback, or app suggests batching on L2—document in UX copy. |

### Decision Impact — Implementation Sequence

1. CORS spike + HTTP transport interface + job state machine.  
2. AI OrbitDB + settings pointer + encryption for **per-model** secrets (no overlap with `aiApiKey` / `aiApiUrl`).  
3. Manifests + form renderer + Media integration + output to mediaDB.  
4. M2: protocol + discovery + stream handler.  
5. M3: wallet + payment verification.  
6. M4: registry integration + feedback.

---

## Implementation Patterns and Consistency Rules

### Naming and Files

| Area | Pattern |
| --- | --- |
| **New modules** | `src/lib/ai/` or `src/lib/services/ai/` — **one** chosen root; avoid scattering `ai*.ts` at top level. |
| **Components** | `AiManager.svelte` (PascalCase), colocated helpers only if small. |
| **Imports** | **NodeNext**: `from '../foo.js'` in `.ts`/`.svelte`. |
| **OrbitDB doc `_id`** | Stable strings: `providerConfig`, `job:{uuid}`, etc.; prefix job docs for queries if needed. |

### Error and Loading States

- **HTTP / stream errors:** User-visible message + **non-sensitive** detail; log technical detail only in dev (`DEBUG` guarded).  
- **Job UI:** Single **status** enum mapped to i18n strings; spinner + cancel where supported.

### Testing

- **Unit:** Crypto round-trip, job state reducer, manifest validation.  
- **Integration:** Mock `AiHttpTransport`; OrbitDB tests follow `test/orbitdb*.test.js` patterns.  
- **E2E:** Optional after M1 stable; keep **workers: 1** rule.

### Plugin (“Skill”) Interface (Conceptual)

```text
AiModelPlugin {
  id: string
  displayName: string
  transport: 'http' | 'libp2p'   // extensible
  manifest: JsonSchema         // or internal schema object
  buildRequest(job: JobInput): unknown
  parseResult(response: unknown): { mediaBytes: Blob, mime: string }
}
```

New models add **manifest + plugin module** registration in a **single registry** file—avoid N× duplicate Svelte forms.

---

## Project Structure and Boundaries

### New / Touched Areas (M1-focused)

| Path | Responsibility |
| --- | --- |
| `src/lib/components/AiManager.svelte` | Card UI, toggles, form host, job actions. |
| `src/lib/components/PostForm.svelte` | Wire AI button + pass `mediaDB` / `helia` like MediaManager. |
| `src/lib/ai/` (suggested) | Transports, manifests, registry, job service. |
| `src/lib/dbUtils.ts` | Open/create AI DB; persist `aiDBAddress` to settings (mirror media/posts). |
| `src/lib/types.ts` | `AiJob`, `AiProviderConfig`, encrypted blob types. |
| `src/lib/store.ts` | Optional thin stores for active job UI; **do not** store AI Manager keys in `aiApiKey`/`aiApiUrl` (those remain **translation-only**). |
| `src/lib/i18n/` | New keys for AI Manager. |

### Boundaries

| Boundary | Rule |
| --- | --- |
| **UI ↔ domain** | Components call **job service**, not raw `fetch` everywhere. |
| **Domain ↔ OrbitDB** | **dbUtils** or dedicated `aiDb.ts` owns open/close; services use injected DB handle. |
| **Domain ↔ HTTP** | Only **transport** layer talks to Atlas; manifests define field mapping. |

### Requirements Traceability (PRD FR → Architecture)

| FR | Architecture element |
| --- | --- |
| FR-1 | `AiManager.svelte` + `PostForm` wiring |
| FR-2, FR-3 | AI DB + encrypted provider config |
| FR-4 | `aiDBAddress` in settings + `createDatabaseSet` extension |
| FR-5, FR-6 | Plugin registry + JSON manifests |
| FR-7, FR-8 | Media service reuse + output `Media` creation |
| FR-9 | Transport error mapping |
| FR-10 | CORS spike doc + optional relay |
| FR-11–FR-15 | M2–M4 sections above |

---

## Architecture Validation

### Coherence

- Stack remains **one** SPA + **one** libp2p/Helia instance; AI features **extend** rather than fork.  
- Payment and ERC-8004 **depend** on existing wallet patterns in app (MetaMask / ETH / USDT as per PRD)—no contradiction detected.

### Completeness

- All PRD FRs have a **named** architectural owner; **NFRs** addressed in security and bundle sections.  
- **Gaps:** Exact Atlas HTTP paths and **UCEP byte-level** schema must be filled during implementation (vendor + reference repos).

### Risks

| Risk | Mitigation |
| --- | --- |
| CORS blocks browser | Spike outcome on file; relay only if a future origin/path is blocked. |
| Cross-feature confusion | Code review: AI Manager services only read AI DB credential docs, never `translationService` stores. |
| M2 scope creep | Ship **protocol version 1** with one model before generalizing. |

---

## Completion and Handoff

This architecture is **ready for implementation** and **epic/story breakdown** (`bmad-create-epics-and-stories` or `bmad-dev-story`).  

**Suggested next steps:**  
1. **CORS spike complete** — see recorded outcome [`docs/ai-api-cors-spike-outcome-2026-04-02.md`](../../docs/ai-api-cors-spike-outcome-2026-04-02.md); re-run the checklist only if the provider, browser matrix, or API surface changes materially.  
2. Implement **M1** data layer (AI DB + encryption) before heavy UI.  
3. For **M2**, spike **UCEP** compatibility against `universal-connectivity/js-peer` in a **branch** or **fixture** peer.

For questions about BMad phase sequencing, use **`bmad-help`** and inspect `_bmad-output/` state.

---

_End of Architecture Decision Document._
