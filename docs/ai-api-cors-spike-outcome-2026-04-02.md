# AI API browser CORS spike — outcome (2026-04-02)

**Story:** 1.1 (`1-1-browser-cors-spike`) · **FR-10**

This document records the checklist outcome from [`ai-api-browser-cors-spike-checklist.md`](./ai-api-browser-cors-spike-checklist.md). No API keys appear below.

---

## Preconditions (minimal request)

| Item | Value |
| --- | --- |
| **Provider** | Atlas Cloud |
| **API base URL (tested)** | `https://api.atlascloud.ai` — probe used **`GET /v1/models`** (OpenAI-compatible surface per [Atlas docs](https://www.atlascloud.ai/docs/get-started)). |
| **Media / queue API prefix** | `https://api.atlascloud.ai/api/v1` (for image/video jobs; spike focused on CORS behavior on the shared API host). |
| **Smallest call** | Unauthenticated **`GET /v1/models`** from a cross-origin browser context (equivalent to opening DevTools on the app and running `fetch` with `Origin: http://localhost:5173`). |

---

## App origins exercised

| # | App origin | How |
| --- | --- | --- |
| A | `http://localhost:5173` (typical) / **`http://localhost:5174`** (this run) | Vite dev server; **Chromium** loaded the SPA, then executed in-page **`fetch('https://api.atlascloud.ai/v1/models')`** (see **Browser verification**). *This run used port 5174 because 5173 was already bound; Atlas allows both origins (dynamic `Access-Control-Allow-Origin`).* Supplementary **curl** probes below match preflight/GET headers. |
| B | `http://localhost:4173` | Not started in this run; **Origin header** `http://localhost:4173` included in separate `curl` preflight probe to match `pnpm preview` default port. |
| C | Deployed HTTPS host | **Not run** — re-run this checklist row when the production/staging domain is fixed; Atlas uses **dynamic** `Access-Control-Allow-Origin` (see evidence), so the deployed origin must be validated once known. |

---

## Browser verification (Chromium — post-review)

**AC1:** Cross-origin request from a **real browser** context (not Node alone).

| Step | Result |
| --- | --- |
| Page origin | `http://localhost:5174/` (Vite dev; SPA loaded) |
| API call | In page context: `fetch('https://api.atlascloud.ai/v1/models')` (same as pasting into **DevTools Console** on that tab) |
| Response | **`HTTP 200`**, `ok: true`, `content-type: application/json`, JSON body with model list (snippet starts with `{\"code\":200,\"msg\":\"succeed\"...`) |
| CORS | Request **succeeded** in Chromium with readable JSON — i.e. **not** blocked by CORS for this origin/path. |

**How reproduced:** Playwright `chromium.launch()` → `page.goto(appOrigin)` → `page.evaluate(() => fetch(...))`. Requires `npx playwright install chromium` once if browsers are missing.

**DevTools parity:** On `http://localhost:5173` (or your Vite port), open **Console** and run:

```js
fetch('https://api.atlascloud.ai/v1/models').then(r => r.json()).then(console.log)
```

Expect **no** CORS error in the console; Network should show the request with **200**.

---

## Checklist sections 1–5 (mapping)

| Checklist section | How satisfied in this spike |
| --- | --- |
| 1. Page setup | App tab at Vite origin (5174 this run); DevTools-equivalent via scripted `fetch` in page context. |
| 2. Cross-origin request | **`fetch`** to Atlas **`GET /v1/models`** from that origin — **Browser verification** table. |
| 3. Failure mode | Not applicable — **200** and JSON (direct OK). |
| 4. Credentialed requests | Not exercised (no `credentials: 'include'`); follow-up if product uses cookies. |
| 5. Mixed content | App **HTTP** → API **HTTPS** (allowed); production SPA **HTTPS** → API **HTTPS** still to confirm on row C. |

---

## Evidence summary (supplementary `curl`)

Probes used **`curl`** with `Origin` and (for OPTIONS) `Access-Control-Request-*` headers so the **response headers** can be compared to **Network** for preflight and a simple GET. **Primary AC1 evidence is the Browser verification section above.** This does **not** replace reading Network for a full authenticated POST/I2V job, which should still be checked with a **restricted key** before M1 ship.

### Preflight `OPTIONS` → `/v1/models`

- **Origin:** `http://localhost:5173`
- **Result:** `HTTP/2 200` with `access-control-allow-origin: http://localhost:5173`, `access-control-allow-methods: GET, PUT, POST, DELETE, PATCH, OPTIONS, ...`, `access-control-allow-headers: authorization, content-type` (requested), `access-control-allow-credentials: true`.

### Simple `GET` → `/v1/models`

- **Origin:** `http://localhost:5173`
- **Result:** `HTTP/2 200` with JSON body; CORS headers include `access-control-allow-origin: http://localhost:5173`, `access-control-allow-credentials: true`.

### Preflight with preview origin

- **Origin:** `http://localhost:4173`
- **Result:** `access-control-allow-origin: http://localhost:4173` (dynamic allowlist behavior).

---

## Checklist outcome template (paste-ready)

```text
Provider: Atlas Cloud
API base URL tested: https://api.atlascloud.ai (GET /v1/models; media/queue under /api/v1 per docs)
App origin(s) tested: http://localhost:5174 (Chromium fetch + dev app; use 5173 when free); http://localhost:4173 (curl probe for preview port)

Result: Direct browser OK (CORS headers allow localhost dev/preview origins for tested paths)

Browser console / Network summary:
- Chromium in-page fetch: GET /v1/models — 200, JSON body (see Browser verification)
- Preflight OPTIONS (curl): passed (200; ACAO matches requesting Origin)
- Simple GET (curl): 200; ACAO present for localhost:5173

Decision: Ship direct fetch from the SPA for Atlas HTTPS endpoints on tested origins; re-validate for the final deployed HTTPS origin; use a same-origin relay only if a future path or provider policy blocks the production origin.

Date / tester: 2026-04-02 — Nandi; Chromium fetch + curl probes (automated agent)
```

---

## Follow-ups

1. Before first **authenticated job POST** (queue/I2V), repeat the checklist **in DevTools** on the real app with a **test/restricted** key; confirm no CORS regression on `POST` + custom headers.
2. When the **production** site URL is known, add row C with that HTTPS origin (or confirm Atlas still echoes it in `Access-Control-Allow-Origin`).

---

## Related links

- Checklist: [`ai-api-browser-cors-spike-checklist.md`](./ai-api-browser-cors-spike-checklist.md)
- Architecture (CORS spike row): [`architecture.md`](../_bmad-output/planning-artifacts/architecture.md)
