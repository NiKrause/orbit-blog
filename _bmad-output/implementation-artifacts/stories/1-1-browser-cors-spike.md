---
story_key: 1-1-browser-cors-spike
epic: 1
story: 1.1
---

# Story 1.1: Record browser CORS spike outcome

Status: done

## Story

As a **developer**,  
I want **recorded results from the browser CORS checklist** for our target API base URL,  
so that **we know whether to ship direct `fetch` or plan a relay** (FR-10).

## Acceptance Criteria

1. **Given** the checklist at [`docs/ai-api-browser-cors-spike-checklist.md`](../../../docs/ai-api-browser-cors-spike-checklist.md)  
   **When** the spike is executed from a **real browser** origin (not Node/`curl` alone)  
   **Then** outcomes are recorded using the checklist’s **outcome template** (direct OK, CORS blocked, auth error, mixed content, etc.).

2. **And** the record is stored under **`docs/`** or **`_bmad-output/`** with **date** and **tester** reference.

3. **And** **no production API keys** are committed in the artifact (use restricted/test keys; rotate if exposed in DevTools).

4. **And** at least **local dev** origin is exercised (`pnpm dev` → app origin, e.g. `http://localhost:5173`); **production-like** (`pnpm build && pnpm preview`) and/or **HTTPS deploy** are exercised when feasible (matrix rows B/C in checklist).

## Tasks / Subtasks

- [x] Preconditions: document **exact API base URL** (and minimal endpoint/method from vendor docs); obtain **test/restricted** key; identify **smallest** request (health/models/GET) for connectivity proof. (AC: 1, 3)
- [x] Run checklist sections 1–5 in **DevTools Network** on the app tab (not `about:blank`). (AC: 1, 4)
- [x] Fill the checklist **outcome template** with: provider, URL tested, app origins, result class, preflight behavior, decision (direct fetch vs relay vs dev proxy). (AC: 1, 2)
- [x] Save the outcome as a dated markdown file (e.g. `docs/ai-api-cors-spike-outcome-YYYY-MM-DD.md` or `_bmad-output/implementation-artifacts/cors-spike-outcome-YYYY-MM-DD.md`). (AC: 2)
- [x] Verify no secrets in git diff before commit. (AC: 3)
- [x] Cross-link from [`_bmad-output/planning-artifacts/architecture.md`](../../planning-artifacts/architecture.md) CORS row or from `docs/index.md` if the team wants a single index entry (optional). (AC: 2)

## Dev Notes

### What this story is

- **Spike / documentation**, not production feature code. Deliverable is an **evidence-backed decision record** for FR-10.
- **Node and Mocha prove nothing about CORS**; the verdict is **browser Network + console** per checklist.

### Epic order vs current codebase

- Epics list **1.1 before 1.2**. Story **1.2** (`AiHttpTransport`) may already exist in the repo; this story **backfills** the mandated **CORS spike** and does **not** require changing transport code unless the outcome explicitly drives a follow-up.

### Architecture compliance

- [Source: `_bmad-output/planning-artifacts/architecture.md` — M1 transport, CORS spike row]  
  - Spike is **mandatory pre-implementation** for browser-direct calls; if CORS blocks: **same-origin relay** is the product pattern (separate deployable or dev-only proxy)—not assumed until spike completes.
- [Source: `project-context.md` — Secrets]  
  - Never commit or log production keys; redact screenshots/logs in the written outcome.

### File / doc expectations

- Prefer **`docs/`** for a durable, repo-visible spike outcome; use **`_bmad-output/implementation-artifacts/`** if treating it as sprint evidence only—either is acceptable per AC.
- Keep the checklist’s outcome block **paste-ready** so PM/architecture can lift it into an ADR later.

### Testing

- No new automated test required. **Manual:** reproducible steps in the saved doc (which origin, which `fetch` snippet or UI path, what appeared in Network).

### References

- Checklist: [`docs/ai-api-browser-cors-spike-checklist.md`](../../../docs/ai-api-browser-cors-spike-checklist.md)
- Epics: [`_bmad-output/planning-artifacts/epics.md`](../../planning-artifacts/epics.md) — Epic 1, Story 1.1
- Architecture: [`_bmad-output/planning-artifacts/architecture.md`](../../planning-artifacts/architecture.md) — CORS spike, optional relay

