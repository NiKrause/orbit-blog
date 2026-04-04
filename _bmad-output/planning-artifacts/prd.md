---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
workflow: edit
lastEdited: '2026-04-04'
editHistory:
  - date: '2026-04-04'
    changes: >-
      Milestone 1: immediate mediaDB persistence for uploads; relay replication/pin
      status UX (LED); VITE_RELAY_PINNED_CID_BASE; multi/single image AI inputs;
      delete control; AIDB run logging on Generate; run outputs to media/post body;
      open issues for relay unpin and probe method (OPTIONS vs HEAD).
inputDocuments:
  - ../../_bmad-output/project-context.md
  - ../../docs/index.md
  - ../../docs/project-overview.md
  - ../../docs/data-models.md
  - user-provided-feature-description-2026-04-02
workflowType: prd
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 5
workflowNote: >-
  PRD drafted in a single pass from author requirements and brownfield docs.
  Interactive step-by-step BMad workflow can be re-run for deltas; this file is the authoritative artifact.
---

# Product Requirements Document — bolt-orbitdb-blog (AI Manager & Distributed AI)

**Author:** Nandi  
**Date:** 2026-04-02

## Executive Summary

**Le Space Blog** (bolt-orbitdb-blog) is a local-first, peer-to-peer blogging SPA (Svelte 5, Helia, libp2p, OrbitDB). This PRD adds an **AI Manager** on the create/edit post screen: a card alongside the existing **Media Manager**, where authors configure external AI providers (starting with **Kling v3.0 Pro** and **Kling v3.0 Standard** image-to-video), run jobs, and attach generated video to posts via the existing **media** pipeline.

The work is **phased in four milestones**: (1) first-party API usage with schema-driven UI, encrypted credentials in OrbitDB, **immediate mediaDB** uploads with **pinning-relay** replication/pin **status LEDs**, **AIDB** run logging on every generate, and **post body** integration for text and media outputs; (2) **UCEP-style** libp2p discovery and provider/consumer roles so remote peers can use hosted models without embedding API keys; (3) **ETH/USDT** payment flows for paid consumption; (4) **ERC-8004**-aligned reputation for providers and feedback from consumers.

**Differentiator:** AI generation stays tied to the blog’s OrbitDB + media model, with a path from solo API use to **trust-minimized** network sharing (UCEP) and then **economic** and **reputation** layers—without forcing full prompt disclosure on chain.

## Success Criteria (SMART)

| ID | Criterion | Measurement |
| --- | --- | --- |
| SC-1 | Authors can open AI Manager from create/edit post | Task completes in one obvious UI path (button next to Add Media); card toggles like Media Manager |
| SC-2 | Authors can configure provider endpoint + API key for at least two Kling I2V model IDs | Stored in dedicated OrbitDB data; keys not plaintext at rest |
| SC-3 | UI matches model input schema | Required/optional fields from provider docs; Kling I2V: prompt, negative_prompt, image, end_image, duration, cfg_scale, sound, voice_list per provider documentation |
| SC-4 | Images for AI jobs reuse Media Manager | Upload path writes to **mediaDB**; users can pick existing **Media** as image input |
| SC-4b | Uploads trigger immediate **mediaDB** write | New or replaced uploads in **AI Manager** and **Media Manager** persist to **mediaDB** at upload time so the **orbitdb-pinning-relay** can replicate without waiting for post save |
| SC-4c | Authors see relay sync state on uploads | Per-upload **status LED**: blinking **yellow** until **mediaDB** is replicated on the relay; **orange** when DB is replicated but relay-served **CID** is not yet loadable; **green** when the image is loadable from the configured relay **IPFS** base URL |
| SC-5 | Successful run produces video in media library | New **Media** entry (and blob/CID handling consistent with existing media flow); insertable into post markdown |
| SC-5b | Every **Generate run** is recorded | Clicking **Generate run** appends a **run** record to **AIDB** whether the job succeeds or fails; architecture defines minimal fields (model, inputs snapshot, timestamps, status, errors) |
| SC-5c | Run outputs land in post workflow | **Image/video** (and other binary media) outputs become **Media** in **mediaDB**; **text** outputs from the chosen model populate or append to the **post body**; media outputs are **referenced in the post body** (e.g. markdown embeds) per model contract |
| SC-6 | CORS feasibility known before ship | Spike documented: browser-direct vs proxy; decision recorded |
| SC-7 | Milestone 2: optional remote execution | Consumer discovers provider; negotiates model list; streams request/result without consumer API key |
| SC-8 | Milestone 3: paid runs | Consumer approves preset USDT amounts; provider verifies settlement before/around execution |
| SC-9 | Milestone 4: reputation hooks | Provider can register agent identity; consumer can submit feedback per ERC-8004 patterns |

## Product Scope

