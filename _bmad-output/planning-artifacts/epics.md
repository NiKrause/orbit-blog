---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - ./prd.md
  - ./architecture.md
  - ./ux-design-specification.md
  - ../project-context.md
  - ../../docs/ai-api-browser-cors-spike-checklist.md
workflowType: epics-and-stories
project_name: bolt-orbitdb-blog
user_name: Nandi
date: '2026-04-02'
status: complete
workflowNote: >-
  Consolidated epic/story pass for AI Manager (M1) plus backlog epics for M2–M4.
---

# bolt-orbitdb-blog — Epic Breakdown (AI Manager)

## Overview

This document decomposes the [PRD](./prd.md), [Architecture](./architecture.md), and [UX Design Specification](./ux-design-specification.md) into epics and implementable user stories for **AI Manager** and related milestones.

## Requirements Inventory

### Functional Requirements

```
FR-1: Create/edit post exposes an AI Manager entry point distinct from Add Media but visually consistent; AI panel toggles like the media workflow.
FR-2: User can save provider base URL and API key for external AI HTTP APIs (per registered model).
FR-3: API keys are encrypted with the current identity private key before write to OrbitDB.
FR-4: AI settings and job history live in a dedicated OrbitDB database whose address is registered in settings (alongside posts, comments, media pointers).
FR-5: Model registry supports multiple entries; each has id, label, input schema (or manifest), and transport (HTTP for M1); new models can be added without a bespoke one-off Svelte form for each.
FR-6: Kling I2V models are pre-registered for Pro and Standard tiers with correct model identifiers for Atlas Cloud.
FR-7: Image inputs support upload via the existing media pipeline and selection of existing media from mediaDB.
FR-8: Successful generation creates a Media document for the output video and surfaces it in the media workflow for the post.
FR-9: API errors (auth, quota, validation) are surfaced to the user.
FR-10: CORS feasibility is verified before shipping browser-direct calls; outcome documented; relay path defined if blocked.
FR-11 (M2): Provider advertises supported models and a UCEP-compatible handshake for remote consumers.
FR-12 (M2): Consumer can run a remote job without holding the provider API secret.
FR-13 (M3): Wallet approval flow supports preset USDT amounts for paid AI runs.
FR-14 (M3): Provider verifies payment for a request per policy before execution.
FR-15 (M4): Optional ERC-8004-style provider registration and consumer feedback flows.
```

### Non-Functional Requirements

```
NFR-1: API keys and decrypted material are never logged to the console in production builds.
NFR-2: Encryption reuses existing crypto/identity utilities; no new ad-hoc cryptographic primitives.
NFR-3: AI Manager code paths lazy-load heavy dependencies where practical; respect existing Vite chunking discipline.
NFR-4: Network features for M2+ reuse the existing libp2p connection lifecycle (no duplicate peer stacks).
NFR-5: Documentation references external dependencies (Atlas Cloud API, EIP-8004, erc-8004-example) where relevant.
```

### Additional Requirements (Architecture)

```
- Brownfield: extend existing Vite + Svelte 5 + Helia + OrbitDB app; no new project scaffold.
- New AI OrbitDB with settings pointer (e.g. aiDBAddress); follow createDatabaseSet / openOrCreateDB patterns.
- Per-model credential documents (multiple base URL + encrypted key pairs); do not use aiApiKey/aiApiUrl (translation-only).
- AiHttpTransport abstraction for submit/poll/result; optional relay if CORS blocks browser.
- M2: libp2p streams + discovery aligned with UCEP reference repos (design reference).
- M3: payment options (direct transfer vs contract) validated in solution design.
- M4: ERC-8004 registry integration; gas payer TBD.
```

### UX Design Requirements

```
UX-DR1: AI control sits in the content row toolbar as a peer to Add media (same visual weight); button reflects open/closed state.
UX-DR2: Expanded AI panel uses existing design tokens (var(--border), var(--bg-tertiary), btn-ghost/btn-sm) and does not replace the markdown editor.
UX-DR3: All new user-visible strings use svelte-i18n ($_ keys); no hardcoded English in AI Manager UI.
UX-DR4: Per-model API keys are masked after save; trust copy indicates encryption at rest where specified in UX.
UX-DR5: aria-expanded and aria-controls associate the AI toggle with the panel for accessibility.
UX-DR6: Dynamic form renders schema fields with required inputs before optional (e.g. image before prompt where applicable).
UX-DR7: Job UI shows idle, running, success, and failed states; errors are inline and actionable (including CORS/API).
UX-DR8: Success state includes video preview with native controls and clear primary/secondary actions (insert vs add to selected media).
UX-DR9: AI Manager does not embed or reuse translation API settings (aiApiKey/aiApiUrl); optional short helper text clarifying separation is allowed.
UX-DR10: RTL: flex rows in the new panel respect [dir="rtl"] patterns consistent with PostForm.
```

