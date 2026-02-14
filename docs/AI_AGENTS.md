# AI Agents Guide (Codebase Feature Map)

This document maps the core features of this repo to the actual source code so an AI agent can copy/port the important parts (libp2p, Helia, OrbitDB, identity/seed phrase, replication events, relay/pinning).

## Feature Index (Jump Table)

| Feature | Primary Source | Secondary Source |
| --- | --- | --- |
| Browser networking (libp2p options, seed nodes, discovery topics) | [`src/lib/config.ts`](../src/lib/config.ts) | [`src/lib/peerConnections.ts`](../src/lib/peerConnections.ts) |
| Seed phrase generation (BIP-39) and encrypted storage | [`src/lib/components/LeSpaceBlog.svelte`](../src/lib/components/LeSpaceBlog.svelte) | [`src/lib/cryptoUtils.ts`](../src/lib/cryptoUtils.ts) |
| Deterministic libp2p private key from seed phrase | [`src/lib/components/LeSpaceBlog.svelte`](../src/lib/components/LeSpaceBlog.svelte) | [`src/lib/utils.ts`](../src/lib/utils.ts) |
| OrbitDB identity (DID/ed25519) helper | [`src/lib/identityProvider.ts`](../src/lib/identityProvider.ts) | [`src/lib/orbitdb.ts`](../src/lib/orbitdb.ts) |
| OrbitDB instance + default DBs (settings/posts/comments/media) | [`src/lib/components/LeSpaceBlog.svelte`](../src/lib/components/LeSpaceBlog.svelte) | [`src/lib/dbUtils.ts`](../src/lib/dbUtils.ts) |
| Settings DB schema (pointers to sub-DBs) | [`src/lib/components/LeSpaceBlog.svelte`](../src/lib/components/LeSpaceBlog.svelte) | [`src/lib/components/DBManager.svelte`](../src/lib/components/DBManager.svelte) |
| Replication events and reactive UI updates | [`src/lib/components/LeSpaceBlog.svelte`](../src/lib/components/LeSpaceBlog.svelte) | [`src/lib/dbUtils.ts`](../src/lib/dbUtils.ts) |
| Peer UI (transports, WebRTC detection, dial/disconnect) | [`src/lib/components/ConnectedPeers.svelte`](../src/lib/components/ConnectedPeers.svelte) | [`src/lib/components/PeersList.svelte`](../src/lib/components/PeersList.svelte) |
| Relay / pinning service (node) | [`src/relay/index.js`](../src/relay/index.js) | [`src/relay/services/storage.ts`](../src/relay/services/storage.ts) |
| Relay libp2p config (TCP/WS/WebRTC-direct, relay server, pubsub discovery) | [`src/relay/config/libp2p.ts`](../src/relay/config/libp2p.ts) | [`src/relay/events/handlers.js`](../src/relay/events/handlers.js) |
| Relay OrbitDB “sync + log pointers” service | [`src/relay/services/database.js`](../src/relay/services/database.js) | [`src/relay/utils/logger.js`](../src/relay/utils/logger.js) |
| Relay metrics server (safe to disable, port collision handling) | [`src/relay/services/metrics.js`](../src/relay/services/metrics.js) | [`src/relay/config/logging.js`](../src/relay/config/logging.js) |

## Architecture (High Level)

The app runs a **browser libp2p node** and a **Helia IPFS node** inside the UI. OrbitDB is created on top of Helia. The blog consists of multiple OrbitDB databases:

| DB | Type | Purpose | Key References |
| --- | --- | --- | --- |
| `settings` | `documents` | blog name/description/categories + pointers to sub-DBs | `postsDBAddress`, `commentsDBAddress`, `mediaDBAddress` |
| `posts` | `documents` | blog posts | per-post document |
| `comments` | `documents` | comments | per-comment document |
| `media` | `documents` | media metadata (CIDs, filenames, etc) | per-media document |
| `remote-dbs` | `documents` | local “subscription list” of remote blogs | used by DBManager queue |

Replication happens via libp2p pubsub under `/orbitdb/...` topics.

## Browser libp2p Configuration

Primary config lives in `src/lib/config.ts`.

