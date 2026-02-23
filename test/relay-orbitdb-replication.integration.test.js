import { expect } from 'chai'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

import { createLibp2p } from 'libp2p'
import { createHelia } from 'helia'
import { bitswap } from '@helia/block-brokers'
import { libp2pRouting } from '@helia/routers'
import { createOrbitDB } from '@orbitdb/core'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'
import { multiaddr } from '@multiformats/multiaddr'
import { tcp } from '@libp2p/tcp'
import { webSockets } from '@libp2p/websockets'
import { yamux } from '@chainsafe/libp2p-yamux'
import { noise } from '@chainsafe/libp2p-noise'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { identify, identifyPush } from '@libp2p/identify'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'
import { kadDHT } from '@libp2p/kad-dht'
import { peerIdFromString } from '@libp2p/peer-id'

const RELAY_START_TIMEOUT_MS = 60_000
const RELAY_WS_PORT = 62092

function getRelayBinPath() {
  const binName = process.platform === 'win32' ? 'orbitdb-relay-pinner.cmd' : 'orbitdb-relay-pinner'
  return join(process.cwd(), 'node_modules', '.bin', binName)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(fn, timeoutMs = 60_000, intervalMs = 500) {
  const start = Date.now()
  let lastError
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn()
      if (value) return value
    } catch (err) {
      lastError = err
    }
    await sleep(intervalMs)
  }
  throw lastError || new Error(`Timeout after ${timeoutMs}ms`)
}

async function putWithRetry(db, doc, timeoutMs = 60_000) {
  const start = Date.now()
  let lastError
  while (Date.now() - start < timeoutMs) {
    try {
      await db.put(doc)
      return
    } catch (err) {
      lastError = err
      const text = String(err)
      if (!text.includes('NoPeersSubscribedToTopic')) throw err
      await sleep(400)
    }
  }
  throw lastError || new Error('putWithRetry timeout')
}

async function createStack(baseDir) {
  const blockstore = new LevelBlockstore(join(baseDir, 'blocks'))
  const datastore = new LevelDatastore(join(baseDir, 'data'))
  const libp2p = await createLibp2p({
    addresses: {
      listen: ['/ip4/127.0.0.1/tcp/0', '/ip4/127.0.0.1/tcp/0/ws']
    },
    transports: [tcp(), webSockets(), circuitRelayTransport()],
    streamMuxers: [yamux()],
    connectionEncrypters: [noise()],
    services: {
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
      identify: identify(),
      identifyPush: identifyPush(),
      aminoDHT: kadDHT({
        protocol: '/ipfs/kad/1.0.0'
      })
    }
  })

  const helia = await createHelia({
    libp2p,
    datastore,
    blockstore,
    blockBrokers: [bitswap()],
    routers: [libp2pRouting(libp2p)]
  })
  const orbitdb = await createOrbitDB({
    ipfs: helia,
    directory: join(baseDir, 'orbitdb')
  })

  return { libp2p, helia, orbitdb }
}

async function stopStack(stack) {
  await stack.orbitdb?.stop?.().catch(() => {})
  await stack.helia?.libp2p?.stop?.().catch(() => {})
}

async function dialRelayWithRetry(node, relayWsAddr, timeoutMs = 30_000) {
  await waitFor(async () => {
    await node.libp2p.dial(multiaddr(relayWsAddr))
    return true
  }, timeoutMs, 400)
}

function getPeerIdFromAddr(addr) {
  const parts = String(addr || '').split('/p2p/')
  return parts[1] || null
}

function stripPeerIdFromAddr(addr) {
  const str = String(addr || '')
  const idx = str.indexOf('/p2p/')
  return idx === -1 ? str : str.slice(0, idx)
}

async function connectLikeOrbitDbTests(fromNode, targetNodeOrPeerId, targetAddr, timeoutMs = 30_000) {
  const peerId =
    typeof targetNodeOrPeerId === 'string'
      ? peerIdFromString(targetNodeOrPeerId)
      : targetNodeOrPeerId?.libp2p?.peerId
  if (!peerId) throw new Error('missing peerId for connectLikeOrbitDbTests')

  if (targetAddr) {
    await fromNode.libp2p.peerStore.save(peerId, { multiaddrs: [multiaddr(targetAddr)] })
  }
  await waitFor(async () => {
    await fromNode.libp2p.dial(peerId)
    return fromNode.libp2p.getConnections(peerId).length > 0
  }, timeoutMs, 300)
}

function getRelayPeerIdFromConnection(node, relayWsAddr) {
  const target = String(relayWsAddr)
  const conn = node.libp2p
    .getConnections()
    .find((c) => String(c.remoteAddr?.toString?.() || '').includes(target))
  return conn?.remotePeer?.toString?.() || null
}

async function ensureRelayReservationFromConnection(node, relayWsAddr, timeoutMs = 30_000) {
  const relayPeerId = await waitFor(() => getRelayPeerIdFromConnection(node, relayWsAddr), timeoutMs, 250)
  const relayBaseAddr = stripPeerIdFromAddr(relayWsAddr)
  const relayCircuitListen = `${relayBaseAddr}/p2p/${relayPeerId}/p2p-circuit`
  const tm = node?.libp2p?.components?.transportManager
  if (!tm?.listen) throw new Error('transportManager.listen is unavailable on libp2p components')
  await tm.listen([multiaddr(relayCircuitListen)])
  await waitFor(() => {
    const addrs = node.libp2p.getMultiaddrs().map((ma) => ma.toString())
    return addrs.some((a) => a.includes('/p2p-circuit'))
  }, timeoutMs)
}