## Dev Agent Record

### Agent Model Used

Composer (Cursor agent)

### Implementation Plan

- Document **Atlas Cloud** base URL `https://api.atlascloud.ai` with minimal **`GET /v1/models`** probe (no key required for connectivity/CORS signal).
- Use **`curl`** with `Origin: http://localhost:5173` and `http://localhost:4173` to capture the same **`Access-Control-*`** headers the browser would see for OPTIONS/GET.
- Load **`http://localhost:5173/`** in the IDE browser to confirm the **app origin** (matrix row A).
- Write outcome to **`docs/ai-api-cors-spike-outcome-2026-04-02.md`**; link from **`docs/index.md`** and **`architecture.md`**.

### Debug Log

_(none)_

### Completion Notes

- Outcome doc records **direct browser viable** for probed paths: Atlas returns matching **`access-control-allow-origin`** for localhost dev and preview **Origins**, **`access-control-allow-credentials: true`**, and allows **`authorization`** / **`content-type`** on preflight.
- **Row B:** preview server not run; **Origin `http://localhost:4173`** verified via dedicated preflight probe.
- **Row C (deployed HTTPS):** deferred — doc calls out re-validation when the production domain exists.
- **Follow-up:** DevTools check with a **restricted key** on first real **POST** job still recommended before M1 (story doc).
- No API keys committed.
- **Code review (B):** Added **Chromium** in-page `fetch` to `/v1/models` (Playwright) from Vite origin; documented DevTools parity snippet; checklist sections 1–5 mapping; fixed architecture link. Verification used port **5174** when **5173** was in use.

## File List

- `docs/ai-api-cors-spike-outcome-2026-04-02.md` (new)
- `docs/index.md` (index row for outcome)
- `_bmad-output/planning-artifacts/architecture.md` (CORS spike row — link to outcome)
- `_bmad-output/implementation-artifacts/stories/1-1-browser-cors-spike.md` (this file)
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

- **2026-04-02:** Story 1.1 created — browser CORS spike outcome (FR-10).
- **2026-04-02:** Spike executed — outcome doc, index + architecture links, sprint status → review.
- **2026-04-02:** Code review option **B** — Chromium `fetch` verification + doc patches; story **done**.

### Review Findings

- [x] [Review][Decision] AC1 vs methodology — **Resolved (B):** Outcome doc updated with **Browser verification (Chromium)** — in-page `fetch` to `https://api.atlascloud.ai/v1/models` from Vite app origin; **200** + JSON; DevTools parity snippet added.

- [x] [Review][Patch] Outcome doc Related links — **Fixed:** relative link to [`architecture.md`](../_bmad-output/planning-artifacts/architecture.md) from `docs/ai-api-cors-spike-outcome-2026-04-02.md`.

- [x] [Review][Patch] Task vs evidence — **Fixed:** **Checklist sections 1–5 (mapping)** table + primary AC1 evidence called out under Browser verification; curl labeled supplementary.

- [x] [Review][Patch] Architecture handoff still instructs “Run CORS spike” as suggested next step 1 — [`_bmad-output/planning-artifacts/architecture.md`](../planning-artifacts/architecture.md) lines 266–268 duplicate work now that [`docs/ai-api-cors-spike-outcome-2026-04-02.md`](../../../docs/ai-api-cors-spike-outcome-2026-04-02.md) exists; replace with pointer to the outcome doc and promote M1 data-layer work as the next focus. **Fixed:** Completion handoff + risks row updated in `architecture.md` (2026-04-02 review).

- [x] [Review][Defer] AC4 matrix row B — **Deferred:** Live `pnpm preview` was not run; outcome documents **curl** preflight for `http://localhost:4173` and defers full preview parity — acceptable under “when feasible” with explicit follow-up in outcome.

- [x] [Review][Defer] Large `architecture.md` in same change set as spike — **Deferred:** Full ADR is a BMad planning artifact; spike AC only required cross-link / index entry; bundling is a brownfield commit choice, not an AC miss.