Key behaviors:
- Uses `bootstrap()` with `VITE_SEED_NODES`/`VITE_SEED_NODES_DEV`.
- Uses `pubsubPeerDiscovery()` on topics `VITE_P2P_PUPSUB`/`VITE_P2P_PUPSUB_DEV`.
- Enables transports: WebTransport, WebSockets, WebRTC, WebRTC-direct, circuit relay transport.
- Uses Noise for libp2p connection encryption: `connectionEncrypters: [noise()]` (separate from transport-level TLS like `/wss`).

Reference snippet: `src/lib/config.ts` (listen addresses, transports, discovery)
```ts
// src/lib/config.ts:57
export const libp2pOptions: Libp2pOptions = {
  addresses: { listen: ['/p2p-circuit', '/webrtc', '/webtransport', '/wss', '/ws'] },
  transports: [
    webTransport(),
    webSockets(),
    webRTC({ rtcConfiguration: { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] } }),
    webRTCDirect(),
    circuitRelayTransport({ reservationCompletionTimeout: 20000 })
  ],
  peerDiscovery: [
    bootstrap(bootstrapConfig),
    pubsubPeerDiscovery({ interval: 10000, topics: pubSubPeerDiscoveryTopics, listenOnly: false })
  ],
  // libp2p connection encryption (commonly missed when copying configs)
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  services: {
    identify: identify(),
    identifyPush: identifyPush(),
    ping: ping(),
    dcutr: dcutr(),
    pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
    bootstrap: bootstrap(bootstrapConfig)
  }
}
```

Environment inputs: `src/lib/config.ts:16`-`55`
- `VITE_SEED_NODES`, `VITE_SEED_NODES_DEV`
- `VITE_P2P_PUPSUB`, `VITE_P2P_PUPSUB_DEV`
- `VITE_MODE`

## Browser Peer Connection Automation

When a peer is discovered, the app tries to dial it if not already connected.

Reference: `src/lib/peerConnections.ts:12`
```ts
export function setupPeerEventListeners(libp2p: Libp2p) {
  libp2p.addEventListener('peer:discovery', async (evt) => {
    const peer = evt.detail
    const connections = libp2p.getConnections(peer.id)
    if (!connections || connections.length === 0) {
      await libp2p.dial(peer.id)
    }
  })
  libp2p.addEventListener('peer:connect', () => updateConnectedPeersCount(libp2p))
  libp2p.addEventListener('peer:disconnect', () => updateConnectedPeersCount(libp2p))
}
```

## Seed Phrase + Encrypted Local Storage

Seed phrase lifecycle is managed in `src/lib/components/LeSpaceBlog.svelte`.

Behaviors:
- If no `encryptedSeedPhrase` exists in `localStorage`, a new mnemonic is generated (`bip39`).
- The user sets a password; the mnemonic is encrypted and stored to `localStorage`.
- The same seed phrase is used to derive a deterministic OrbitDB identity (writer key) so headless agents can recreate the same writer identity and write posts without driving the UI.

Reference: `src/lib/components/LeSpaceBlog.svelte:83`-`148`
```ts
let encryptedSeedPhrase = localStorage.getItem('encryptedSeedPhrase')
let showPasswordModal = $state(encryptedSeedPhrase ? true : false)

if (!encryptedSeedPhrase) {
  $seedPhrase = generateMnemonic()
  initializeApp()
}

async function handleSeedPhraseCreated(event: CustomEvent) {
  const newSeedPhrase = generateMnemonic()
  const encryptedPhrase = await encryptSeedPhrase(newSeedPhrase, event.detail.password)
  localStorage.setItem('encryptedSeedPhrase', encryptedPhrase)
  $seedPhrase = newSeedPhrase
  showPasswordModal = false
  initializeApp()
}
```

Encryption details are in `src/lib/cryptoUtils.ts`.

Reference: `src/lib/cryptoUtils.ts:35` (PBKDF2 + AES-GCM + salt+iv packaging)
```ts
export async function encryptSeedPhrase(seedPhrase: string, password: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  const key = await getKeyFromPassword(password, salt) // PBKDF2 SHA-256, 100000 iters
  const encrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(seedPhrase))
  // stored as base64(salt || iv || ciphertext)
  return btoa(String.fromCharCode(...combined))
}
```

