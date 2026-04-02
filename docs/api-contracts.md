# API Contracts — Le Space Blog

## Important: no HTTP application API

This repository **does not** expose a first-party **REST**, **GraphQL**, or **RPC HTTP** API for the blog. The Vite dev server and static hosting only serve **static assets** and the SPA.

Documented below are the **runtime boundaries** that replace a traditional API.

## Client environment (`import.meta.env`)

Vite exposes **`VITE_*`** variables to the client. Notable families (see `src/lib/config.ts`):

| Variable pattern | Purpose |
| --- | --- |
| `VITE_SEED_NODES` / `VITE_SEED_NODES_DEV` | Bootstrap multiaddrs for libp2p |
| `VITE_P2P_PUPSUB` / `VITE_P2P_PUPSUB_DEV` | Pubsub peer-discovery topics |
| `VITE_MODE` | Environment mode switches |

Tests and CI override these (see `playwright.config.ts`, `.github/workflows/test.yml`).

## libp2p / network surface

| Concern | Where implemented |
| --- | --- |
| Transport stack, discovery, pubsub | `src/lib/config.ts`, `src/lib/peerConnections.ts` |
| Dial / peers | libp2p APIs via Helia (`connect`, `getPeers`, events) |
| Replication | OrbitDB over Helia; topics under `/orbitdb/...` (see `AI_AGENTS.md`) |

There is **no OpenAPI** document; protocol behavior is **OrbitDB + libp2p** as configured in code.

## Optional external APIs

- **OpenAI (or compatible):** Used for optional translation features; API key stored in localStorage via stores (`store.ts`). Not a deployed server in this repo.

## Relay / pinner CLI

The **`orbitdb-relay-pinner`** package is invoked via npm scripts (`relay`, `relay:test`, etc.). It is a **separate process**, not imported HTTP API surface — configuration via env and CLI as per that package.

---

For **endpoint-style navigation** of the codebase (which file opens which DB), use **[AI_AGENTS.md](./AI_AGENTS.md)**.

Last updated: 2026-04-02