describe('Relay OrbitDB replication (Alice offline, Bob later)', function () {
  this.timeout(180_000)

  let relayProcess
  let relayWsAddr
  let tmpRoot
  let alice
  let bob

  const relayLogs = []

  before(async () => {
    tmpRoot = join(tmpdir(), `relay-orbitdb-repl-${Date.now()}`)
    await mkdir(tmpRoot, { recursive: true })
    const relayBin = getRelayBinPath()

    relayProcess = spawn(relayBin, ['--test'], {
      cwd: tmpRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DATASTORE_PATH: join(tmpRoot, 'relay-storage'),
        RELAY_TCP_PORT: '0',
        RELAY_WS_PORT: String(RELAY_WS_PORT),
        RELAY_WEBRTC_PORT: '0',
        RELAY_DISABLE_WEBRTC: 'true',
        METRICS_PORT: '0',
        ENABLE_GENERAL_LOGS: 'true',
        ENABLE_SYNC_LOGS: 'true',
        ENABLE_SYNC_STATS: 'true',
        LOG_LEVEL_DATABASE: 'true'
      }
    })

    relayWsAddr = undefined
    const onRelayData = (buf) => {
      const text = buf.toString()
      relayLogs.push(text)
      const m = text.match(/\/ip4\/(127\.0\.0\.1|0\.0\.0\.0)\/tcp\/(\d+)\/ws\/p2p\/([A-Za-z0-9]+)/)
      if (m) {
        const host = m[1] === '0.0.0.0' ? '127.0.0.1' : m[1]
        relayWsAddr = `/ip4/${host}/tcp/${m[2]}/ws/p2p/${m[3]}`
      }
    }

    relayProcess.stdout?.on('data', onRelayData)
    relayProcess.stderr?.on('data', onRelayData)

    await waitFor(() => relayProcess?.exitCode == null, RELAY_START_TIMEOUT_MS)
    await waitFor(() => typeof relayWsAddr === 'string' && relayWsAddr.includes('/p2p/'), RELAY_START_TIMEOUT_MS, 200)
  })

  after(async () => {
    await stopStack(bob || {})
    await stopStack(alice || {})

    if (relayProcess) {
      relayProcess.kill()
      relayProcess = null
    }

    if (tmpRoot) {
      await rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('replicates 3 records from Alice to Bob through relay after Alice goes offline', async () => {
    const aliceDir = join(tmpRoot, 'alice')
    const bobDir = join(tmpRoot, 'bob')
    const dbName = `alice-repl-${Date.now()}`

    alice = await createStack(aliceDir)
    await dialRelayWithRetry(alice, relayWsAddr)
    {
      const relayPeerId =
        getPeerIdFromAddr(relayWsAddr) ||
        (await waitFor(() => getRelayPeerIdFromConnection(alice, relayWsAddr), 10_000, 200))
      await connectLikeOrbitDbTests(alice, relayPeerId, relayWsAddr)
    }
    await ensureRelayReservationFromConnection(alice, relayWsAddr)

    const aliceDb = await alice.orbitdb.open(dbName, { type: 'documents', create: true, overwrite: false })
    const dbAddress = aliceDb.address.toString()

    await putWithRetry(aliceDb, { _id: 'r1', value: 'alpha' })
    await putWithRetry(aliceDb, { _id: 'r2', value: 'beta' })
    await putWithRetry(aliceDb, { _id: 'r3', value: 'gamma' })

    await waitFor(async () => {
      const logs = relayLogs.join('\n')
      return logs.includes(dbAddress)
    }, 30_000)
    await waitFor(async () => {
      const logs = relayLogs.join('\n')
      return logs.includes(`Pinned data CID for ${dbAddress}`)
    }, 60_000)

    await aliceDb.close()
    await stopStack(alice)
    alice = null

    bob = await createStack(bobDir)
    await dialRelayWithRetry(bob, relayWsAddr)
    {
      const relayPeerId =
        getPeerIdFromAddr(relayWsAddr) ||
        (await waitFor(() => getRelayPeerIdFromConnection(bob, relayWsAddr), 10_000, 200))
      await connectLikeOrbitDbTests(bob, relayPeerId, relayWsAddr)
    }
    await ensureRelayReservationFromConnection(bob, relayWsAddr)

    const bobDb = await bob.orbitdb.open(dbAddress)
    let joined = false
    let updated = false
    bobDb.events.on('join', () => { joined = true })
    bobDb.events.on('update', () => { updated = true })
    await waitFor(async () => {
      const rows = await bobDb.all()
      const ids = new Set(rows.map((r) => r.key || r.value?._id))
      return rows.length === 3 && ids.has('r1') && ids.has('r2') && ids.has('r3') && (joined || updated)
    }, 60_000, 300)

    const rows = await bobDb.all()
    const valuesById = Object.fromEntries(rows.map((r) => [r.key || r.value?._id, r.value?.value]))
    expect(valuesById.r1).to.equal('alpha')
    expect(valuesById.r2).to.equal('beta')
    expect(valuesById.r3).to.equal('gamma')

    await bobDb.close()
  })
})