## Deterministic libp2p Private Key From Seed Phrase

The browser libp2p node uses a deterministic ed25519 private key derived from the mnemonic master seed.

Reference: `src/lib/components/LeSpaceBlog.svelte:155`-`171`
```ts
const masterSeed = generateMasterSeed($seedPhrase, "password", false) as Buffer
const { hex } = await generateAndSerializeKey(masterSeed.subarray(0, 32))
const privKeyBuffer = uint8ArrayFromString(hex, 'hex')
const _keyPair = await privateKeyFromProtobuf(privKeyBuffer)
const _libp2p = await createLibp2p({ privateKey: _keyPair, ...libp2pOptions })
$libp2p = _libp2p
```

The seed helpers are in `src/lib/utils.ts`.

Reference: `src/lib/utils.ts:36`-`70`
```ts
export const generateMasterSeed = (mnemonicSeedphrase, password, toHex = false) => {
  return mnemonicToSeedSync(mnemonicSeedphrase, password ? password : "mnemonic")
}

export async function generateAndSerializeKey(seed: Uint8Array) {
  const keyPair = await generateKeyPairFromSeed('Ed25519', seed)
  const marshalledPrivateKey = privateKeyToProtobuf(keyPair)
  return { keyPair, hex: Buffer.from(marshalledPrivateKey).toString('hex') }
}
```

## Deterministic OrbitDB Identity (Writer) From Seed Phrase

Posts/settings/media DBs are created with single-writer access (`write: [$identity.id]`). To allow headless agents to write posts without Playwright, the app derives the OrbitDB identity deterministically from the same seed phrase.

Reference: [`src/lib/components/LeSpaceBlog.svelte`](../src/lib/components/LeSpaceBlog.svelte)
```ts
const masterSeed = generateMasterSeed($seedPhrase, "password", false) as Buffer
const identitySeed = convertTo32BitSeed(masterSeed)
const idProvider = await createIdentityProvider('ed25519', identitySeed, $helia)
$identities = idProvider.identities
$identity = idProvider.identity
```

Identity provider implementation:
- [`src/lib/identityProvider.ts`](../src/lib/identityProvider.ts) (DID/ed25519 via `key-did-provider-ed25519` + `@orbitdb/identity-provider-did`)

## Helia (IPFS) Setup

Browser Helia is created with the same libp2p instance and a Level-based datastore/blockstore.

Reference: `src/lib/components/LeSpaceBlog.svelte:80`-`82` and `:171`
```ts
let blockstore = new LevelBlockstore('./helia-blocks')
let datastore = new LevelDatastore('./helia-data')

$helia = await createHelia({ libp2p: $libp2p, datastore, blockstore }) as any
```

UnixFS is attached to Helia for reading IPFS content (used in markdown rendering and media):

Reference: `src/lib/components/LeSpaceBlog.svelte:190`-`193`
```ts
if ($helia) {
  fs = unixfs($helia as any)
}
```

## OrbitDB Setup (Browser)

OrbitDB is created with Helia + identity, and then default DBs are opened.

Reference: `src/lib/components/LeSpaceBlog.svelte:177`-`204`
```ts
$identities = await Identities({ ipfs: $helia })
$identity = await $identities.createIdentity({ id: 'me' })

$orbitdb = await createOrbitDB({
  ipfs: $helia,
  identity: $identity,
  storage: blockstore,
  directory: './orbitdb',
})
```

Default DBs are opened with `documents` type and access controllers:

Reference: `src/lib/components/LeSpaceBlog.svelte:209`-`278`
```ts
$orbitdb.open('settings', { type: 'documents', create: true, directory: './orbitdb/settings',
  identities: $identities, identity: $identity,
  AccessController: IPFSAccessController({ write: [$identity.id] })
})

$orbitdb.open('comments', { type: 'documents', create: true, directory: './orbitdb/comments',
  AccessController: IPFSAccessController({ write: ["*"] })
})
```