### Milestone 1 — First-party AI (MVP for this PRD)

- UI: **AI** button/card on create/edit post (parity with Media Manager toggle pattern).
- Model selection: at minimum **Kling v3.0 Pro** and **Kling v3.0 Standard** image-to-video (Atlas Cloud unified API pattern); endpoint + API key configuration per deployment.
- **Dynamic form generation** from machine-readable model definitions (JSON Schema or equivalent internal manifest) so adding Text2Image and other modalities later does not require one-off screens per model.
- **AI configuration OrbitDB** registered in **settingsDB** alongside posts, comments, media (new address pointer + bootstrap in app init).
- **Secrets:** encrypt API keys with the **current identity private key**; document future **WebAuthn + PRF / passkey** wrapping—**not in M1 scope**.
- **Media integration (immediate persistence):** Any **image upload** in **AI Manager** or **Media Manager** creates or updates **mediaDB** **immediately** (not deferred until post publish). Goal: the **orbitdb-pinning-relay** starts replicating **mediaDB** right away so **mediaIds** / **CID** fields can be scanned and CIDs pinned per relay behavior.
- **Relay observability (product contract):** The pinning relay exposes HTTP APIs such as **pinning** (e.g. which OrbitDB addresses have been replicated) and **IPFS** (e.g. `GET /ipfs/<cid>` for pinned content). **AI Manager** (and shared upload UI where applicable) treats sync as **two steps**: (1) **mediaDB** (or relevant DB address) appears as replicated on the relay; (2) the **image CID** is pinned and retrievable via the relay’s **IPFS** route.
- **Dev/prod URL for pinned content:** Use env **`VITE_RELAY_PINNED_CID_BASE`** (example: `http://localhost:81/ipfs/`) as the base URL for loading relay-served media in development; production uses the deployment-specific relay base.
- **Per-upload status LED:** **Blinking yellow** while step (1) is false; **solid orange** when step (1) is true and step (2) is false; **green** when step (2) is true. **Probe for step (2):** Architecture SHALL confirm whether **OPTIONS** on `/ipfs/<cid>` is sufficient; the reference **orbitdb-relay-pinner** metrics server responds to **OPTIONS** with **204** and CORS headers for preflight but does **not** validate pin state—**green** likely requires **HEAD** or a minimal **GET** (document final choice in architecture; avoid full asset download if possible).
- **AI image inputs:** If the selected model’s schema supports **multiple** images, the UI allows multiple uploads/selections; if only **one** image is supported, each new upload **replaces** the prior registry entry (prior CID may become eligible for unpin on the relay—**see open questions**).
- **Remove uploaded AI input:** **AI Manager** offers a small **(×)** overlay on the upper-right of each input thumbnail (same interaction pattern as **Media Manager** where it exists) to detach/delete that input from the run form and **mediaDB** as per app delete semantics.
- **Run history (M1 vs follow-up):** **AI Manager** (on **Generate run**—not the Media Manager card) persists a **run** to **AIDB** on every click (success or failure). **Follow-up (same milestone family, can ship shortly after core M1):** dropdown to **select**, **delete**, and **re-run** a stored run; PRD assumes data model supports this without a second migration if possible.
- **Run outputs:** **Binary media** (image, video, other file outputs) → new **Media** in **mediaDB** with same relay LED semantics as uploads. **Text** outputs → merged into **post body** according to model type (append vs replace defined per manifest). **Post body** automatically **references** returned media (markdown or equivalent) so the editor shows embeds without manual CID pasting.
- **Spike (blocking implementation detail):** verify whether Atlas Cloud allows browser calls or requires a same-origin or server relay due to **CORS**; document outcome and NFR implications.

### Milestone 2 — Network provider / consumer (UCEP-aligned)

- **Discovery:** remote OrbitDB/libp2p peers can discover instances that **advertise** AI Manager capabilities (which models, protocol version).
- **Protocol:** align with **Universal Connectivity Extension Protocol (UCEP)** patterns: reference implementations **js-peer (consumer)** at `DecentraSol/universal-connectivity/js-peer` and **yjs libp2p provider** example at `js-libp2p-examples/examples/js-libp2p-example-yjs-libp2p` as architectural references (exact code reuse vs port TBD in architecture).
- **Roles:** a node can **host** (provider) models for others or **consume** from others **without** installing consumer-side API keys/endpoints for those remote models.
- **Free tier:** M2 focuses on **protocol + capability advertisement + stream multiplexing** without mandatory payment (payment is M3).

### Milestone 3 — Payment (ETH / USDT)