### FR Coverage Map

| FR | Epic(s) |
| --- | --- |
| FR-1 | Epic 3 |
| FR-2 | Epic 2, 3 |
| FR-3 | Epic 2 |
| FR-4 | Epic 2 |
| FR-5 | Epic 3, 4 |
| FR-6 | Epic 3 |
| FR-7 | Epic 4 |
| FR-8 | Epic 5 |
| FR-9 | Epic 5 |
| FR-10 | Epic 1 |
| FR-11 | Epic 6 |
| FR-12 | Epic 6 |
| FR-13 | Epic 7 |
| FR-14 | Epic 7 |
| FR-15 | Epic 8 |

| NFR | Addressed in |
| --- | --- |
| NFR-1–NFR-3 | Epics 1–5 (ongoing), verify in review |
| NFR-4 | Epic 6 |
| NFR-5 | Docs / handoff story in Epic 5 or separate doc task |

| UX-DR | Epic(s) |
| --- | --- |
| UX-DR1–2, 5, 9–10 | Epic 3 |
| UX-DR3 | Epics 3–5 |
| UX-DR4, 6–8 | Epics 4–5 |

## Epic List

### Epic 1: Browser–provider HTTP readiness

Authors and developers can rely on a documented decision whether the app may call the AI provider from the browser, and the codebase exposes a testable HTTP transport abstraction for Atlas-compatible APIs.

**FRs covered:** FR-10 (primary). **Supports:** all HTTP-based stories in Epics 2–5.

### Epic 2: Encrypted per-model AI credentials in OrbitDB

Authors can persist multiple AI models, each with its own base URL and API key, encrypted at rest and stored separately from translation API keys (`aiApiKey` / `aiApiUrl`).

**FRs covered:** FR-2, FR-3, FR-4. **NFRs:** NFR-2. **UX-DR:** separation (UX-DR9).

### Epic 3: AI Manager shell in the post editor

Authors can open an AI panel from create/edit post, pick a registered model (starting with Kling Pro/Std I2V), and save per-model credentials with masked keys.

**FRs covered:** FR-1, FR-5, FR-6. **UX-DR:** UX-DR1–2, UX-DR3–5, UX-DR9–10.

### Epic 4: Schema-driven inputs and media sources

Authors can fill provider-specific fields from manifests and supply image input via upload (media pipeline) or existing media library selection.

**FRs covered:** FR-5, FR-7. **UX-DR:** UX-DR4, UX-DR6.

### Epic 5: Run generation and attach video output

Authors can execute a job, see status and errors, receive output video as Media, and attach it to the draft in line with existing post/media behavior.

**FRs covered:** FR-8, FR-9. **UX-DR:** UX-DR7–8. **NFRs:** NFR-1, NFR-3 (verify).

### Epic 6 (Backlog / M2): Network AI provider and consumer

Remote peers can discover providers that advertise AI capabilities and run jobs over libp2p without sharing API keys with consumers.

**FRs covered:** FR-11, FR-12. **NFR:** NFR-4.

### Epic 7 (Backlog / M3): Paid AI consumption

Consumers can approve USDT payments for preset amounts; providers can verify settlement before running paid jobs.

**FRs covered:** FR-13, FR-14.

### Epic 8 (Backlog / M4): On-chain reputation (ERC-8004)

Providers can register agents and consumers can submit feedback in line with ERC-8004-style patterns.

**FRs covered:** FR-15.

---

## Epic 1: Browser–provider HTTP readiness

**Goal:** Document whether browser-direct calls to the chosen AI API are viable; provide a mockable HTTP transport layer aligned with Atlas queue semantics.

### Story 1.1: Record browser CORS spike outcome

As a **developer**,  
I want **recorded results from the browser CORS checklist** for our target API base URL,  
So that **we know whether to ship direct `fetch` or plan a relay**.

**Acceptance Criteria:**

**Given** the project checklist at `docs/ai-api-browser-cors-spike-checklist.md`  
**When** the spike is executed from a real browser origin (local dev and, if applicable, HTTPS deploy)  
**Then** outcomes are recorded using the checklist’s outcome template (direct OK, CORS blocked, auth error, etc.)  
**And** the record is stored under `docs/` or `_bmad-output/` with date and tester reference  
**And** no production API keys are committed in the recorded artifact.