## Application State (Svelte Stores)

Most cross-component state is in Svelte stores.

Reference: [`src/lib/store.ts`](../src/lib/store.ts)
- `identity`, `identities`, `libp2p`, `helia`, `orbitdb`
- `settingsDB`, `postsDB`, `commentsDB`, `mediaDB`
- `postsDBAddress`, `commentsDBAddress`, `mediaDBAddress`
- `remoteDBs`, `remoteDBsDatabases` (local subscriptions)

## Settings DB Schema (Critical For Sharing)

Remote peers discover sub-databases through pointers stored in the settings DB:
- `postsDBAddress`
- `commentsDBAddress`
- `mediaDBAddress`

This is enforced in `src/lib/components/LeSpaceBlog.svelte`:

Reference: `src/lib/components/LeSpaceBlog.svelte:450`-`486`
```ts
if (postsAddr) {
  $settingsDB.put({ _id: 'postsDBAddress', value: postsAddr })
}
if (commentsAddr) {
  $settingsDB.put({ _id: 'commentsDBAddress', value: commentsAddr })
}
if (mediaAddr) {
  $settingsDB.put({ _id: 'mediaDBAddress', value: mediaAddr })
}
```

DBManager also relies on these keys to open the correct DBs for a remote blog:

Reference: `src/lib/components/DBManager.svelte:80`-`122`
```ts
const postsAddressValue = settingsData.find(content => content.key === 'postsDBAddress')?.value?.value
const commentsAddressValue = settingsData.find(content => content.key === 'commentsDBAddress')?.value?.value
const mediaAddressValue = settingsData.find(content => content.key === 'mediaDBAddress')?.value?.value
```

## Switching To A Remote Blog (Address -> Settings -> Sub-DBs)

The “share/open a blog by OrbitDB address” flow is implemented in `switchToRemoteDB()`:

Reference: [`src/lib/dbUtils.ts`](../src/lib/dbUtils.ts) (see `switchToRemoteDB` and `openOrCreateDB`)
- Opens the remote settings DB via `orbitdb.open(address)`.
- Reads settings values (`blogName`, `postsDBAddress`, `commentsDBAddress`, `mediaDBAddress`, `categories`, `profilePicture`).
- Opens the posts DB (blocking), then loads posts into the `posts` store.
- Opens comments/media DBs asynchronously (non-blocking).

Reference snippet: `src/lib/dbUtils.ts:468`
```ts
export async function switchToRemoteDB(address: string) {
  const db = await orbitdbInstance.open(address) // remote settings DB
  const dbContents = await waitForDatabaseData(db, 20000)

  const postsDBAddressValue = dbContents.find(c => c.key === 'postsDBAddress')?.value?.value
  const postsInstance = await orbitdbInstance.open(postsDBAddressValue)
  const allPosts = await postsInstance.all()
  posts.set(allPosts.map(p => p.value))
}
```

When creating a new local “blog set”, the code writes the sub-DB pointers into settings immediately:

Reference: `src/lib/dbUtils.ts:743`
```ts
await settingsDb.put({ _id: 'postsDBAddress', value: postsDb.address.toString() })
await settingsDb.put({ _id: 'commentsDBAddress', value: commentsDb.address.toString() })
await settingsDb.put({ _id: 'mediaDBAddress', value: mediaDb.address.toString() })
```

## OrbitDB Replication Events (Browser)

The UI attaches listeners to OrbitDB databases and updates Svelte stores on `update`.

Reference: `src/lib/components/LeSpaceBlog.svelte:416`-`447` (settings updates)
```ts
settingsDBUpdateListener = async (entry) => {
  if (entry?.payload?.op === 'PUT') {
    const { _id, ...rest } = entry.payload.value
    if (_id === 'blogName') $blogName = rest.value
  }
}
$settingsDB?.events.on('update', settingsDBUpdateListener)
```

Reference: `src/lib/components/LeSpaceBlog.svelte:495`-`520` (posts updates)
```ts
postsDBUpdateListener = async (entry) => {
  if (entry?.payload?.op === 'PUT') {
    $posts = [...$posts.filter(p => p._id !== entry.payload.value._id), entry.payload.value]
  }
}
$postsDB?.events.on('update', postsDBUpdateListener)
```

