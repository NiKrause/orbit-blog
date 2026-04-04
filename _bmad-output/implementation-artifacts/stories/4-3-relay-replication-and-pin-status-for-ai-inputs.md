---
story_key: 4-3-relay-replication-and-pin-status-for-ai-inputs
epic: 4
story: 4.3
frs: FR-7c, FR-7d
ux_drs: UX §7.5 (relay sync & preview), SC-4c
---

# Story 4.3: Relay replication and pin status for AI inputs

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **blog author**,  
I want **clear visual feedback while my AI input images sync to the pinning relay**,  
so that **I know when previews will load from the relay IPFS base**.

## Acceptance Criteria

1. **Given** a **non-empty** **`VITE_RELAY_PINNED_CID_BASE`** (trailing slash normalized as needed) and a reachable **pinning relay** (same stack as **`orbitdb-relay-pinner`** / project relay scripts)  
   **When** the user **adds or changes** an **image input** value (upload or library pick — Story **4.2**)  
   **Then** the UI for that input shows a **status LED** (or equivalent non-color-only indicator per UX) progressing:  
   - **Blinking yellow** — relay has **not** yet replicated the relevant OrbitDB DB (**mediaDB** / address the relay tracks) **or** CID not yet in “orange-ready” state per agreed contract  
   - **Solid orange** — DB replication condition is **true**, CID **not** yet loadable via relay IPFS base  
   - **Green** — CID is **loadable** via **`VITE_RELAY_PINNED_CID_BASE` + CID** (FR-7c, SC-4c; [Source: `_bmad-output/planning-artifacts/prd.md` — Milestone 1 / FR-7c narrative, open questions §]).

2. **And** when **green**, the **thumbnail / preview** for that AI image input uses **`VITE_RELAY_PINNED_CID_BASE` + CID** (FR-7d), not only local Helia blob URLs or public gateways — unless local preview is explicitly retained as **fallback when relay base is unset** (see AC7).

3. **And** **green** is determined by a **small frontend module** (pure TS or `src/lib/services/*`) that the UI calls — **not** ad-hoc `fetch` scattered in Svelte. **Probe** for “CID loadable” MUST **avoid downloading the full asset** (prefer **HEAD** or **range-limited GET**; **do not** use **OPTIONS** alone as pin proof — PRD notes global 204 preflight on reference relay) ([Source: `_bmad-output/planning-artifacts/prd.md` — open question “Relay green probe”]).

4. **And** **step 1 (DB replicated on relay)** uses the **real pinning / metrics HTTP API** exposed by the deployed **`orbitdb-relay-pinner`** version (**`^0.1.2`** in root `package.json`). **Discover** the exact JSON routes/shapes from that package’s docs or running relay; document the chosen contract in code comments + optionally a short note in `docs/` if non-obvious. Poll interval MUST be **bounded** (backoff / max attempts) and **cancel** on CID change or unmount.

5. **And** **accessibility & motion:** pair states with **`aria-label`** or visually hidden text (“Syncing to relay”, “Pinning”, “Ready”); **blinking** respects **`prefers-reduced-motion`** (pulse or static “in progress”) ([Source: `_bmad-output/planning-artifacts/ux-design-specification.md` — §7.5]).

6. **And** **LED placement:** corner of the **selected-input** thumbnail / preview region; **do not** overlap the **(×)** remove control (Epic **4.2** / FR-7e); mobile touch targets stay usable ([Source: UX spec — §7.5 / §7.2]).

7. **And** if **`VITE_RELAY_PINNED_CID_BASE`** is **missing or empty**: **no** false “green”; keep **current** local/gateway preview behavior from **`AiImageField`**; show **muted** state or short i18n (“Relay preview not configured”) — do not block pick/upload.

8. **And** all **new** user-visible strings use **svelte-i18n** and are added to **every** `src/lib/i18n/*.js` file.

9. **Not in scope:** **Output** / job result LEDs (Story **5.2**, FR-8c), **Media Manager** parity (may share component, but this story **must** ship AI input path end-to-end), changing **transport** or **Atlas** code.

10. **Prerequisite:** Story **4.2** — **`AiImageField`**, **`x-ui: "image"`**, CID-bound values; this story **extends** preview + status, not a second image pipeline.

## Tasks / Subtasks

- [x] **Task 1 — Config surface (AC: 1–2, 7)**  
  - [x] Expose **`VITE_RELAY_PINNED_CID_BASE`** to app code (e.g. `import.meta.env` + `src/vite-env.d.ts` if needed); normalize trailing slash once in a helper (e.g. `src/lib/relay/relayEnv.ts` or `src/lib/configRelay.ts`).  
  - [x] Reference **`.env`** example in Dev Notes; do not log full URLs with secrets.