### Story 1.2: AiHttpTransport abstraction and tests

As a **developer**,  
I want **an `AiHttpTransport` (or equivalent) interface with a mock implementation**,  
So that **UI and job logic can be tested without live Atlas calls**.

**Acceptance Criteria:**

**Given** the architecture decision for submit/poll/result  
**When** a consumer calls the transport with a minimal job payload  
**Then** the interface supports the methods needed for M1 (e.g. submit, poll status, fetch result) as defined in implementation  
**And** unit tests run against a mock without network  
**And** production logging does not print API keys or decrypted secrets (NFR-1).

---

## Epic 2: Encrypted per-model AI credentials in OrbitDB

**Goal:** Dedicated AI database, settings pointer, encrypted credential documents; strict isolation from translation stores.

### Story 2.1: Create AI OrbitDB and settings registration

As a **blog author**,  
I want **my AI configuration stored in the same blog replica as my other databases**,  
So that **credentials and jobs sync with my OrbitDB identity**.

**Acceptance Criteria:**

**Given** a writable settings DB and OrbitDB bootstrap  
**When** the app initializes or creates a database set  
**Then** an AI documents database is opened or created following existing `dbUtils` patterns  
**And** its address is persisted in settings (e.g. `aiDBAddress`) analogous to `mediaDBAddress`  
**And** existing blogs gain the pointer when upgraded without deleting unrelated data.

### Story 2.2: Encrypt and store per-model credentials

As a **blog author**,  
I want **each registered model’s base URL and API key stored encrypted**,  
So that **keys are not plaintext at rest**.

**Acceptance Criteria:**

**Given** the current identity can derive encryption keys per architecture  
**When** the app saves a credential document for a model id  
**Then** the API key field is stored encrypted (ciphertext + metadata as per design)  
**And** round-trip decrypt works for the same identity in tests  
**And** `aiApiKey` / `aiApiUrl` are not read or written by this code path (translation-only).

### Story 2.3: Credential document shape for multiple models

As a **blog author**,  
I want **more than one model each with its own URL and key**,  
So that **I can use different vendors or tiers without overwriting settings**.

**Acceptance Criteria:**

**Given** the AI DB  
**When** I save credentials for model A and then for model B  
**Then** both documents coexist with distinct stable ids  
**And** updating model A does not change model B’s record.

---

## Epic 3: AI Manager shell in the post editor

**Goal:** Visible AI entry point, panel shell, i18n, Kling manifests, model selection, per-model save and masked display.

### Story 3.1: AI toggle and panel in PostForm

As a **blog author**,  
I want **an AI button next to Add media that expands an AI panel**,  
So that **I can configure generation without leaving the post editor**.

**Acceptance Criteria:**

**Given** create (or edit) post view  
**When** I click the AI control  
**Then** the AI panel toggles open or closed and the button label or state reflects that  
**And** `aria-expanded` / `aria-controls` are wired per UX-DR5  
**And** all new strings use i18n keys (UX-DR3).

### Story 3.2: Register Kling Pro and Standard I2V manifests

As a **blog author**,  
I want **to choose Kling Pro and Standard image-to-video from a dropdown**,  
So that **I pick the correct Atlas model id**.

**Acceptance Criteria:**

**Given** the AI panel is open  
**When** I view the model selector  
**Then** at least two entries exist for Kling I2V Pro and Standard with labels matching product intent  
**And** each entry maps to the correct `model` string required by the provider  
**And** manifests live in a maintainable registry (e.g. `src/lib/ai/manifests/`).

### Story 3.3: Per-model URL and key form with save and mask

As a **blog author**,  
I want **to enter base URL and API key for the selected model and save**,  
So that **I can run jobs later without retyping secrets every session**.

**Acceptance Criteria:**

**Given** a selected model  
**When** I enter base URL and API key and save  
**Then** credentials persist via Epic 2 storage  
**And** the key is shown masked after save (UX-DR4)  
**And** translation Settings fields are not used (UX-DR9).

---

## Epic 4: Schema-driven inputs and media sources

**Goal:** Render manifest fields; image input via library + upload.

### Story 4.1: JSON Schema (or subset) field renderer

As a **blog author**,  
I want **fields for the selected model to appear automatically from its manifest**,  
So that **new models do not each require a custom hardcoded form**.

**Acceptance Criteria:**