## Peer / Transport UI (WebRTC vs Relay)

The app surfaces connection transports by inspecting multiaddrs on active connections.

Reference: `src/lib/components/ConnectedPeers.svelte:39`-`52`
```ts
function getTransportFromMultiaddr(conn: Connection): string {
  const remoteAddr = conn.remoteAddr.toString()
  if (remoteAddr.includes('/webrtc-direct')) return 'WebRTC Direct'
  if (remoteAddr.includes('/webrtc')) return 'WebRTC'
  if (remoteAddr.includes('/p2p-circuit')) return 'Circuit'
  return 'Unknown'
}
```

## Relay / Pinning Service (Node)

Relay entry point: `src/relay/index.js`.

Key behaviors:
- Initializes persistent storage under `./orbitdb/pinning-service/...`
- Uses deterministic key in `--test` mode via `TEST_PRIVATE_KEY`.
- Starts libp2p + Helia + OrbitDB service and subscribes to OrbitDB pubsub.

Reference: `src/relay/index.js:19`-`47`
```js
const storage = await initializeStorage('./orbitdb/pinning-service')
const datastore = storage.datastore
const blockstore = storage.blockstore

if (isTestMode) {
  privateKey = privateKeyFromProtobuf(uint8ArrayFromString(TEST_PRIVATE_KEY, 'hex'))
} else {
  privateKey = storage.privateKey
}

const libp2p = await createLibp2p(createLibp2pConfig(privateKey, datastore))
const ipfs = await createHelia({ libp2p, datastore, blockstore })
```

### What The Relay Actually “Pins”

In this repo, “pinning service” means the relay runs a long-lived Helia node with a persistent LevelDB-backed datastore/blockstore. Any blocks it fetches during normal operation remain on disk under the storage directory.

Reference: `src/relay/services/storage.ts:26`-`35`
- Datastore path: `./orbitdb/pinning-service/ipfs/data`
- Blockstore path: `./orbitdb/pinning-service/ipfs/blocks`

This is enough to persist OrbitDB replication data (log/heads/entries) that the relay observes and opens via OrbitDB topics.

### Media (IPFS CID) Pinning Status

The relay currently:
- Replicates the **media metadata** database (`media` OrbitDB) the same way it replicates posts/comments (it can open it if it learns its address via `mediaDBAddress` in settings).
- Logs whether `mediaDBAddress` exists in the settings DB.

Reference: `src/relay/services/database.js:324`-`364` (settings pointer logging)

The relay does **not** currently:
- Traverse the media DB records, extract each `cid`, and proactively fetch the corresponding UnixFS blocks (true “media pinning” behavior).

Media upload and retrieval in the browser works like this:
- Upload: add bytes to IPFS via UnixFS, then store the resulting CID in the `media` OrbitDB DB.
  - Reference: `src/lib/components/MediaUploader.svelte:134`-`146`
  - `const cid = await fs.addBytes(fileBytes)`
  - `await $mediaDB.put({ ..., cid: cid.toString() })`
- View: fetch bytes via `fs.cat(cid)` (which pulls blocks into the local Helia blockstore of that peer).
  - Reference: `src/lib/components/MediaUploader.svelte:36`-`62`
  - Reference: `src/lib/components/MediaManager.svelte:45`-`65`

If you want the relay to pin media content (not just replicate metadata), you need an additional relay job that:
1. Opens the media DB address from settings (`mediaDBAddress`).
2. Reads all media records, extracts their `cid`s.
3. Fetches each CID via UnixFS (e.g. `unixfs(ipfs).cat(cid)`), so blocks are pulled into `./orbitdb/pinning-service/ipfs/blocks`.

### Relay Key Persistence

The relay stores an ed25519 private key inside its Level datastore at `/le-space/relay/private-key`.

Reference: `src/relay/services/storage.ts:8`-`24`
```ts
const key = new Key('/le-space/relay/private-key')
const bytes = await datastore.get(key)
return privateKeyFromProtobuf(bytes)
// else generate and datastore.put(key, privateKeyToProtobuf(privateKey))
```