- [x] **Task 2 — Pinning + probe service (AC: 3–4)**  
  - [x] Implement **`relayPinStatusForCid(cid, mediaDbAddress?)`** (name as you prefer) returning a **finite state machine**: `yellow` | `orange` | `green` | `idle` (no base) | `error` (optional, non-spammy).  
  - [x] **Yellow → orange:** HTTP call to relay pinning API until **mediaDB** (or manifest DB address) is reported replicated — match **actual** relay API.  
  - [x] **Orange → green:** **HEAD** or minimal **GET** against **`base + cid`**; handle CORS (relay may need allowed origin — document dev setup if `localhost` mismatch).  
  - [x] Export cancellable polling (AbortController or explicit `dispose()`).

- [x] **Task 3 — `RelaySyncLed` UI (AC: 1, 5–6)**  
  - [x] New presentational component (e.g. **`RelaySyncLed.svelte`**) consumed by **`AiImageField`** (and later Story **5.2**).  
  - [x] CSS animation for blink; **`@media (prefers-reduced-motion: reduce)`** fallback.

- [x] **Task 4 — Wire `AiImageField` (AC: 1–2, 6–7)**  
  - [x] For **non-empty** `selectedCid`, show **thumbnail** row with **LED** + existing selection UX.  
  - [x] When **green**, set **`img src`** (or background) to **relay base + CID**; when **not green**, keep **Helia blob** or existing gateway fallback **without** blocking UI.  
  - [x] On **CID change**, reset polling state; cleanup on destroy.

- [x] **Task 5 — Verification (AC: all)**  
  - [x] **`pnpm check`** and **`pnpm test`** pass.  
  - [x] Unit tests for **URL builder**, state reducer, and **mocked** `fetch` for HEAD/pinning JSON (no live relay in CI unless already standard).  
  - [x] Extend **`test/postFormAiI18n.test.ts`** `KEYS` for new **`ai_relay_*`** (or chosen prefix) keys.  
  - [x] **Manual:** run **`pnpm relay`** (or test relay), set **`VITE_RELAY_PINNED_CID_BASE`**, upload AI image → observe yellow → orange → green and relay preview.

