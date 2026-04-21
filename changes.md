# Changes

## 2026-04-19 to 2026-04-21

### Orbit Blog app

- Added relay sync LEDs for all five blog databases in the DB manager:
  - `settingsDB`
  - `postsDB`
  - `commentsDB`
  - `mediaDB`
  - `aiDB`
- Extended relay DB polling so each LED can show replication state and last replication time in the tooltip.
- Fixed relay status regression where a DB that had already been confirmed on the relay could fall back to a yellow "waiting for first replication" state after a transient miss.
- Added/updated relay status and sharing test coverage around:
  - relay freshness checks for shared blog setup
  - direct peer connection detection from live libp2p connection state instead of sidebar text
  - relay seeding/test bootstrap behavior
- Added a shared page-load helper so sharing tests no longer fail just because the loading overlay never became visibly mounted before it disappeared.
- Updated Playwright server reuse behavior to avoid silently attaching to an unrelated dev server on port `5173`.
- Updated the browser libp2p config to align more closely with the working `de2do` setup:
  - restored browser-side `dcutr()`
  - enabled `autoNAT()`
  - added Twilio STUN alongside Google STUN
  - lowered pubsub peer discovery interval
- Adjusted peer dialing so relay-only connections still trigger follow-up dials using discovered multiaddrs or peer IDs.
- Added shared peer transport labeling in `src/lib/peerTransport.ts` and aligned peer UI transport labels so relay-mediated paths are not mislabeled as plain WebSocket connections.
- Removed WebRTC debug UI controls and the unused tester component:
  - removed buttons from connected peers UI
  - removed related modal/state wiring
  - deleted `src/lib/components/WebRTCTester.svelte`
- Updated CI workflow usage toward the pnpm-based dependency graph to avoid npm/pnpm drift during test runs.
- Standardized local Playwright runs back onto the npm-installed `orbitdb-relay-pinner` package instead of preferring a local checkout.
- Improved sidebar affordances:
  - added tiny icons to the DB manager, peers, and settings section toggles
  - added visible close buttons on the opened DB manager, peers, and settings panels

### Local relay checkout

These changes were made in the real local repository at `/Users/nandi/orbitdb-relay-pinner`, not only in chat:

- `src/services/database.ts`
- `src/services/orbitdb-replication-service.ts`

Summary of local relay changes:

- Added on-demand OrbitDB heads handling for already-known replicated DBs.
- Added a known-database registry in memory so the relay can recognize previously replicated OrbitDB addresses even after closing the DB again.
- When a known `/orbitdb/heads/...` protocol is requested, the relay now:
  - parses the DB address from the protocol
  - keeps or re-dials the requesting peer
  - opens the DB on demand
  - waits for the real heads handler to register
  - delegates the request to that handler
  - closes the DB again afterward
- Seeded known child DB addresses earlier from open DB contents so settings-linked DBs can be recognized sooner.
- Kept the existing "close DBs immediately after sync" behavior intact, per the requested constraint.

### Current investigation status

- Relay-assisted blog sharing and relay replication are working more reliably than before.
- `BlogSharing.spec.ts` is currently passing again in the app repo with the adjusted browser config and test expectations.
- Direct browser-to-browser WebRTC behavior still needs continued observation in real environments, but the repo no longer depends on the old sidebar-text assertion.