### Relay libp2p Config

The relay listens on TCP + WS + WebRTC-direct and runs a circuit relay server.

Reference: `src/relay/config/libp2p.ts:40`-`129`
```ts
export const createLibp2pConfig = (privateKey, datastore) => ({
  privateKey,
  datastore,
  addresses: { listen: [`/ip4/0.0.0.0/tcp/${RELAY_TCP_PORT}`, `/ip4/0.0.0.0/tcp/${RELAY_WS_PORT}/ws`, `/ip4/0.0.0.0/udp/${RELAY_WEBRTC_PORT}/webrtc-direct`] },
  transports: [circuitRelayTransport(), tcp(), webRTC(), webRTCDirect(), webSockets()],
  services: {
    relay: circuitRelayServer({ reservations: { maxReservations: 1000 } }),
    pubsub: gossipsub({ allowPublishToZeroTopicPeers: true })
  }
})
```

### Relay “OrbitDB Topic -> Open DB -> Log Counts + Pointers”

The relay watches pubsub traffic and reacts when topics start with `/orbitdb/`.

Reference: `src/relay/events/handlers.js:74`-`85`
```js
const pubsubMessageHandler = (event) => {
  const msg = event.detail
  if (msg.topic && msg.topic.startsWith('/orbitdb/')) {
    syncQueue.add(() => databaseService.syncAllOrbitDBRecords(msg.topic))
  }
}
libp2p.services.pubsub.addEventListener('message', pubsubMessageHandler)
```

The core “pinning” behavior is `DatabaseService.syncAllOrbitDBRecords()` which opens the DB and inspects records.

Reference: `src/relay/services/database.js:59`-`171`
```js
db = await this.orbitdb.open(dbAddress)
const records = await db.all()
if (dbType === 'settings') {
  await this.handleSettingsDatabase(db, records)
}
```

Settings pointer verification and logging is in `handleSettingsDatabase()`:

Reference: `src/relay/services/database.js:324`-`364`
```js
const postsDBRecord = records.find(record => record.key === 'postsDBAddress')
if (postsDBRecord?.value?.value) {
  const postsDB = await this.orbitdb.open(postsDBRecord.value.value)
  const postsRecords = await postsDB.all()
  await postsDB.close()
} else {
  syncLog('postsDBAddress missing in settings DB')
}
```

If you need to confirm pointer storage, the relay logs:
- `settings keys present: [...]`
- `postsDBAddress (from settings): ...`

### Relay Metrics Server

The relay exposes `/metrics` and is designed to never crash the process on port collisions.

Reference: `src/relay/services/metrics.js:38`-`81`
```js
if (err?.code === 'EADDRINUSE' && p !== 0) {
  listen(0).then(resolve) // fallback to ephemeral port
  return
}
```

Disable metrics for headless environments:
- `METRICS_DISABLED=true`
- Or set `METRICS_PORT=0` to bind an ephemeral port.

## “Copy This” Checklist For Agents

If you are porting this system, the minimum set of moving parts that must remain consistent:

1. Deterministic identity material.
`src/lib/components/LeSpaceBlog.svelte` derives libp2p private key from mnemonic seed. If you change this derivation, peer IDs change and sharing/debugging becomes harder.

2. Settings DB pointers.
Other peers and the relay depend on `postsDBAddress`, `commentsDBAddress`, `mediaDBAddress` being present in settings. See `src/lib/components/LeSpaceBlog.svelte` and `src/relay/services/database.js`.

3. libp2p discovery alignment.
Browser and relay need to agree on seed nodes and pubsub discovery topics (`VITE_SEED_NODES*`, `VITE_P2P_PUPSUB*`).

4. Replication event wiring.
If you want reactive UI, you must keep the `db.events.on('update', ...)` patterns (settings + posts at minimum).

## Related Docs

- Markdown extensions: [`docs/MARKDOWN_GUIDE.md`](./MARKDOWN_GUIDE.md)
- Remote imports: [`docs/REMOTE_MARKDOWN_IMPORT.md`](./REMOTE_MARKDOWN_IMPORT.md)
