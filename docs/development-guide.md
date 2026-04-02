# Development Guide

## Prerequisites

- **Node.js** — CI uses **22** (see `.github/workflows/test.yml`). LTS/newer is fine locally.
- **pnpm** — `package.json` declares `packageManager: pnpm@10.x`; npm/yarn may work but lockfiles differ.
- **Browsers** — Chromium for Playwright E2E (`npx playwright install`).

## Install

```bash
pnpm install
```

(README still shows `npm i`; prefer pnpm for consistency with the workspace.)

## Run the app

```bash
pnpm dev
```

Default Vite dev server (see `playwright.config.ts` for E2E port **5173**).

## Environment

- Copy or follow `.env` patterns if present; client vars must be prefixed **`VITE_`**.
- For **debug logging**, see root `README.md` (`localStorage` debug keys, `LOG_LEVEL`).

## Build

| Command | Output |
| --- | --- |
| `pnpm run build` | Production SPA in `dist/` |
| `pnpm run build:lib` | Library bundle from `src/lib/index.ts` |

## Quality checks

```bash
pnpm check    # svelte-check + TypeScript
```

## Tests

| Command | Scope |
| --- | --- |
| `pnpm test` | Mocha — `test/orbitdb*.test.js` per package script |
| `pnpm run test:watch` | Mocha watch |
| `pnpm run test:e2e` | Playwright (`tests/`) |

**Relay:** Many tests expect a **local relay**. Use `pnpm run relay:test` in another terminal, or follow CI: start relay before Mocha/E2E (see `test.yml` and `tests/global-setup.ts`).

**Playwright:** Single worker; do not run multiple E2E jobs against the same `./orbitdb` folder without isolation.

## PWA in development

Service worker is gated (`PWA_DEV` in `vite.config.ts`); normal dev avoids SW interference unless enabled.

## Useful references

- **[AI_AGENTS.md](./AI_AGENTS.md)** — where features live in code
- **[architecture.md](./architecture.md)** — system picture

Last updated: 2026-04-02