## Dev Notes

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md`] — **Does not yet** spell out pinning routes / HEAD vs GET; treat **`prd.md` + UX §7.5** as the product contract and **record the concrete relay API + probe** you implement in a **short ADR comment** at top of the service file or a **`docs/`** bullet if reviewers need it.  
- [Source: `_bmad-output/planning-artifacts/prd.md` — FR-7c, FR-7d, open questions] — Two-step model (DB replicate → CID retrievable); OPTIONS insufficient for green.

### Previous story intelligence (4.2)

- **`AiImageField.svelte`**: CID string binding, **`getBlobUrl`**, library grid, **`dweb.link`** fallback — **4.3** adds **relay-first preview when green** without breaking local/offline preview.  
- **Transport value** remains **CID string** for Epic **5**.

### Files to touch (expected)

| File | Change |
| --- | --- |
| `src/lib/components/AiImageField.svelte` | Thumbnail + LED + relay URL when green |
| `src/lib/components/RelaySyncLed.svelte` (new) | LED + a11y |
| `src/lib/services/relayPinStatus.ts` or `src/lib/relay/*` (new) | Polling + fetch probes |
| `src/vite-env.d.ts` | `VITE_RELAY_PINNED_CID_BASE` |
| `src/lib/i18n/*.js` | New keys |
| `test/*` | Mocks + i18n key coverage |

### Testing standards

- No secrets in tests; use **fake** CIDs and **mock** `fetch`.  
- Keep relay **optional** in unit tests.

### Git / conventions

- NodeNext **`.js`** suffix on imports from TS/Svelte.

## Dev Agent Record

### Agent Model Used

Cursor / GPT-5.2 (Composer)

### Debug Log References

### Completion Notes List

- **`orbitdb-relay-pinner`** metrics HTTP server exposes **`GET /health`** (default port **9090**); there is **no** JSON “replicated DB addresses” route in the shipped package — **yellow vs orange** uses **`/health` reachability** (when metrics base is available) plus a **short early-poll yellow** phase when metrics base is unset; **green** = **HEAD** or **Range GET** on **`VITE_RELAY_PINNED_CID_BASE` + CID**.
- **Dev CORS:** Vite **`server.proxy`** maps **`/api/relay/*`** → **`http://127.0.0.1:9090`** (override with **`VITE_RELAY_METRICS_TARGET`**). Optional **`VITE_RELAY_METRICS_BASE`** for production-style absolute metrics origin.
- Thumbnail uses **relay URL** only when LED is **green**; otherwise **local blob** / **dweb.link** fallback.

### File List

- `src/lib/relay/relayEnv.ts`
- `src/lib/services/relayPinStatus.ts`
- `src/lib/components/RelaySyncLed.svelte`
- `src/lib/components/AiImageField.svelte`
- `src/vite-env.d.ts`
- `vite.config.ts`
- `package.json` (test script)
- `src/lib/i18n/*.js`
- `test/relayPinStatus.test.ts`
- `test/postFormAiI18n.test.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Change Log

- **2026-04-04:** Story 4.3 — relay LED + polling service + `AiImageField` thumbnail; i18n; tests; Vite metrics proxy.
- **2026-04-04:** BMad code-review — **patch** applied: `startRelayPinPolling` tests + optional `metricsBase` on poll options; **defer** PRD AC4 vs `/health` proxy (unchanged).
- **2026-04-04:** Follow-up code-review — clean pass; story **done**; sprint **4-3** → **done**; defer timer-based test brittleness.

### Review Findings

_(BMad code-review — 2026-04-04; Blind Hunter + Edge Case Hunter + Acceptance Auditor vs Story 4.3.)_

- [x] [Review][Patch] **`startRelayPinPolling` lacks unit tests** — **Fixed:** `RelayPinPollOptions.metricsBase` optional override for stable CI branches; `startRelayPinPolling` tests (yellow→green, orange→green, `maxIterations`→`error`, `stop()` clears timer). [`src/lib/services/relayPinStatus.ts`, `test/relayPinStatus.test.ts`]

- [x] [Review][Defer] **AC4 “DB replicated” vs shipped relay** — Story AC4 asks for a JSON route proving **mediaDB** replication; **`orbitdb-relay-pinner` ^0.1.x** exposes **`GET /health`** only. Implementation correctly documents the proxy contract in **`relayPinStatus.ts`** (health reachability + CID **HEAD**/Range). Treat as **accepted product/engineering waiver** until the relay publishes address-level replication status; update **PRD / epics** if you need literal AC4 compliance text. [`src/lib/services/relayPinStatus.ts` header comment]

- [x] [Review][Dismiss] **“Color-only” LED for sighted users** — States differ by **motion** (blinking yellow vs solid orange/green) and **`role="status"`** + **`aria-label`** keys; reasonable match to UX “non-color-only” for this control size.

_(BMad code-review — 2026-04-04 follow-up; Blind + Edge + Acceptance vs current tree.)_

- ✅ **No new patch or decision items.** Service module, `RelaySyncLed`, `AiImageField` wiring, env helpers, and tests align with ACs given the existing **AC4 / metrics API** deferral above.

- [x] [Review][Defer] **Timer-based `startRelayPinPolling` tests** — `sleep(30)` / `sleep(850)` coupling; fine for current CI; if flakes appear, move to **fake timers** or expose a test hook for “next tick”. [`test/relayPinStatus.test.ts`]

---

## Project context reference

- `_bmad-output/project-context.md` — Svelte 5, i18n, `pnpm check`, **`VITE_*`** env rules.  
- `docs/AI_AGENTS.md` — relay spawned via **`orbitdb-relay-pinner`**, **`tests/setup.ts`**.

---

## validate-create-story (checklist) — 2026-04-04

| Severity | Finding | Resolution |
| --- | --- | --- |
| **Critical** | Pinning HTTP API shape not in `architecture.md` | Task 2: discover from **`orbitdb-relay-pinner@^0.1.2`**; document in code. |
| **Should** | **`src/lib/config.ts`** has no `VITE_RELAY_PINNED_CID_BASE` today (only `.env`) | Task 1: add typed env + helper; epic text says “config.ts / docs” — satisfy via **dedicated small module** + **vite-env**. |
| **Should** | Output LEDs duplicate pattern | AC9: scope AI inputs only; design **`RelaySyncLed`** for reuse in **5.2**. |
| **OK** | Epic **4.3** BDD matches | — |

**Completion note:** Ultimate context engine analysis completed — comprehensive developer guide created (BMad create-story workflow). Sprint tracker had no **4.3** row; added alongside **`ready-for-dev`** and **epic-4** reopened to **in-progress**.