**Given** a manifest describing fields (types, required, order)  
**When** I change the selected model  
**Then** the form updates to show the correct controls  
**And** required fields are validated before Run (UX-DR6).

### Story 4.2: Image input from library and upload

As a **blog author**,  
I want **to pick an existing image from my media library or upload a new one for the job**,  
So that **the provider receives an image consistent with my blog’s media pipeline**.

**Acceptance Criteria:**

**Given** mediaDB and Helia available  
**When** I pick from library or upload  
**Then** uploads follow the same media persistence path used elsewhere for posts  
**And** selected library items reference valid `Media` / CID as required by the transport  
**And** FR-7 is satisfied in manual or automated tests.

---

## Epic 5: Run generation and attach video output

**Goal:** End-to-end job execution, error display, Media creation, preview, attach to post.

### Story 5.1: Submit job and show lifecycle status

As a **blog author**,  
I want **to run generation and see progress and clear errors**,  
So that **I know whether to wait, fix config, or retry**.

**Acceptance Criteria:**

**Given** valid credentials and inputs  
**When** I start a run  
**Then** the UI shows running state and then success or failure  
**And** auth, quota, validation, and network/CORS failures surface actionable messages (FR-9, UX-DR7).

### Story 5.2: Ingest output video into Media and attach to draft

As a **blog author**,  
I want **the generated video to appear as media I can use in my post**,  
So that **I can publish it like any other asset**.

**Acceptance Criteria:**

**Given** a successful job that returns video bytes or URL per provider contract  
**When** ingestion completes  
**Then** a new `Media` document exists in mediaDB and appears in the media workflow  
**And** I can preview video with native controls (UX-DR8)  
**And** I can add the asset to the post (selected media and/or markdown insertion per existing app behavior).  
**And** FR-8 is satisfied.

### Story 5.3: NFR verification and documentation touchpoint

As a **maintainer**,  
I want **NFR-1–NFR-3 and NFR-5 verified for the AI Manager feature**,  
So that **shipping does not regress security or bundle hygiene**.

**Acceptance Criteria:**

**Given** implemented Epics 1–5  
**When** running production build and targeted tests  
**Then** no decrypted keys or raw keys are logged in production paths  
**And** heavy AI modules are loaded lazily where agreed  
**And** README or `docs/` links Atlas / EIP references as needed (NFR-5).

---

## Epic 6 (Backlog / M2): Network AI provider and consumer

**Goal:** Discovery and libp2p execution path for remote providers; consumers need no provider API key.

### Story 6.1: Advertise supported models to peers

As a **provider**,  
I want **peers to see which AI models I host**,  
So that **consumers can choose me in the network layer**.

**Acceptance Criteria:**

**Given** M2 protocol design approved  
**When** a peer connects or subscribes to the agreed discovery channel  
**Then** capability payload includes model ids and protocol version (FR-11).

### Story 6.2: Consumer runs remote job without provider API secret

As a **consumer**,  
I want **to request a generation from a remote provider over libp2p**,  
So that **I do not configure the provider’s API key locally**.

**Acceptance Criteria:**

**Given** a discovered provider and negotiated stream  
**When** I submit a job per protocol  
**Then** the consumer never receives or stores the provider’s Atlas API key (FR-12, NFR-4).

---

## Epic 7 (Backlog / M3): Paid AI consumption

### Story 7.1: Wallet flow for preset USDT approvals

As a **consumer**,  
I want **to approve a preset USDT amount before a paid remote or direct job**,  
So that **the provider can verify payment**.

**Acceptance Criteria:**

**Given** MetaMask (or existing wallet integration)  
**When** I confirm a paid run  
**Then** the flow matches FR-13 and does not put full prompts on chain (per PRD).

### Story 7.2: Provider payment verification gate

As a **provider**,  
I want **to verify payment before executing a paid job**,  
So that **I am not exploited**.

**Acceptance Criteria:**

**Given** a job id and payment policy  
**When** verification runs  
**Then** execution proceeds only if policy is met (FR-14).

---

## Epic 8 (Backlog / M4): On-chain reputation (ERC-8004)

### Story 8.1: Provider agent registration and consumer feedback hooks

As a **provider**,  
I want **to register my agent and receive structured feedback**,  
So that **reputation is visible on-chain per ERC-8004 patterns**.

**Acceptance Criteria:**

**Given** target chain and contract addresses from architecture  
**When** registration and feedback flows are invoked  
**Then** FR-15 baseline is achievable and gas-payer UX is documented.

---

## Document history

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 2026-04-02 | Initial epic/story breakdown from PRD, architecture, UX spec |
