# Project Documentation Index

**Master entry point** for AI-assisted and human navigation of **bolt-orbitdb-blog** (Le Space Blog).

---

## Project overview

| | |
| --- | --- |
| **Type** | Monolith — single SPA (+ optional library build) |
| **Primary language** | TypeScript |
| **Architecture** | Local-first P2P app: Svelte 5 + Vite + Helia + libp2p + OrbitDB in the browser |

### Quick reference

- **Tech stack:** Svelte 5, Vite 5, Helia, libp2p, @orbitdb/core, Tailwind, Playwright, Mocha
- **Entry point:** `src/main.ts` → `src/App.svelte` → `src/lib/components/LeSpaceBlog.svelte`
- **Global state:** `src/lib/store.ts`
- **P2P / DB config:** `src/lib/config.ts`, `src/lib/peerConnections.ts`, `src/lib/dbUtils.ts`

---

## Generated documentation (BMad Document Project)

| Document | Description |
| --- | --- |
| [Project overview](./project-overview.md) | Purpose, summary, doc map |
| [Architecture](./architecture.md) | Layers, data flow, testing |
| [Source tree analysis](./source-tree-analysis.md) | Annotated directory layout |
| [Data models](./data-models.md) | OrbitDB usage and TypeScript types |
| [API contracts](./api-contracts.md) | No REST API; env vars and P2P boundaries |
| [Component inventory](./component-inventory.md) | Svelte components by area |
| [Development guide](./development-guide.md) | Install, run, test, debug |
| [Deployment guide](./deployment-guide.md) | Static/PWA, IPFS, CI |

**State file:** [project-scan-report.json](./project-scan-report.json) (scan metadata, completed steps).

---

## Existing documentation (feature & product)

| Document | Description |
| --- | --- |
| [AI Agents — codebase map](./AI_AGENTS.md) | **Primary** file-level map for libp2p, OrbitDB, replication |
| [Markdown guide](./MARKDOWN_GUIDE.md) | Markdown features in the blog |
| [Remote Markdown import](./REMOTE_MARKDOWN_IMPORT.md) | Remote import behavior |
| [Language fallback](./LANGUAGE_FALLBACK.md) | i18n fallback rules |
| [Video embedding examples](./VIDEO_EMBEDDING_EXAMPLES.md) | Media embedding |
| [Issues / notes](./ISSUES.md) | Tracked issues and references |
| [Pitch deck](./pitchdeck.md) | Product pitch material |

---

## Related project context

- **`_bmad-output/project-context.md`** — AI implementation rules (stack, tests, don’t-miss items)

---

## Getting started

1. Read [project-overview.md](./project-overview.md) or [architecture.md](./architecture.md).
2. For implementation tasks, open [AI_AGENTS.md](./AI_AGENTS.md) and `_bmad-output/project-context.md`.
3. Run the app per [development-guide.md](./development-guide.md).

---

_Index generated: 2026-04-02. Scan: initial, **deep**._
