# AI API browser CORS spike checklist

Use this before building **AI Manager** HTTP calls so you validate **real browser** behavior, not only **Node.js** scripts. Servers that work from `curl` or a small Node `fetch` script can still **fail in the browser** because browsers enforce **CORS**, **mixed content**, and stricter rules for credentialed requests.

---

## Why this spike exists

| Environment | CORS |
| --- | --- |
| **Node.js** (`node`, tests, scripts) | No CORS—any HTTPS URL is allowed unless the library adds restrictions. |
| **Browser** (app from `http://localhost:5173`, `https://your.domain`, etc.) | **Cross-origin** requests to the AI API’s origin require the API (or a proxy) to send the right **`Access-Control-*`** headers. Missing headers ⇒ blocked requests even with a valid API key. |

**Goal:** Decide whether the app can call the provider **directly** from the user’s browser, or whether you need a **same-origin relay** (worker, backend, dev proxy).

---

## Preconditions

- [ ] **Exact API base URL** documented (e.g. Atlas Cloud API host you will use in production, including path prefix if any).
- [ ] **Test API key** available (use a **restricted** or test key; rotate after spike if it was exposed in DevTools screenshots).
- [ ] **Minimal request** identified from vendor docs (e.g. health, models list, or smallest allowed POST)—you are proving **connectivity**, not full I2V in one go.

---

## Test matrix (run in a real browser)

Repeat the same checks for each row; CORS can differ by **page origin**.

| # | App origin | How to run |
| --- | --- | --- |
| A | **Local dev** | `pnpm dev` → open `http://localhost:5173` (or your Vite port). |
| B | **Production-like static** | `pnpm build && pnpm preview` (or serve `dist/` from another host/port). |
| C | **Deployed host** (optional but recommended) | Same app behind **HTTPS** on the domain you ship (CORS and cookies differ from localhost). |

---

## Checklist (browser-only)

Do **not** rely on Node for the final verdict; use DevTools **Network** on the app tab.

### 1. Page setup

- [ ] Open **your app** (not `about:blank`) so the **origin** matches how users run the blog (see matrix above).
- [ ] Open **DevTools → Network**; preserve log; disable cache while testing.

### 2. Cross-origin request

From the **browser console** on that page (so the **request initiator origin** is your app), run a minimal test:

- Prefer **`fetch`** to the real API path you will use, with the same **method**, **headers** (e.g. `Authorization`, `Content-Type`), and **body shape** you expect in production.
- If the docs require **only** a GET (e.g. list models), use that first—smallest surface area.

**Record:**

- HTTP **status** (or `(failed)` / **CORS error** in console).
- Whether a **preflight** `OPTIONS` appears (for non-simple methods or custom headers).

### 3. Read the failure mode

- [ ] If you see **“blocked by CORS policy”** / **No `Access-Control-Allow-Origin`** in the console: **direct browser → API is not allowed** with current API headers unless the provider changes configuration.
- [ ] If you get **401/403** but **no** CORS error: CORS likely allows the response; fix **auth** or **key** next.
- [ ] If you get **200** and JSON: **direct browser calls are viable** for that origin (still confirm full I2V flow later).

### 4. Credentialed requests (if you use cookies or `credentials: 'include'`)

- [ ] If production code will use **`fetch(..., { credentials: 'include' })`**, repeat the test with that flag. The API must expose **`Access-Control-Allow-Credentials: true`** and a **non-`*`** origin—many APIs use **API keys in headers** instead; match what you will ship.

### 5. Mixed content

- [ ] If the app is served over **`https://`**, the API must be **`https://`** as well, or the browser may block **mixed active content**.

---

## What does *not* count as “done”

- [ ] A passing **`curl`** or **Node script** alone (no CORS).
- [ ] Success only from **Postman** or **Insomnia** (same as Node regarding CORS).

---

## Outcome template (paste into a ticket or ADR)

```text
Provider:
API base URL tested:
App origin(s) tested: (e.g. http://localhost:5173, https://…)

Result: [ Direct browser OK | CORS blocked | Auth error | Mixed content | Other ]

Browser console / Network summary:
- Preflight OPTIONS: [ passed | failed | not sent ]
- Actual request: [ status | blocked ]

Decision: [ Ship direct fetch | Add same-origin relay | Use dev-only proxy + relay in prod ]

Date / tester:
```

---

## If CORS blocks direct access

Options (product/architecture, not this checklist):

- **Same-origin relay:** small **HTTPS** endpoint the SPA calls (`/api/ai/...`) that forwards to the vendor with the key on the server side.
- **Vendor-approved browser pattern:** some providers document official **CORS** or **JS SDK** support—re-read their docs.

---

## Related project docs

- Architecture: `_bmad-output/planning-artifacts/architecture.md` (HTTP transport, separation of **translation** `aiApiKey` / `aiApiUrl` vs **AI Manager** credentials).

---

_Last updated: 2026-04-02_