- Reuse app’s existing **MetaMask** + **ETH/USDT** assumptions.
- Consumer selects preset approvals (e.g. **5 / 10 / 20 USDT** defaults, configurable).
- Provider verifies **payment / authorization** for a given request id; **do not store full prompts on chain**—only financial commitment and references.
- **Architecture note (to validate in solution design):** compare **direct transfers with off-chain receipt** vs **minimal escrow / splitter contract** for fee routing to provider + configurable protocol fee address; document pros/cons (trust model, dispute handling, gas, UX).

### Milestone 4 — Reputation (ERC-8004)

- Follow patterns from **[erc-8004-example](https://github.com/vistara-apps/erc-8004-example)** (identity / reputation / validation registries).
- Provider registers **agent** for offered models; consumer submits **feedback** after jobs.
- **Open product question:** who pays gas for registration and feedback transactions—document options (consumer, provider, subsidized relay) in architecture; not decided in this PRD.

## User Journeys

### Journey A — Author uses first-party API (M1)

1. Opens create/edit post → clicks **AI** → AI Manager card opens.
2. Enters Atlas (or compatible) base URL + API key (once); chooses **Kling v3.0 Pro I2V**.
3. Sees generated form (prompt, negative prompt, image picker, optional end image, duration, cfg_scale, sound, voice list).
4. Uploads a new image **or** picks existing media → **mediaDB** is written **immediately**; **LED** shows **yellow** → **orange** → **green** as relay replication and CID pinning progress; preview loads from **`VITE_RELAY_PINNED_CID_BASE`** when green.
5. Optionally removes an input via **(×)** on the thumbnail; optional multi-image inputs when the model schema allows (otherwise single slot overwrites).
6. Clicks **Generate run** → a **run** row is stored in **AIDB** immediately (pending/completed/failed).
7. Watches progress/errors → **video** (or other media) lands in **mediaDB** with the same relay status pattern; **text** output updates **post body**; media is **referenced in the post body** automatically where applicable.

### Journey B — Remote consumer (M2)

1. Consumer node discovers a peer advertising AI I2V (and model ids).
2. Opens AI Manager → chooses **Network** / **Remote provider** → selects discovered model.
3. Submits job over **libp2p stream** (UCEP-style); no API key on consumer for that provider.
4. Receives asset reference or streamed result; media lands in local **mediaDB** for the post.

### Journey C — Paid job (M3)

1. Consumer connects wallet → approves USDT amount for the job id / quote.
2. Provider verifies payment event against policy → executes → settles attribution (fee split).

### Journey D — Reputation (M4)

1. Provider registers ERC-8004 agent identity for its offering.
2. After job, consumer leaves structured feedback tied to the interaction.

## Domain Requirements

- **Not** HIPAA/PCI as primary domain; **financial** touches in M3 imply: clear disclosure, test on testnets first, no custodial key storage by the app beyond existing wallet patterns.
- **Secrets:** treat API keys as **high sensitivity**; encryption at rest with identity key; audit logging of *access* optional in later NFRs.

## Innovation Analysis

- **Composable AI “skills”:** internal **plugin/skill** interface so new models (Text2Image, etc.) register schema + transport + pricing hooks—aligned with “skills from other agents” interoperability.
- **P2P AI offload:** moves cost and keys to willing providers; consumers get capability without centralized accounts—**if** UCEP-style discovery ships.

## Project-Type Requirements (Web / P2P SPA)

- **Browser constraints:** file upload size, memory, CORS—drive M1 spike.
- **Offline / partial connectivity:** job state should degrade gracefully (queued vs failed) per existing P2P patterns.
- **i18n:** new UI strings via **svelte-i18n** (see `project-context.md`).

## Functional Requirements

| ID | Requirement | Test / acceptance hint |
| --- | --- | --- |
| FR-1 | Create/edit post exposes **AI Manager** entry point distinct from **Add Media** but visually consistent | UI test: both cards toggle independently |
| FR-2 | User can save **provider base URL** and **API key** for external AI HTTP API | Values persist across sessions; key not shown in plaintext after save (masked) |
| FR-3 | API keys encrypted with **current private key** before write to OrbitDB | Unit test: round-trip decrypt with same identity |
| FR-4 | New **AI settings / jobs** data lives in an OrbitDB DB whose address is registered in **settingsDB** | Integration: fresh blog creates/opens DB; pointer in settings |
| FR-5 | Model registry supports multiple entries; each has **id**, **label**, **input schema** (or link to schema doc), **transport** (http M1) | Adding a new manifest adds UI without new hardcoded Svelte form |
| FR-6 | Kling I2V models pre-registered for Pro and Standard tiers | User can select either; request uses correct `model` string per Atlas Cloud |
| FR-7 | Image inputs: **upload** uses existing media pipeline; **pick existing** lists mediaDB | Media documents created/linked as today for posts |
| FR-7b | **Immediate mediaDB write** on upload in **AI Manager** and **Media Manager** | Integration: entry exists before post save; observable on relay pinning API |
| FR-7c | **Replication + pin status** for uploads and generated media: detect relay **DB replicated**, then **CID** available via relay **IPFS** base | UI LED matches states; polling/backoff strategy in architecture |
| FR-7d | **Relay base URL** for dev/prod supplied via **`VITE_RELAY_PINNED_CID_BASE`** | Config doc + example localhost relay |
| FR-7e | **AI input removal** via corner **(×)** on thumbnail; behavior aligned with Media Manager | UI test; mediaDB/orbit entry updated per delete semantics |
| FR-7f | **Multi-image** inputs when model manifest declares multiple; **single-image** models **replace** prior input on new upload | Schema-driven UI test |
| FR-8 | Successful generation creates **Media** for output video and surfaces it in Media Manager | E2E or integration: CID/name present |
| FR-8b | **Generate run** click always creates an **AIDB** run record (success or failure) | Integration: failed API still persists run with error |
| FR-8c | **Outputs:** binary results → **mediaDB**; text results → **post body** per model rules; **post body** includes **references** to returned media | Content test on representative model |
| FR-9 | Errors from API surfaced to user (auth, quota, validation) | Mock failure paths |
| FR-10 | **CORS spike** completed; if browser blocked, app documents **relay** requirement (separate task) | Written decision in `docs/` or architecture artifact |
| FR-11 | M2: Provider advertises **supported models** and **UCEP-compatible** handshake | Interop test with reference consumer pattern |
| FR-12 | M2: Consumer can run job without provider API secret | Security review: no key leakage over stream |
| FR-13 | M3: Wallet approval flow for preset USDT tiers | Testnet harness |
| FR-14 | M3: Provider checks payment before execution per policy | Unit/integration with mocked chain |
| FR-15 | M4: Optional ERC-8004 registration + feedback flows | Out of scope for M1 code; in scope for M4 |

## Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | API keys and decrypted keys never logged to console in production builds |
| NFR-2 | Encryption uses existing crypto/identity utilities; no new random crypto primitives invented in-app |
| NFR-3 | AI Manager lazy-loads heavy SDKs if introduced; main bundle stays within current chunking discipline |
| NFR-4 | Network features (M2+) reuse existing **libp2p** connection lifecycle; no duplicate peer stacks |
| NFR-5 | Documentation lists **external** dependencies: [Atlas Cloud Kling v3.0 Pro I2V](https://www.atlascloud.ai/models/kwaivgi/kling-v3.0-pro/image-to-video?tab=api), ERC-8004 [EIP-8004](https://eips.ethereum.org/EIPS/eip-8004), [erc-8004-example](https://github.com/vistara-apps/erc-8004-example) |

## Open Questions & Dependencies

1. **CORS:** Confirm Atlas Cloud (and chosen base URL) **Access-Control** policy for browser `fetch`; if disallowed, define minimal **backend or worker relay** in architecture (out of repo or tiny adjunct)—**must complete before M1 implementation**.
2. **Exact HTTP contract:** Align request/response shapes (polling vs webhook vs SSE) with Atlas Cloud **Queue: Submit → Status → Result** flow from their docs; capture in API contract appendix during architecture.
3. **Relay “green” probe:** Confirm in architecture whether **HEAD** or **range-limited GET** on `VITE_RELAY_PINNED_CID_BASE` + CID is required; **OPTIONS** may be supported for CORS but **not** prove pin readiness on reference **orbitdb-relay-pinner** (global **204** preflight).
4. **Pinning API mapping:** Exact JSON shape for “**mediaDB replicated**” (e.g. `/pinning/databases` vs other route) depends on relay version—architecture pins contract against the deployed relay.
5. **Unpin on delete:** If **mediaDB** entries are removed via **`db.del()`** (or UI delete), does the relay **stop pinning** associated CIDs? If not, file/track an **issue** on **orbitdb-relay-pinner** and document operational gap (storage growth, stale pins).
6. **WebAuthn + PRF:** Document key-wrapping migration path only; implementation deferred.
7. **M3 settlement:** Compare **EOA transfers + signed receipts** vs **smart contract** for fee split—architecture phase shall list pros/cons (disputes, automation, gas, trust).
8. **M4 gas:** Who funds registry/feedback txs—product decision.

## Traceability (Milestones → themes)

| Milestone | Themes |
| --- | --- |
| M1 | UI, OrbitDB, encryption, media pipeline, immediate mediaDB + relay LED, AIDB runs, Atlas HTTP, CORS spike |
| M2 | UCEP-like discovery, libp2p streams, provider/consumer |
| M3 | Wallet, USDT presets, provider verification |
| M4 | ERC-8004 registries, feedback |

---

_This PRD follows BMad information-density guidance: capabilities and measurable outcomes first; solution binding (exact libraries, contract addresses) belongs in the Architecture phase._
