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

function getRelayBinPath() {
  const binName = process.platform === 'win32' ? 'orbitdb-relay-pinner.cmd' : 'orbitdb-relay-pinner'
  return join(process.cwd(), 'node_modules', '.bin', binName)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function ladderLog(stage, message) {
  process.stdout.write(`[relay-test] [ladder:${stage}] ${message}\n`)
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

  it('pins media CIDs on relay and consumer fetches them after publisher goes offline', async () => {
    ladderLog('full', 'START media pinning integration')
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
    ladderLog('full', 'DONE publisher connected to relay and reserved circuit')

    const pubFs = unixfs(publisher.helia)
    const logoBytes = Buffer.from(`logo-${Date.now()}-${Math.random()}`)
    const mediaBytes = Buffer.from(`media-${Date.now()}-${Math.random()}`)

    const logoCid = await pubFs.addBytes(logoBytes)
    const mediaCid = await pubFs.addBytes(mediaBytes)
    const logoCidStr = logoCid.toString()
    const mediaCidStr = mediaCid.toString()
    ladderLog('full', `DONE publisher added media bytes logoCid=${logoCidStr} mediaCid=${mediaCidStr}`)

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
    ladderLog('full', 'DONE OrbitDB records written (settings/media/posts)')

    const settingsAddress = settingsDb.address.toString()
    const postsAddress = postsDb.address.toString()
    const mediaAddress = mediaDb.address.toString()

    await waitFor(async () => {
      const logs = relayLogs.join('\n')
      return (
        logs.includes(`Read records from database: ${settingsAddress}`) &&
        logs.includes(`Read records from database: ${postsAddress}`) &&
        logs.includes(`Read records from database: ${mediaAddress}`) &&
        logs.includes('Sample record from posts') &&
        logs.includes('Sample record from media')
      )
    }, 120_000)
    ladderLog('full', `DONE relay observed DB sync and pinning signals for ${settingsAddress}`)
    await waitFor(async () => {
      const logs = relayLogs.join('\n')
      return logs.includes(`Pinned image CID: ${logoCidStr}`) && logs.includes(`Pinned image CID: ${mediaCidStr}`)
    }, 120_000)
    ladderLog('full', `DONE relay pinned both CIDs logo=${logoCidStr} media=${mediaCidStr}`)

    await settingsDb.close()
    await postsDb.close()
    await commentsDb.close()
    await mediaDb.close()
    await stopStack(publisher)
    publisher = null
    ladderLog('full', 'DONE publisher stopped (Alice offline)')

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
    ladderLog('full', 'DONE consumer connected to relay and reserved circuit')

    const conFs = unixfs(consumer.helia)
    ladderLog('full', 'DONE setup complete (consumer will fetch logo + media)')
    const logoFetched = await withTimeout(readAllBytes(conFs, logoCid), 20_000, 'consumer cat(logoCid)')
    const mediaFetched = await withTimeout(readAllBytes(conFs, mediaCid), 20_000, 'consumer cat(mediaCid)')
    expect(Buffer.from(logoFetched).equals(logoBytes)).to.equal(true)
    expect(Buffer.from(mediaFetched).equals(mediaBytes)).to.equal(true)
    ladderLog('full', 'DONE consumer fetched both CIDs after publisher offline')
  })
})
