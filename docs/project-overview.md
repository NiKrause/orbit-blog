# Project Overview

**Name:** Le Space Blog (package `le-space-blog`, repository **bolt-orbitdb-blog**)  
**Purpose:** Local-first, peer-to-peer blogging in the browser using OrbitDB, libp2p, and IPFS (Helia).  
**Status:** Alpha/experimental; not security audited (see root `README.md`).

## Executive summary

The application is a **single-page app** built with **Svelte 5** and **Vite**. There is **no backend server** in this repository: data moves between browsers via **libp2p**, and structured blog data lives in **OrbitDB** databases on top of **Helia**. The same codebase builds a **PWA** and an optional **library** export (`vite build --mode lib`) for embedding UI primitives.

## Repository structure

| Aspect | Value |
| --- | --- |
| **Type** | Monolith (one deployable SPA + optional lib) |
| **Primary language** | TypeScript |
| **UI framework** | Svelte 5 |
| **Build tool** | Vite 5 |
| **Data / networking** | Helia, libp2p, @orbitdb/core |

## Documentation map

| Document | Use |
| --- | --- |
| [index.md](./index.md) | Master index for AI and humans |
| [architecture.md](./architecture.md) | System structure and data flow |
| [source-tree-analysis.md](./source-tree-analysis.md) | Directory layout and entry points |
| [data-models.md](./data-models.md) | OrbitDB usage and TypeScript domain types |
| [api-contracts.md](./api-contracts.md) | No REST API; P2P and app boundaries |
| [component-inventory.md](./component-inventory.md) | Svelte components |
| [development-guide.md](./development-guide.md) | Install, run, test, debug |
| [deployment-guide.md](./deployment-guide.md) | PWA, IPFS publish, CI |
| [AI_AGENTS.md](./AI_AGENTS.md) | Detailed feature-to-file map (maintain alongside this set) |

## Quick reference

- **App entry:** `index.html` → `src/main.ts` → `src/App.svelte`
- **P2P / DB bootstrap:** `src/lib/components/LeSpaceBlog.svelte`, `src/lib/config.ts`, `src/lib/peerConnections.ts`
- **Global client state:** `src/lib/store.ts`
- **Tests:** Mocha (`test/`), Playwright (`tests/`)

Last updated: 2026-04-02
