import { createServer } from 'node:net';
import { createSocket } from 'node:dgram';
import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RELAY_START_TIMEOUT_MS = 45_000;

const HOST = '127.0.0.1';

const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, HOST);
  });

const isUdpPortFree = (port) =>
  new Promise((resolve) => {
    const socket = createSocket('udp4');
    socket.once('error', () => {
      socket.close();
      resolve(false);
    });
    socket.once('listening', () => {
      socket.close();
      resolve(true);
    });
    socket.bind(port);
  });

const findFreePort = async (start, end, excluded = new Set()) => {
  for (let port = start; port <= end; port += 1) {
    if (excluded.has(port)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free TCP port found in range ${start}-${end}`);
};

const findFreeUdpPort = async (start, end) => {
  for (let port = start; port <= end; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isUdpPortFree(port)) return port;
  }
  throw new Error(`No free UDP port found in range ${start}-${end}`);
};

const normalizeRelayAddr = (addr) => {
  if (addr.includes('/ip4/0.0.0.0/')) {
    return addr.replace('/ip4/0.0.0.0/', '/ip4/127.0.0.1/');
  }
  if (addr.includes('/ip6/::/')) {
    return addr.replace('/ip6/::/', '/ip6/::1/');
  }
  return addr;
};

const extractRelayAddr = (line) => {
  const match = line.match(/\/ip[46]\/[^\s,'"]+\/ws\/p2p\/[A-Za-z0-9]+/);
  if (!match) return null;
  return normalizeRelayAddr(match[0]);
};

const killProcessTree = (proc) => {
  if (!proc || proc.killed) return;
  proc.kill('SIGTERM');
};

const startRelay = (env) =>
  new Promise((resolve, reject) => {
    const relay = spawn('node', ['dist/relay/index.js', '--test'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let settled = false;
    let relayAddr = null;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      killProcessTree(relay);
      reject(new Error('Timed out waiting for local relay startup'));
    }, RELAY_START_TIMEOUT_MS);

    const maybeResolve = () => {
      if (settled || !relayAddr) return;
      settled = true;
      clearTimeout(timer);
      resolve({ relay, relayAddr });
    };

    relay.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(`[relay] ${text}`);
      if (!relayAddr) {
        relayAddr = extractRelayAddr(text);
      }
      maybeResolve();
    });

    relay.stderr.on('data', (chunk) => {
      process.stderr.write(`[relay] ${chunk}`);
    });

    relay.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    relay.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Relay exited early with code ${code ?? 1}`));
    });
  });

const run = async () => {
  const relayDataDir = process.env.MOCHA_RELAY_DATA_DIR || join(tmpdir(), `le-space-relay-mocha-${process.pid}-${Date.now()}`);
  const relayTcpPort = await findFreePort(10091, 12091);
  const relayWsPort = await findFreePort(10092, 12092, new Set([relayTcpPort]));
  const relayWebRtcPort = await findFreeUdpPort(9093, 9393);

  const relayResult = await startRelay({
    ...process.env,
    DEBUG: process.env.DEBUG || 'libp2p:relay:*,le-space:relay*',
    METRICS_PORT: process.env.METRICS_PORT || '0',
    RELAY_DATA_DIR: relayDataDir,
    RELAY_TCP_PORT: String(relayTcpPort),
    RELAY_WS_PORT: String(relayWsPort),
    RELAY_WEBRTC_PORT: String(relayWebRtcPort)
  });

  const relay = relayResult.relay;
  const relayAddr = relayResult.relayAddr;
  console.log(`[mocha] local relay address: ${relayAddr}`);

  const stop = async () => {
    killProcessTree(relay);
    // Give the relay a moment to exit cleanly before removing its data dir.
    await sleep(250);
    try {
      await rm(relayDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  };

  try {
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn('npx', ['mocha', '--exit', 'test/**/*.test.js'], {
        env: {
          ...process.env,
          VITE_SEED_NODES_DEV: relayAddr,
          VITE_SEED_NODES: relayAddr
        },
        stdio: 'inherit'
      });

      child.on('error', reject);
      child.on('close', (code) => resolve(code ?? 1));
    });

    await stop();
    process.exit(exitCode);
  } catch (err) {
    await stop();
    throw err;
  }
};

run().catch((err) => {
  console.error(`[mocha] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
