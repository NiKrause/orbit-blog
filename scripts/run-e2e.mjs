import { createServer } from 'node:net';
import { createSocket } from 'node:dgram';
import { request } from 'node:http';
import { spawn } from 'node:child_process';
import { access, rm } from 'node:fs/promises';

const HOST = '127.0.0.1';
const PORT_START = 5173;
const PORT_END = 5273;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RELAY_START_TIMEOUT_MS = 45_000;
const TEST_DATA_DIRS = ['orbitdb', 'helia-data', 'helia-blocks'];

const isPortFree = (port) =>
  new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    // Bind on all interfaces to catch wildcard/IPv6 listeners too.
    server.listen(port);
  });

const findFreePort = async (start, end) => {
  for (let port = start; port <= end; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error(`No free port found in range ${start}-${end}`);
};

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

    // Bind on all interfaces to catch wildcard listeners.
    socket.bind(port);
  });

const findFreeUdpPort = async (start, end) => {
  for (let port = start; port <= end; port += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isUdpPortFree(port)) {
      return port;
    }
  }
  throw new Error(`No free UDP port found in range ${start}-${end}`);
};

const findFreePortExcluding = async (start, end, excluded = new Set()) => {
  for (let port = start; port <= end; port += 1) {
    if (excluded.has(port)) continue;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error(`No free TCP port found in range ${start}-${end} excluding ${[...excluded].join(',')}`);
};

const waitForHttp = async (url, timeoutMs = 45_000) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const req = request(url, { method: 'GET', timeout: 1500 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    });

    if (ok) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(250);
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const killProcessTree = (proc) => {
  if (!proc || proc.killed) return;
  proc.kill('SIGTERM');
};

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      ...options
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 1}`));
      }
    });
  });

const cleanupTestData = async () => {
  if (process.env.E2E_CLEAN_DATA === '0') {
    return;
  }

  for (const dir of TEST_DATA_DIRS) {
    try {
      // Remove local test data directories created by Helia/OrbitDB.
      // `force: true` avoids failing teardown when a directory does not exist.
      // eslint-disable-next-line no-await-in-loop
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[e2e] failed to cleanup ${dir}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
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
  const freePort = await findFreePort(PORT_START, PORT_END);
  const baseUrl = `http://${HOST}:${freePort}`;
  const relayTcpPort = await findFreePort(10091, 12091);
  const relayWsPort = await findFreePortExcluding(10092, 12092, new Set([relayTcpPort]));
  const relayWebRtcPort = await findFreeUdpPort(9093, 9393);
  const playwrightArgs = process.argv.slice(2);
  let vite;
  let relay;

  console.log(`[e2e] using base URL: ${baseUrl}`);
  console.log('[e2e] building relay...');
  try {
    await runCommand('npm', ['run', 'build:relay']);
  } catch (err) {
    try {
      await access('dist/relay/index.js');
      console.warn(
        `[e2e] relay build failed, using existing dist/relay output: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } catch {
      throw err;
    }
  }
  console.log('[e2e] starting local relay...');

  const relayResult = await startRelay({
    ...process.env,
    DEBUG: process.env.DEBUG || 'libp2p:relay:*,le-space:relay*',
    METRICS_PORT: process.env.METRICS_PORT || '0',
    RELAY_TCP_PORT: String(relayTcpPort),
    RELAY_WS_PORT: String(relayWsPort),
    RELAY_WEBRTC_PORT: String(relayWebRtcPort)
  });

  relay = relayResult.relay;
  const relayAddr = relayResult.relayAddr;
  console.log(`[e2e] local relay address: ${relayAddr}`);

  vite = spawn(
    'npx',
    ['vite', '--host', HOST, '--port', String(freePort), '--strictPort'],
    {
      env: {
        ...process.env,
        // Used by the app to expose small test hooks for Playwright.
        VITE_E2E: process.env.VITE_E2E || '1',
        VITE_SEED_NODES_DEV: relayAddr,
        VITE_SEED_NODES: relayAddr
      },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );

  vite.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`));
  vite.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`));

  const stop = () => {
    killProcessTree(vite);
    killProcessTree(relay);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  try {
    await waitForHttp(baseUrl);
  } catch (err) {
    stop();
    throw err;
  }

  try {
    const testExitCode = await new Promise((resolve, reject) => {
      const child = spawn(
        'npx',
        ['playwright', 'test', ...playwrightArgs],
        {
          env: {
            ...process.env,
            E2E_BASE_URL: baseUrl,
            E2E_MANAGED_SERVER: '1'
          },
          stdio: 'inherit'
        }
      );

      child.on('error', reject);
      child.on('close', (code) => resolve(code ?? 1));
    });
    stop();
    await cleanupTestData();
    process.exit(testExitCode);
  } catch (err) {
    stop();
    await cleanupTestData();
    throw err;
  }
};

run().catch((err) => {
  console.error(`[e2e] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
