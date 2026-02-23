import { expect } from 'chai'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

import { createLibp2p } from 'libp2p'
import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'
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
import { bootstrap } from '@libp2p/bootstrap'
import { peerIdFromString } from '@libp2p/peer-id'

const RELAY_START_TIMEOUT_MS = 30_000
const RUN_CONTROL_TESTS = process.env.RELAY_TEST_RUN_CONTROLS === '1'

function getRelayBinPath() {
  const binName = process.platform === 'win32' ? 'orbitdb-relay-pinner.cmd' : 'orbitdb-relay-pinner'
  return join(process.cwd(), 'node_modules', '.bin', binName)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tryDialBitswapOverRelay(fromNode, relayCircuitAddr, targetNode, timeoutMs = 12_000) {
  const advertised = targetNode.libp2p.getProtocols?.() || []
  const candidates = advertised.filter((p) => p.includes('bitswap'))
  const fallback = ['/ipfs/bitswap/1.2.0', '/ipfs/bitswap/1.1.0', '/ipfs/bitswap/1.0.0']
  const protocols = [...new Set([...candidates, ...fallback])]

  const results = []
  for (const proto of protocols) {
    try {
      const stream = await withTimeout(
        fromNode.libp2p.dialProtocol(multiaddr(relayCircuitAddr), proto),
        timeoutMs,
        `dialProtocol(${proto})`
      )
      await stream?.close?.().catch(() => {})
      results.push({ proto, ok: true })
      break
    } catch (err) {
      results.push({ proto, ok: false, err: String(err) })
    }
  }
  return results
}

function summarizeConnections(label, node) {
  const rows = node.libp2p.getConnections().map((c) => ({
    id: c.id,
    peer: c.remotePeer?.toString?.(),
    addr: c.remoteAddr?.toString?.(),
    dir: c.direction,
    mux: c.multiplexer,
    enc: c.encryption,
    status: c.status,
    limits: c.limits ?? null
  }))
  process.stdout.write(`[relay-test] ${label} connections: ${JSON.stringify(rows)}\n`)
}

async function withTimeout(promise, timeoutMs, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
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

async function readAllBytes(fs, cid) {
  const chunks = []
  for await (const chunk of fs.cat(cid)) chunks.push(chunk)
  return Buffer.concat(chunks)
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
      const msg = String(err?.message || '')
      const name = String(err?.name || '')
      const code = String(err?.code || '')
      const isNoPeerSub =
        text.includes('NoPeersSubscribedToTopic') ||
        msg.includes('NoPeersSubscribedToTopic') ||
        name.includes('NoPeersSubscribedToTopic') ||
        code.includes('NoPeersSubscribedToTopic')
      if (!isNoPeerSub) throw err
      await sleep(500)
    }
  }
  throw lastError || new Error('putWithRetry timeout')
}

async function createStack(baseDir, opts = {}) {
  const blockstore = new LevelBlockstore(join(baseDir, 'blocks'))
  const datastore = new LevelDatastore(join(baseDir, 'data'))
  const transports = [tcp(), webSockets()]
  if (!opts.disableCircuitRelayTransport) {
    transports.push(circuitRelayTransport())
  }
  const libp2p = await createLibp2p({
    addresses: {
      listen: ['/ip4/127.0.0.1/tcp/0', '/ip4/127.0.0.1/tcp/0/ws']
    },
    transports,
    streamMuxers: [yamux()],
    connectionEncrypters: [noise()],
    peerDiscovery: opts.bootstrapList?.length
      ? [
          bootstrap({
            list: opts.bootstrapList
          })
        ]
      : [],
    services: {
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true }),
      identify: identify(),
      identifyPush: identifyPush(),
      aminoDHT: kadDHT({
        protocol: '/ipfs/kad/1.0.0'
      })
    }
  })

  const heliaInit = { libp2p, datastore, blockstore }
  if (opts.localRoutingOnly) {
    heliaInit.blockBrokers = [bitswap()]
    heliaInit.routers = [libp2pRouting(libp2p)]
  }
  const helia = await createHelia(heliaInit)
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

