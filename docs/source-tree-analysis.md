# Source Tree Analysis

Annotated layout for the **bolt-orbitdb-blog** repository (monolith).

```
bolt-orbitdb-blog/
├── index.html                 # HTML shell for Vite SPA
├── package.json               # Scripts: dev, build, build:lib, test, test:e2e, relay*
├── vite.config.ts             # App + lib modes; PWA; manual chunks; polyfills
├── tsconfig.json              # NodeNext, paths $lib/*
├── playwright.config.ts       # E2E: workers 1, webServer, relay env
├── .mocharc.cjs               # Mocha + ts-node
├── README.md                  # Product summary, IPNS links, dev commands
├── docs/                      # Project knowledge (this index + guides)
├── test/                      # Mocha tests (*.test.js / .ts)
├── tests/                     # Playwright E2E + global setup/teardown
├── src/
│   ├── main.ts                # Entry: CSS, i18n, mount(App)
│   ├── App.svelte             # Root layout
│   ├── app.css                # Global styles (Tailwind)
│   ├── vite-env.d.ts
│   └── lib/                   # All application + library code
│       ├── index.ts           # Public package exports (lib build)
│       ├── components/        # Svelte UI (see component-inventory.md)
│       ├── services/          # Markdown renderer, translation, import resolver
│       ├── utils/             # logger, PWA eject, media, buildInfo
│       ├── i18n/              # svelte-i18n setup
│       ├── config.ts          # libp2p / Helia options, env-driven
│       ├── peerConnections.ts # Peer dial / connection helpers
│       ├── dbUtils.ts         # OrbitDB ops, replication, remote DB helpers
│       ├── store.ts           # Svelte stores (global client state)
│       ├── types.ts           # Post, Comment, Media, RemoteDB, Helia, OrbitDB…
│       ├── orbitdb.ts         # Identity helpers from seed
│       ├── getIdendityAndCreateOrbitDB.ts  # OrbitDB factory (filename as in repo)
│       ├── identityProvider.ts
│       ├── cryptoUtils.ts
│       ├── router.ts
│       └── shims/
│           └── protobufjs-inquire.ts   # Vite alias for browser bundle
├── public/                    # Static assets for PWA / app
└── (generated) dist/          # Build output — not source
```

## Entry points

| Role | Path |
| --- | --- |
| Browser bootstrap | `src/main.ts` |
| UI root | `src/App.svelte` |
| Blog + P2P orchestration | `src/lib/components/LeSpaceBlog.svelte` |
| Library package entry | `src/lib/index.ts` |

## Critical directories

| Path | Purpose |
| --- | --- |
| `src/lib/components/` | Feature UI: blog, posts, peers, DB manager, settings, media |
| `src/lib/` (non-components) | Networking, DB, crypto, stores, types |
| `test/` | Node/Mocha OrbitDB and libp2p tests |
| `tests/` | Playwright specs and relay lifecycle |

## Integration points

Single runtime; integration is **outward** to **other libp2p peers** and **relay** processes, not to a separate repo part.

Last updated: 2026-04-02
