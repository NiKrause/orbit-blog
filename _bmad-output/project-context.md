---
project_name: bolt-orbitdb-blog
user_name: Nandi
date: '2026-04-02'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - quality_rules
  - workflow_rules
  - anti_patterns
status: complete
rule_count: 42
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss. For a **feature-to-file map** (OrbitDB, libp2p, relay), prefer [`docs/AI_AGENTS.md`](../docs/AI_AGENTS.md) as the deep reference._

---

## Technology Stack & Versions

| Area | Stack |
| --- | --- |
| **Runtime / language** | TypeScript **5.8** (`module`/`moduleResolution`: **NodeNext**), `ES2020`, `"type": "module"` |
| **UI** | **Svelte 5.28** (`mount` API), **Vite 5.4**, **Tailwind CSS 3.4** (+ `@tailwindcss/typography`, `@tailwindcss/forms`) |
| **P2P / data** | **Helia 5.3**, **libp2p 2.9**, **@orbitdb/core 3.0**, **IPFS/OrbitDB** in-browser; relay via **`orbitdb-relay-pinner`** (see `package.json` scripts) |
| **Crypto / identity** | BIP-39/BIP-32 style flows, **DID/ed25519** identity helpers (`identityProvider.ts`, `orbitdb.ts`) |
| **Content** | **marked**, **dompurify**, **mermaid**; i18n: **svelte-i18n** |
| **Package manager** | **pnpm** (see `packageManager` in root `package.json`) |

**Dual build:** `vite build` = app; `vite build --mode lib` = **library** bundle from `src/lib/index.ts` (different externals and Rollup config). Do not assume app-only behavior when editing `vite.config.ts`.

---

## Critical Implementation Rules

### Language-Specific Rules

- **Imports in `src/`:** Use **NodeNext** style: relative imports end with **`.js`** even in `.ts` / `.svelte` files (e.g. `from './utils.js'`). Vite/TS resolve to the TS sources.
- **`tsconfig`:** `strict` is **false** — do not assume strict null checks project-wide; still avoid obvious `any` and validate boundaries in new code.
- **Path aliases:** Use **`$lib/*`** → `src/lib/*` (see `tsconfig` `paths`). Keep `vite.config.ts` `resolve.alias` in sync if adding aliases.
- **Environment variables:** Browser code must use **`VITE_*`** only; document new vars in config usage (see `src/lib/config.ts`).

### Framework-Specific Rules

- **Svelte 5:** Use **`mount`** from `svelte` (see `main.ts`), not legacy `new App({ target })` patterns.
- **Structure:** Reusable UI lives under **`src/lib/components/`**; shared logic under **`src/lib/`** (`services/`, `utils/`, etc.). App shell: `App.svelte`, `main.ts`.
- **Library exports:** Public API is **`src/lib/index.ts`** — export new components/modules there when they are part of the **le-space-blog** package surface.
- **PWA / Workbox (`vite.config.ts`):** Do **not** route **OrbitDB / IPFS** traffic through aggressive static caching — `globIgnores` and `runtimeCaching` explicitly exclude **`/orbitdb/`**, **`/ipfs/`** patterns. Preserve that when changing PWA config.
- **Vite shims:** **`src/shims/protobufjs-inquire.ts`** exists to avoid problematic `eval` in browser bundles; non-lib builds alias `@protobufjs/inquire` here — do not remove without validating the bundle.

### Testing Rules

- **Unit / integration (Node):** **Mocha** + **ts-node** (`.mocharc.cjs`), specs under **`test/`** (`test/orbitdb*.test.js` per npm `test` script). Timeout **30s** default.
- **E2E:** **Playwright** (`tests/`, `playwright.config.ts`). **`workers: 1`**, **`fullyParallel: false`** — shared on-disk state (`./orbitdb`) requires **serial** runs; do not raise workers without addressing isolation.
- **E2E env:** WebServer uses **`--mode test`** and **`.env.test`**; relay ports and **`VITE_SEED_*`** must stay aligned with **`tests/global-setup.ts`** / **`global-teardown.ts`** and **`playwright.config.ts`** (non-default ports **19091–19093** to avoid clashing with a local relay).
- **Base URL:** E2E assumes **`http://localhost:5173`** — keep Playwright `webServer` port and specs consistent.

### Code Quality & Style Rules

- **Typecheck:** Run **`pnpm check`** (`svelte-check` + TS) before treating work as done.
- **No ESLint** in repo — rely on **TypeScript**, **Svelte** conventions, and review; match existing file naming (**PascalCase** Svelte components, **camelCase** utils).
- **Markdown / HTML:** User-facing HTML goes through **dompurify** where the app already sanitizes; follow existing patterns in components before adding rich content.
- **i18n:** Strings use **svelte-i18n** — follow `lib/i18n/` and existing translation keys; avoid hardcoding user-visible English in new UI without locale keys.

### Development Workflow Rules

- Prefer **`pnpm`** for install/scripts to match lockfile and workspace expectations.
- **Relay debugging:** `package.json` has **`DEBUG=...`** variants for **`orbitdb-relay-pinner`** — use documented scripts instead of ad-hoc flags when possible.
- **Lib publish path:** **`build:lib`** produces **`dist/`** for the package exports in `package.json` — changing entry or externals affects consumers of **`le-space-blog`**.

### Critical Don't-Miss Rules

- **Secrets:** Seed phrases and keys are **high sensitivity** — never log them, commit them, or paste them into tests/fixtures.
- **libp2p / OrbitDB:** Connection stack is easy to break when copying snippets — **Noise** (`connectionEncrypters`), **yamux**, transports, and **bootstrap/pubsub** topics must stay coherent with `config.ts` and `peerConnections.ts` (see `docs/AI_AGENTS.md`).
- **Typos in API names:** **`getIdendityAndCreateOrbitDB.ts`** is the actual filename/export — do not “fix” the spelling without a coordinated rename across imports and consumers.
- **PWA in dev:** Service worker is **`PWA_DEV === 'true'`** only — default dev avoids SW/cache interference; remember when debugging offline behavior.
- **Large deps:** Manual chunks in Vite target **p2p**, **mermaid**, **katex**, etc. — avoid importing heavy modules into hot paths without checking bundle splits.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing code; use **`docs/AI_AGENTS.md`** for “where is X implemented?” navigation.
- Follow **all** rules above; when in doubt, prefer the more restrictive option for **crypto**, **P2P**, and **caching**.
- Update this file if you introduce new **cross-cutting** conventions (aliases, env vars, test layout).

**For Humans:**

- Keep this document **lean** — feature maps belong in **`docs/AI_AGENTS.md`**, not duplicated here.
- Refresh when **major** dependency or Vite/OrbitDB behavior changes.
- Remove rules that become obvious or stale.

Last Updated: 2026-04-02
