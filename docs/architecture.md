# Architecture — Le Space Blog

## Executive summary

The app runs entirely in the **browser**: a **Helia** IPFS node and a **libp2p** host power replication; **OrbitDB** stores blog settings, posts, comments, media metadata, and remote-blog subscriptions as separate **document** databases. UI is **Svelte 5** with **writable/derived stores** (`src/lib/store.ts`) reflecting OrbitDB and connection state.

## Technology stack

| Layer | Technologies |
| --- | --- |
| UI | Svelte 5, Tailwind CSS, svelte-i18n |
| Build | Vite 5, PWA (vite-plugin-pwa), node polyfills for browser |
| P2P | libp2p (WebTransport, WebSockets, WebRTC, circuit relay), Noise, Yamux, Gossipsub |
| Storage | Helia, blockstore/datastore (Level-backed in Node tests) |
| CRDT / DB | @orbitdb/core document stores |
| Content | marked, dompurify, mermaid; optional OpenAI for translation |

## Architectural pattern

**Client-only local-first app:** no first-party HTTP API. “Backend” behavior is **peer replication** and **OrbitDB sync** over libp2p. Optional **relay/pinner** processes (`orbitdb-relay-pinner`, npm scripts) support connectivity and tests.

## Data architecture

- **Identity:** Derived from seed phrase → deterministic keys; OrbitDB identity providers (DID / ed25519; optional Ethereum path in codebase).
- **Databases (OrbitDB documents):** Settings (pointers + blog meta), posts, comments, media, remote subscription list — see [data-models.md](./data-models.md).
- **IPFS:** Media blobs addressed by CID; metadata in media DB.

## “API” and integration surface

There is **no REST or GraphQL server** in-repo. External integration is:

- **libp2p:** dial, pubsub, replication — see [api-contracts.md](./api-contracts.md).
- **Environment:** `VITE_*` variables for seed nodes and discovery topics (`src/lib/config.ts`).

## Component overview

Major shell: **`LeSpaceBlog.svelte`** orchestrates Helia/OrbitDB lifecycle. Feature areas map to components in `src/lib/components/` (posts, DB manager, peers, settings, media, i18n) — see [component-inventory.md](./component-inventory.md).

## Source tree

See [source-tree-analysis.md](./source-tree-analysis.md).

## Development workflow

See [development-guide.md](./development-guide.md).

## Deployment

Static build + PWA; optional IPFS/IPNS distribution — see [deployment-guide.md](./deployment-guide.md).

## Testing strategy

- **Mocha** + ts-node: libp2p/OrbitDB integration tests (`test/`), often with local relay.
- **Playwright:** E2E against Vite dev server + relay (`tests/`, `playwright.config.ts`); single worker, shared disk state.

## State management

**Svelte stores** (`store.ts`) hold: Helia/libp2p/OrbitDB references, post/comment/media lists, blog settings, remote DB list, UI toggles, i18n-related settings, optional AI API key fields. Persistence is **OrbitDB + IPFS/local storage** where applicable, not a centralized server.

Last updated: 2026-04-02
