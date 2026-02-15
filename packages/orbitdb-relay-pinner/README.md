# orbitdb-relay-pinner

OrbitDB relay + pinning/sync service used by our apps and tests.

## CLI

Build:

```bash
npm --prefix packages/orbitdb-relay-pinner run build
```

Run:

```bash
node packages/orbitdb-relay-pinner/dist/cli.js
```

Test mode (deterministic peer id via `TEST_PRIVATE_KEY`):

```bash
node packages/orbitdb-relay-pinner/dist/cli.js --test
```

## Why This Exists

- The relay must be able to verify OrbitDB entries created by `did:key` identities.
- This package registers `@orbitdb/identity-provider-did` with a `key-did-resolver` resolver before opening OrbitDB.

## Environment Variables (common)

- `RELAY_TCP_PORT`, `RELAY_WS_PORT`, `RELAY_WEBRTC_PORT`
- `RELAY_DISABLE_WEBRTC=true` to disable UDP `/webrtc-direct` listener in constrained environments
- `METRICS_PORT=0` to bind metrics on an ephemeral port (avoid `EADDRINUSE`)
- `TEST_PRIVATE_KEY` for `--test` runs