function getPeerIdFromAddr(addr) {
  const parts = String(addr || '').split('/p2p/')
  return parts[1] || null
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

async function ensureRelayReservation(node, relayWsAddr, timeoutMs = 30_000) {
  const relayCircuitListen = `${relayWsAddr}/p2p-circuit`
  const tm = node?.libp2p?.components?.transportManager
  if (!tm?.listen) throw new Error('transportManager.listen is unavailable on libp2p components')
  await tm.listen([multiaddr(relayCircuitListen)])
  await waitFor(() => {
    const addrs = node.libp2p.getMultiaddrs().map((ma) => ma.toString())
    return addrs.some((a) => a.includes('/p2p-circuit'))
  }, timeoutMs)
}

describe('Relay media pinning integration', function () {
  this.timeout(180_000)

  let relayProcess
  let relayWsAddr
  let tmpRoot

  let publisher
  let consumer

  const relayLogs = []

  const getLocalWsAddr = (node) => {
    const addrs = node.libp2p.getMultiaddrs().map((ma) => ma.toString())
    const ws = addrs.find((a) => a.includes('/ip4/127.0.0.1/tcp/') && a.includes('/ws/p2p/'))
    if (!ws) throw new Error(`No localhost ws addr found: ${addrs.join(', ')}`)
    return ws
  }

  const getRelayPeerId = () => {
    const parts = String(relayWsAddr || '').split('/p2p/')
    return parts[1] || ''
  }

  const waitForConnectionToPeer = async (node, peerId, timeoutMs = 20_000) => {
    if (!peerId) throw new Error('peer id unavailable')
    await waitFor(() => node.libp2p.getConnections(peerId).length > 0, timeoutMs, 250)
  }

  const waitForConnectionToRelay = async (node, timeoutMs = 20_000) => {
    const relayPeerId = getRelayPeerId()
    if (!relayPeerId) throw new Error('relay peer id unavailable')
    await waitForConnectionToPeer(node, relayPeerId, timeoutMs)
  }

  before(async () => {
    tmpRoot = join(tmpdir(), `relay-media-integration-${Date.now()}`)
    await mkdir(tmpRoot, { recursive: true })
    const relayBin = getRelayBinPath()

    relayProcess = spawn(relayBin, ['--test'], {
      cwd: tmpRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DATASTORE_PATH: join(tmpRoot, 'relay-storage'),
        RELAY_TCP_PORT: '0',
        RELAY_WS_PORT: '0',
        RELAY_WEBRTC_PORT: '0',
        RELAY_DISABLE_WEBRTC: 'true',
        METRICS_PORT: '0',
        ENABLE_GENERAL_LOGS: 'true',
        ENABLE_SYNC_LOGS: 'true',
        ENABLE_SYNC_STATS: 'true',
        ENABLE_CID_REQUEST_LOGS: 'true',
        LOG_LEVEL_DATABASE: 'true',
        DEBUG: 'le-space:relay:*'
      }
    })

    const onRelayData = (buf) => {
      const text = buf.toString()
      relayLogs.push(text)
      const m = text.match(/\/ip4\/(127\.0\.0\.1|0\.0\.0\.0)\/tcp\/(\d+)\/ws\/p2p\/([A-Za-z0-9]+)/)
      if (m && !relayWsAddr) {
        const host = m[1] === '0.0.0.0' ? '127.0.0.1' : m[1]
        relayWsAddr = `/ip4/${host}/tcp/${m[2]}/ws/p2p/${m[3]}`
      }
      process.stdout.write(`[relay-test] ${text}`)
    }

    relayProcess.stdout?.on('data', onRelayData)
    relayProcess.stderr?.on('data', onRelayData)

    await waitFor(() => relayWsAddr, RELAY_START_TIMEOUT_MS)
  })

  after(async () => {
    await stopStack(consumer || {})
    await stopStack(publisher || {})

    if (relayProcess) {
      relayProcess.kill()
      relayProcess = null
    }

    if (tmpRoot) {
      await rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
    }
  })

  it('pins media CIDs on relay but consumer cannot fetch them after publisher goes offline (known gap)', async () => {
    const publisherDir = join(tmpRoot, 'publisher')
    const consumerDir = join(tmpRoot, 'consumer')

    publisher = await createStack(publisherDir, { localRoutingOnly: true })
    await publisher.libp2p.dial(multiaddr(relayWsAddr))
    {
      const relayPeerId = getPeerIdFromAddr(relayWsAddr)
      if (relayPeerId) {
        await connectLikeOrbitDbTests(publisher, relayPeerId, relayWsAddr)
      }
    }
    await ensureRelayReservation(publisher, relayWsAddr)

    const pubFs = unixfs(publisher.helia)
    const logoBytes = Buffer.from(`logo-${Date.now()}-${Math.random()}`)
    const mediaBytes = Buffer.from(`media-${Date.now()}-${Math.random()}`)

    const logoCid = await pubFs.addBytes(logoBytes)
    const mediaCid = await pubFs.addBytes(mediaBytes)
    const logoCidStr = logoCid.toString()
    const mediaCidStr = mediaCid.toString()

    const settingsDb = await publisher.orbitdb.open('settings', { type: 'documents', create: true, overwrite: false })
    const postsDb = await publisher.orbitdb.open('posts', { type: 'documents', create: true, overwrite: false })
    const commentsDb = await publisher.orbitdb.open('comments', { type: 'documents', create: true, overwrite: false })
    const mediaDb = await publisher.orbitdb.open('media', { type: 'documents', create: true, overwrite: false })

    await putWithRetry(settingsDb, { _id: 'blogName', value: 'Relay Integration Blog' })
    await putWithRetry(settingsDb, { _id: 'blogDescription', value: 'relay pinning integration check' })
    await putWithRetry(settingsDb, { _id: 'profilePicture', value: logoCidStr })
    await putWithRetry(settingsDb, { _id: 'postsDBAddress', value: postsDb.address.toString() })
    await putWithRetry(settingsDb, { _id: 'commentsDBAddress', value: commentsDb.address.toString() })
    await putWithRetry(settingsDb, { _id: 'mediaDBAddress', value: mediaDb.address.toString() })

    await putWithRetry(mediaDb, {
      _id: `logo-${Date.now()}`,
      cid: logoCidStr,
      name: 'logo.jpg',
      size: logoBytes.length,
      type: 'image/jpeg'
    })
    await putWithRetry(mediaDb, {
      _id: `media-${Date.now()}`,
      cid: mediaCidStr,
      name: 'post-image.jpg',
      size: mediaBytes.length,
      type: 'image/jpeg'
    })

    await putWithRetry(postsDb, {
      _id: `post-${Date.now()}`,
      title: 'Pinned media test',
      content: `![Media](ipfs://${mediaCidStr})`,
      mediaIds: [mediaCidStr],
      published: true
    })

    const settingsAddress = settingsDb.address.toString()

    await waitFor(async () => {
      const logs = relayLogs.join('\n')
      return logs.includes(settingsAddress) && logs.includes('DB_SYNC: media') && logs.includes('DB_SYNC: posts')
    }, 120_000)

    await settingsDb.close()
    await postsDb.close()
    await commentsDb.close()
    await mediaDb.close()
    await stopStack(publisher)
    publisher = null

    // Bob starts only after Alice is fully offline.
    consumer = await createStack(consumerDir, { localRoutingOnly: true })
    await consumer.libp2p.dial(multiaddr(relayWsAddr))
    {
      const relayPeerId = getPeerIdFromAddr(relayWsAddr)
      if (relayPeerId) {
        await connectLikeOrbitDbTests(consumer, relayPeerId, relayWsAddr)
      }
    }
    await ensureRelayReservation(consumer, relayWsAddr)

    const conFs = unixfs(consumer.helia)

    let logoFetchError
    let mediaFetchError
    try {
      await withTimeout(readAllBytes(conFs, logoCid), 20_000, 'consumer cat(logoCid)')
    } catch (err) {
      logoFetchError = err
    }
    try {
      await withTimeout(readAllBytes(conFs, mediaCid), 20_000, 'consumer cat(mediaCid)')
    } catch (err) {
      mediaFetchError = err
    }

    expect(String(logoFetchError?.message || '')).to.include('timed out')
    expect(String(mediaFetchError?.message || '')).to.include('timed out')
  })

  it('diagnostic ladder: local 3-node passes even with late Bob, while external-relay stages fail', async () => {
    // Stage 0 (baseline): local 3-node path without external relay process.
    const s0Alice = await createStack(join(tmpRoot, `diag-s0-alice-${Date.now()}`), { localRoutingOnly: true })
    const s0RelayNode = await createStack(join(tmpRoot, `diag-s0-relay-${Date.now()}`), { localRoutingOnly: true })
    const s0Bob = await createStack(join(tmpRoot, `diag-s0-bob-${Date.now()}`), { localRoutingOnly: true })

    try {
      await s0RelayNode.libp2p.dial(multiaddr(getLocalWsAddr(s0Alice)))
      await s0Bob.libp2p.dial(multiaddr(getLocalWsAddr(s0RelayNode)))
      const s0AliceFs = unixfs(s0Alice.helia)
      const s0RelayFs = unixfs(s0RelayNode.helia)
      const s0BobFs = unixfs(s0Bob.helia)
      const s0Payload = Buffer.from(`diag-s0-${Date.now()}-${Math.random()}`)
      const s0Cid = await s0AliceFs.addBytes(s0Payload)
      const s0FetchedByRelay = await withTimeout(readAllBytes(s0RelayFs, s0Cid), 20_000, 'diag s0 relay cat(cid)')
      expect(s0FetchedByRelay.equals(s0Payload)).to.equal(true)
      await s0RelayNode.helia.pins.add(s0Cid)
      await stopStack(s0Alice)
      const s0FetchedByBob = await withTimeout(readAllBytes(s0BobFs, s0Cid), 20_000, 'diag s0 bob cat(cid)')
      expect(s0FetchedByBob.equals(s0Payload)).to.equal(true)
    } finally {
      await stopStack(s0Bob)
      await stopStack(s0RelayNode)
      await stopStack(s0Alice)
    }

    // Stage 0b (same simple topology, Bob starts late): relay node is online,
    // Alice publishes and goes offline, then Bob starts and can still fetch.
    const s0bAlice = await createStack(join(tmpRoot, `diag-s0b-alice-${Date.now()}`), { localRoutingOnly: true })
    const s0bRelayNode = await createStack(join(tmpRoot, `diag-s0b-relay-${Date.now()}`), { localRoutingOnly: true })
    let s0bCid
    const s0bPayload = Buffer.from(`diag-s0b-${Date.now()}-${Math.random()}`)

    try {
      await s0bRelayNode.libp2p.dial(multiaddr(getLocalWsAddr(s0bAlice)))
      const s0bAliceFs = unixfs(s0bAlice.helia)
      const s0bRelayFs = unixfs(s0bRelayNode.helia)
      s0bCid = await s0bAliceFs.addBytes(s0bPayload)
      const s0bFetchedByRelay = await withTimeout(readAllBytes(s0bRelayFs, s0bCid), 20_000, 'diag s0b relay cat(cid)')
      expect(s0bFetchedByRelay.equals(s0bPayload)).to.equal(true)
      await s0bRelayNode.helia.pins.add(s0bCid)
      await stopStack(s0bAlice)
    } finally {
      await stopStack(s0bAlice)
    }

    const s0bBob = await createStack(join(tmpRoot, `diag-s0b-bob-${Date.now()}`), { localRoutingOnly: true })
    try {
      await s0bBob.libp2p.dial(multiaddr(getLocalWsAddr(s0bRelayNode)))
      const s0bBobFs = unixfs(s0bBob.helia)
      const s0bFetchedByBob = await withTimeout(readAllBytes(s0bBobFs, s0bCid), 20_000, 'diag s0b bob late-start cat(cid)')
      expect(s0bFetchedByBob.equals(s0bPayload)).to.equal(true)
    } finally {
      await stopStack(s0bBob)
      await stopStack(s0bRelayNode)
    }

    // Stage 0c (simple local relay + bootstrap only): no explicit dial between Alice/Bob and relayNode.
    const s0cRelayNode = await createStack(join(tmpRoot, `diag-s0c-relay-${Date.now()}`), { localRoutingOnly: true })
    const s0cRelayWs = getLocalWsAddr(s0cRelayNode)
    const s0cRelayPeerId = s0cRelayNode.libp2p.peerId.toString()
    const s0cAlice = await createStack(join(tmpRoot, `diag-s0c-alice-${Date.now()}`), {
      localRoutingOnly: true,
      bootstrapList: [s0cRelayWs]
    })
    let s0cCid
    const s0cPayload = Buffer.from(`diag-s0c-${Date.now()}-${Math.random()}`)
    try {
      await waitForConnectionToPeer(s0cAlice, s0cRelayPeerId)
      const s0cAliceFs = unixfs(s0cAlice.helia)
      const s0cRelayFs = unixfs(s0cRelayNode.helia)
      s0cCid = await s0cAliceFs.addBytes(s0cPayload)
      const s0cFetchedByRelay = await withTimeout(readAllBytes(s0cRelayFs, s0cCid), 20_000, 'diag s0c relay cat(cid)')
      expect(s0cFetchedByRelay.equals(s0cPayload)).to.equal(true)
      await s0cRelayNode.helia.pins.add(s0cCid)
      await stopStack(s0cAlice)
    } finally {
      await stopStack(s0cAlice)
    }

    const s0cBob = await createStack(join(tmpRoot, `diag-s0c-bob-${Date.now()}`), {
      localRoutingOnly: true,
      bootstrapList: [s0cRelayWs]
    })
    try {
      await waitForConnectionToPeer(s0cBob, s0cRelayPeerId)
      const s0cBobFs = unixfs(s0cBob.helia)
      const s0cFetchedByBob = await withTimeout(readAllBytes(s0cBobFs, s0cCid), 20_000, 'diag s0c bob late-start cat(cid)')
      expect(s0cFetchedByBob.equals(s0cPayload)).to.equal(true)
    } finally {
      await stopStack(s0cBob)
      await stopStack(s0cRelayNode)
    }

    // Stage 0d (simple local relay + bootstrap only + OrbitDB replication + media pinning).
    const s0dRelayNode = await createStack(join(tmpRoot, `diag-s0d-relay-${Date.now()}`), { localRoutingOnly: true })
    const s0dRelayWs = getLocalWsAddr(s0dRelayNode)
    const s0dRelayPeerId = s0dRelayNode.libp2p.peerId.toString()
    const s0dAlice = await createStack(join(tmpRoot, `diag-s0d-alice-${Date.now()}`), {
      localRoutingOnly: true,
      bootstrapList: [s0dRelayWs]
    })

    let s0dSettingsAddress
    let s0dLogoCid
    let s0dMediaCid
    const s0dLogoBytes = Buffer.from(`diag-s0d-logo-${Date.now()}-${Math.random()}`)
    const s0dMediaBytes = Buffer.from(`diag-s0d-media-${Date.now()}-${Math.random()}`)
    const s0dBlogName = 'Diag S0d Blog'
    const s0dBlogDescription = 'Local relay bootstrap + orbitdb replication'

    try {
      await waitForConnectionToPeer(s0dAlice, s0dRelayPeerId)
      const s0dAliceFs = unixfs(s0dAlice.helia)
      s0dLogoCid = await s0dAliceFs.addBytes(s0dLogoBytes)
      s0dMediaCid = await s0dAliceFs.addBytes(s0dMediaBytes)
      const s0dLogoCidStr = s0dLogoCid.toString()
      const s0dMediaCidStr = s0dMediaCid.toString()

      const s0dSettingsDb = await s0dAlice.orbitdb.open('settings', { type: 'documents', create: true, overwrite: false })
      const s0dPostsDb = await s0dAlice.orbitdb.open('posts', { type: 'documents', create: true, overwrite: false })
      const s0dCommentsDb = await s0dAlice.orbitdb.open('comments', { type: 'documents', create: true, overwrite: false })
      const s0dMediaDb = await s0dAlice.orbitdb.open('media', { type: 'documents', create: true, overwrite: false })
      const s0dPostsAddress = s0dPostsDb.address.toString()
      const s0dMediaAddress = s0dMediaDb.address.toString()

      // Open on relay first so pubsub topics are subscribed before writes.
      const s0dRelaySettingsDb = await s0dRelayNode.orbitdb.open(s0dSettingsDb.address.toString())
      const s0dRelayPostsDb = await s0dRelayNode.orbitdb.open(s0dPostsAddress)
      const s0dRelayMediaDb = await s0dRelayNode.orbitdb.open(s0dMediaAddress)
      await sleep(500)

      await putWithRetry(s0dSettingsDb, { _id: 'blogName', value: s0dBlogName })
      await putWithRetry(s0dSettingsDb, { _id: 'blogDescription', value: s0dBlogDescription })
      await putWithRetry(s0dSettingsDb, { _id: 'profilePicture', value: s0dLogoCidStr })
      await putWithRetry(s0dSettingsDb, { _id: 'postsDBAddress', value: s0dPostsAddress })
      await putWithRetry(s0dSettingsDb, { _id: 'commentsDBAddress', value: s0dCommentsDb.address.toString() })
      await putWithRetry(s0dSettingsDb, { _id: 'mediaDBAddress', value: s0dMediaAddress })

      await putWithRetry(s0dMediaDb, {
        _id: `diag-s0d-logo-${Date.now()}`,
        cid: s0dLogoCidStr,
        name: 'diag-s0d-logo.jpg',
        size: s0dLogoBytes.length,
        type: 'image/jpeg'
      })
      await putWithRetry(s0dMediaDb, {
        _id: `diag-s0d-media-${Date.now()}`,
        cid: s0dMediaCidStr,
        name: 'diag-s0d-post-image.jpg',
        size: s0dMediaBytes.length,
        type: 'image/jpeg'
      })
      await putWithRetry(s0dPostsDb, {
        _id: `diag-s0d-post-${Date.now()}`,
        title: 'Diag s0d post',
        content: `![Diag](ipfs://${s0dMediaCidStr})`,
        mediaIds: [s0dMediaCidStr],
        published: true
      })

      s0dSettingsAddress = s0dSettingsDb.address.toString()

      await waitFor(async () => {
        const got = await s0dRelaySettingsDb.get('blogName')
        return got?.value?.value === s0dBlogName
      }, 30_000, 300)
      await waitFor(async () => (await s0dRelayPostsDb.all()).length > 0, 30_000, 300)
      await waitFor(async () => (await s0dRelayMediaDb.all()).length >= 2, 30_000, 300)

      // Relay fetches and pins media CIDs before Alice goes offline.
      const s0dRelayFs = unixfs(s0dRelayNode.helia)
      const s0dRelayLogo = await withTimeout(readAllBytes(s0dRelayFs, s0dLogoCid), 20_000, 'diag s0d relay cat(logoCid)')
      const s0dRelayMedia = await withTimeout(readAllBytes(s0dRelayFs, s0dMediaCid), 20_000, 'diag s0d relay cat(mediaCid)')
      expect(s0dRelayLogo.equals(s0dLogoBytes)).to.equal(true)
      expect(s0dRelayMedia.equals(s0dMediaBytes)).to.equal(true)
      await s0dRelayNode.helia.pins.add(s0dLogoCid)
      await s0dRelayNode.helia.pins.add(s0dMediaCid)

      await s0dSettingsDb.close()
      await s0dPostsDb.close()
      await s0dCommentsDb.close()
      await s0dMediaDb.close()
      await stopStack(s0dAlice)
    } finally {
      await stopStack(s0dAlice)
    }

    const s0dBob = await createStack(join(tmpRoot, `diag-s0d-bob-${Date.now()}`), {
      localRoutingOnly: true,
      bootstrapList: [s0dRelayWs]
    })
    try {
      await waitForConnectionToPeer(s0dBob, s0dRelayPeerId)

      const s0dBobSettingsDb = await s0dBob.orbitdb.open(s0dSettingsAddress)
      await waitFor(async () => {
        const got = await s0dBobSettingsDb.get('blogName')
        return got?.value?.value === s0dBlogName
      }, 30_000, 300)

      const s0dBobBlogName = await s0dBobSettingsDb.get('blogName')
      const s0dBobBlogDescription = await s0dBobSettingsDb.get('blogDescription')
      const s0dBobProfilePicture = await s0dBobSettingsDb.get('profilePicture')
      const s0dBobPostsAddress = await s0dBobSettingsDb.get('postsDBAddress')
      const s0dBobMediaAddress = await s0dBobSettingsDb.get('mediaDBAddress')

      expect(s0dBobBlogName?.value?.value).to.equal(s0dBlogName)
      expect(s0dBobBlogDescription?.value?.value).to.equal(s0dBlogDescription)
      expect(s0dBobProfilePicture?.value?.value).to.equal(s0dLogoCid.toString())

      const s0dBobPostsDb = await s0dBob.orbitdb.open(s0dBobPostsAddress?.value?.value)
      const s0dBobMediaDb = await s0dBob.orbitdb.open(s0dBobMediaAddress?.value?.value)
      await waitFor(async () => (await s0dBobPostsDb.all()).length > 0, 30_000, 300)
      await waitFor(async () => (await s0dBobMediaDb.all()).length >= 2, 30_000, 300)

      const s0dBobFs = unixfs(s0dBob.helia)
      const s0dBobLogo = await withTimeout(readAllBytes(s0dBobFs, s0dLogoCid), 20_000, 'diag s0d bob cat(logoCid)')
      const s0dBobMedia = await withTimeout(readAllBytes(s0dBobFs, s0dMediaCid), 20_000, 'diag s0d bob cat(mediaCid)')
      expect(s0dBobLogo.equals(s0dLogoBytes)).to.equal(true)
      expect(s0dBobMedia.equals(s0dMediaBytes)).to.equal(true)
    } finally {
      await stopStack(s0dBob)
      await stopStack(s0dRelayNode)
    }

    // Stage 1 (minimal external relay): publisher+consumer both online via relay only.
    const s1Publisher = await createStack(join(tmpRoot, `diag-s1-publisher-${Date.now()}`), { localRoutingOnly: true })
    const s1Consumer = await createStack(join(tmpRoot, `diag-s1-consumer-${Date.now()}`), { localRoutingOnly: true })

    try {
      await s1Publisher.libp2p.dial(multiaddr(relayWsAddr))
      await s1Consumer.libp2p.dial(multiaddr(relayWsAddr))
      {
        const relayPeerId = getPeerIdFromAddr(relayWsAddr)
        if (relayPeerId) {
          await connectLikeOrbitDbTests(s1Publisher, relayPeerId, relayWsAddr)
          await connectLikeOrbitDbTests(s1Consumer, relayPeerId, relayWsAddr)
        }
      }
      await ensureRelayReservation(s1Publisher, relayWsAddr)
      await ensureRelayReservation(s1Consumer, relayWsAddr)

      const s1PublisherFs = unixfs(s1Publisher.helia)
      const s1ConsumerFs = unixfs(s1Consumer.helia)
      const s1Payload = Buffer.from(`diag-s1-${Date.now()}-${Math.random()}`)
      const s1Cid = await s1PublisherFs.addBytes(s1Payload)

      let s1Error
      try {
        await withTimeout(readAllBytes(s1ConsumerFs, s1Cid), 20_000, 'diag s1 consumer cat(cid)')
      } catch (err) {
        s1Error = err
      }
      expect(String(s1Error?.message || '')).to.include('timed out')
    } finally {
      await stopStack(s1Consumer)
      await stopStack(s1Publisher)
    }

    // Stage 1c: external relay discovered through bootstrap list only (no explicit dial).
    const s1cPublisher = await createStack(join(tmpRoot, `diag-s1c-publisher-${Date.now()}`), {
      localRoutingOnly: true,
      disableCircuitRelayTransport: true,
      bootstrapList: [relayWsAddr]
    })
    const s1cConsumer = await createStack(join(tmpRoot, `diag-s1c-consumer-${Date.now()}`), {
      localRoutingOnly: true,
      disableCircuitRelayTransport: true,
      bootstrapList: [relayWsAddr]
    })
    try {
      await waitForConnectionToRelay(s1cPublisher)
      await waitForConnectionToRelay(s1cConsumer)

      const s1cPublisherFs = unixfs(s1cPublisher.helia)
      const s1cConsumerFs = unixfs(s1cConsumer.helia)
      const s1cPayload = Buffer.from(`diag-s1c-${Date.now()}-${Math.random()}`)
      const s1cCid = await s1cPublisherFs.addBytes(s1cPayload)

      let s1cError
      try {
        await withTimeout(readAllBytes(s1cConsumerFs, s1cCid), 20_000, 'diag s1c consumer cat(cid)')
      } catch (err) {
        s1cError = err
      }
      expect(String(s1cError?.message || '')).to.include('timed out')
    } finally {
      await stopStack(s1cConsumer)
      await stopStack(s1cPublisher)
    }

    // Stage 1b: external relay, but with circuit relay transport disabled on both peers.
    // This isolates plain WS<->relay path only.
    const s1bPublisher = await createStack(join(tmpRoot, `diag-s1b-publisher-${Date.now()}`), {
      localRoutingOnly: true,
      disableCircuitRelayTransport: true
    })
    const s1bConsumer = await createStack(join(tmpRoot, `diag-s1b-consumer-${Date.now()}`), {
      localRoutingOnly: true,
      disableCircuitRelayTransport: true
    })
    try {
      await s1bPublisher.libp2p.dial(multiaddr(relayWsAddr))
      await s1bConsumer.libp2p.dial(multiaddr(relayWsAddr))
      {
        const relayPeerId = getPeerIdFromAddr(relayWsAddr)
        if (relayPeerId) {
          await connectLikeOrbitDbTests(s1bPublisher, relayPeerId, relayWsAddr)
          await connectLikeOrbitDbTests(s1bConsumer, relayPeerId, relayWsAddr)
        }
      }

      const s1bPublisherFs = unixfs(s1bPublisher.helia)
      const s1bConsumerFs = unixfs(s1bConsumer.helia)
      const s1bPayload = Buffer.from(`diag-s1b-${Date.now()}-${Math.random()}`)
      const s1bCid = await s1bPublisherFs.addBytes(s1bPayload)

      let s1bError
      try {
        await withTimeout(readAllBytes(s1bConsumerFs, s1bCid), 20_000, 'diag s1b consumer cat(cid)')
      } catch (err) {
        s1bError = err
      }
      expect(String(s1bError?.message || '')).to.include('timed out')
    } finally {
      await stopStack(s1bConsumer)
      await stopStack(s1bPublisher)
    }

    // Stage 2: publisher goes offline before consumer starts; consumer only dials relay.
    const s2Publisher = await createStack(join(tmpRoot, `diag-s2-publisher-${Date.now()}`), { localRoutingOnly: true })
    let s2Cid
    const s2Payload = Buffer.from(`diag-s2-${Date.now()}-${Math.random()}`)
    try {
      await s2Publisher.libp2p.dial(multiaddr(relayWsAddr))
      {
        const relayPeerId = getPeerIdFromAddr(relayWsAddr)
        if (relayPeerId) {
          await connectLikeOrbitDbTests(s2Publisher, relayPeerId, relayWsAddr)
        }
      }
      await ensureRelayReservation(s2Publisher, relayWsAddr)
      const s2PublisherFs = unixfs(s2Publisher.helia)
      s2Cid = await s2PublisherFs.addBytes(s2Payload)
    } finally {
      await stopStack(s2Publisher)
    }

    const s2Consumer = await createStack(join(tmpRoot, `diag-s2-consumer-${Date.now()}`), { localRoutingOnly: true })
    try {
      await s2Consumer.libp2p.dial(multiaddr(relayWsAddr))
      {
        const relayPeerId = getPeerIdFromAddr(relayWsAddr)
        if (relayPeerId) {
          await connectLikeOrbitDbTests(s2Consumer, relayPeerId, relayWsAddr)
        }
      }
      await ensureRelayReservation(s2Consumer, relayWsAddr)
      const s2ConsumerFs = unixfs(s2Consumer.helia)

      let s2Error
      try {
        await withTimeout(readAllBytes(s2ConsumerFs, s2Cid), 20_000, 'diag s2 consumer cat(cid) after publisher offline')
      } catch (err) {
        s2Error = err
      }
      expect(String(s2Error?.message || '')).to.include('timed out')
    } finally {
      await stopStack(s2Consumer)
    }
  })

  const maybeControl = RUN_CONTROL_TESTS ? it : it.skip

  maybeControl('control: direct online put/cat works with bitswap-only brokers', async () => {
    const a = await createStack(join(tmpRoot, `control-direct-a-${Date.now()}`), { localRoutingOnly: true })
    const b = await createStack(join(tmpRoot, `control-direct-b-${Date.now()}`), { localRoutingOnly: true })

    try {
      const aWs = getLocalWsAddr(a)
      await b.libp2p.dial(multiaddr(aWs))

      const aFs = unixfs(a.helia)
      const bFs = unixfs(b.helia)
      const payload = Buffer.from(`control-direct-${Date.now()}-${Math.random()}`)
      const cid = await aFs.addBytes(payload)
      const got = await withTimeout(readAllBytes(bFs, cid), 20_000, 'direct control cat(cid)')
      expect(got.equals(payload)).to.equal(true)
    } finally {
      await stopStack(b)
      await stopStack(a)
    }
  })

  maybeControl('control: 3-node helia path works without external relay process', async () => {
    const alice = await createStack(join(tmpRoot, `control-three-alice-${Date.now()}`), { localRoutingOnly: true })
    const relayNode = await createStack(join(tmpRoot, `control-three-relay-${Date.now()}`), { localRoutingOnly: true })
    const bob = await createStack(join(tmpRoot, `control-three-bob-${Date.now()}`), { localRoutingOnly: true })

    try {
      // Topology: Alice <-> RelayNode <-> Bob (no direct Alice <-> Bob).
      await relayNode.libp2p.dial(multiaddr(getLocalWsAddr(alice)))
      await bob.libp2p.dial(multiaddr(getLocalWsAddr(relayNode)))

      const aliceFs = unixfs(alice.helia)
      const relayFs = unixfs(relayNode.helia)
      const bobFs = unixfs(bob.helia)
      const payload = Buffer.from(`control-three-${Date.now()}-${Math.random()}`)
      const cid = await aliceFs.addBytes(payload)

      // Relay node actively fetches then pins the content.
      const relayFetched = await withTimeout(readAllBytes(relayFs, cid), 20_000, 'relayNode cat(cid)')
      expect(relayFetched.equals(payload)).to.equal(true)
      await relayNode.helia.pins.add(cid)

      // Alice goes offline; Bob should still fetch from relayNode.
      await stopStack(alice)
      const got = await withTimeout(readAllBytes(bobFs, cid), 20_000, 'bob cat(cid) via relayNode')
      expect(got.equals(payload)).to.equal(true)
    } finally {
      await stopStack(bob)
      await stopStack(relayNode)
      await stopStack(alice)
    }
  })

  maybeControl('control: relay path online put/cat still times out even with relay reservations', async () => {
    const a = await createStack(join(tmpRoot, `control-relay-a-${Date.now()}`), { localRoutingOnly: true })
    const b = await createStack(join(tmpRoot, `control-relay-b-${Date.now()}`), { localRoutingOnly: true })

    try {
      await a.libp2p.dial(multiaddr(relayWsAddr))
      await b.libp2p.dial(multiaddr(relayWsAddr))
      await ensureRelayReservation(a, relayWsAddr)
      await ensureRelayReservation(b, relayWsAddr)
      summarizeConnections('alice-after-reservation', a)
      summarizeConnections('bob-after-reservation', b)

      const aFs = unixfs(a.helia)
      const bFs = unixfs(b.helia)
      const payload = Buffer.from(`control-relay-${Date.now()}-${Math.random()}`)
      const cid = await aFs.addBytes(payload)

      const relayPeerId = getRelayPeerId()
      if (relayPeerId) {
        const relayInfo = await b.libp2p.peerStore.get(relayPeerId).catch(() => null)
        const protocols = relayInfo?.protocols || []
        const bitswapProtocols = protocols.filter((p) => p.includes('bitswap'))
        process.stdout.write(
          `[relay-test] relay protocols seen by consumer: total=${protocols.length} bitswap=${bitswapProtocols.join(',') || 'none'}\n`
        )
      }

      let relayFetchError
      try {
        await withTimeout(readAllBytes(bFs, cid), 30_000, 'relay-online control cat(cid)')
      } catch (err) {
        relayFetchError = err
      }
      expect(String(relayFetchError?.message || '')).to.include('timed out')

      const relayCircuitAddr = `${relayWsAddr}/p2p-circuit/p2p/${a.libp2p.peerId.toString()}`
      let explicitDialErr
      try {
        await b.libp2p.dial(multiaddr(relayCircuitAddr))
      } catch (err) {
        explicitDialErr = err
      }
      if (explicitDialErr) {
        process.stdout.write(`[relay-test] explicit relay-circuit dial failed: ${String(explicitDialErr)}\n`)
      } else {
        process.stdout.write(`[relay-test] explicit relay-circuit dial succeeded: ${relayCircuitAddr}\n`)
        summarizeConnections('alice-after-circuit-dial', a)
        summarizeConnections('bob-after-circuit-dial', b)

        const bitswapReachability = await tryDialBitswapOverRelay(b, relayCircuitAddr, a)
        const ok = bitswapReachability.find((r) => r.ok)
        if (ok) {
          process.stdout.write(`[relay-test] bitswap dial over relay succeeded via protocol: ${ok.proto}\n`)
        } else {
          process.stdout.write(
            `[relay-test] bitswap dial over relay failed for all protocols: ${JSON.stringify(bitswapReachability)}\n`
          )
        }
      }

      let postDialCatError
      try {
        const gotAfterDial = await withTimeout(readAllBytes(bFs, cid), 15_000, 'relay-online control cat(cid) after circuit dial')
        process.stdout.write(`[relay-test] cat after circuit dial success bytes=${gotAfterDial.length}\n`)
      } catch (err) {
        postDialCatError = err
      }
      if (postDialCatError) {
        process.stdout.write(`[relay-test] cat after circuit dial still failed: ${String(postDialCatError)}\n`)
      }
    } finally {
      await stopStack(b)
      await stopStack(a)
    }
  })
})
