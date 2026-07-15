import { rm, access } from 'fs/promises'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { constants } from 'fs'
import {
    LOCAL_RELAY_HTTP_PORT,
    LOCAL_RELAY_ORIGIN,
    LOCAL_RELAY_QUIC_PORT,
    LOCAL_RELAY_TEST_PRIVATE_KEY,
    LOCAL_RELAY_TCP_PORT,
    LOCAL_RELAY_WEBRTC_PORT,
    LOCAL_RELAY_WS_PORT,
    getPrimaryRelayOrigin,
    getRelayTargetLabel,
    getRelayTestMode,
    shouldSpawnLocalRelay,
} from './relayTestEnv'

let relayProcess: ChildProcess | null = null;

type RelayLaunchTarget = {
    binPath: string;
    source: string;
};

function getRelayLaunchTarget(): RelayLaunchTarget {
    const binName = process.platform === 'win32' ? 'orbitdb-relay.cmd' : 'orbitdb-relay'
    return {
        binPath: join(process.cwd(), 'node_modules', '.bin', binName),
        source: 'node_modules/.bin',
    };
}

function getRelayBinPath() {
    return getRelayLaunchTarget().binPath
}

function pipeChildOutput(child: ChildProcess, prefix: string) {
    const write = (stream: NodeJS.WriteStream, data: Buffer) => {
        // Prefix each chunk; good enough for test logs without heavy line buffering.
        stream.write(`[${prefix}] ${data.toString()}`);
    };

    if (child.stdout) child.stdout.on('data', (d: Buffer) => write(process.stdout, d));
    if (child.stderr) child.stderr.on('data', (d: Buffer) => write(process.stderr, d));
}

async function ensureRelayBuilt() {
    const binPath = getRelayBinPath()
    await access(binPath, constants.F_OK)
}

async function waitForRelayHttp(url: string, timeoutMs = 10000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime <= timeoutMs) {
        try {
            const response = await fetch(url, { method: 'GET' });
            if (response.ok) return true;
        } catch {
            // Relay HTTP server may still be binding; keep polling.
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return false;
}

export async function setupTestEnvironment() {
    console.log(`Setting up test environment (${getRelayTestMode()} relay mode)...`);
    
    try {
        // Clean directories first
        await cleanDirectories();
        console.log('Directories cleaned successfully');

        if (!shouldSpawnLocalRelay()) {
            console.log(`Skipping local relay startup; using external target ${getRelayTargetLabel()} (${getPrimaryRelayOrigin()})`);
            console.log('Test environment setup completed');
            return;
        }

        // Start relay server with ES modules support
        console.log('Starting relay server...');
        await ensureRelayBuilt();
        const relayLaunchTarget = getRelayLaunchTarget();
        const relayBinPath = relayLaunchTarget.binPath
        console.log(`Using relay CLI from ${relayLaunchTarget.source}: ${relayBinPath}`);
        relayProcess = spawn(relayBinPath, ['--test'], {
            stdio: ['inherit', 'pipe', 'pipe'],
            env: {
                ...process.env,
                DEBUG: 'le-space:relay:error,libp2p:identify:error,libp2p:identify-push:error',

                // Avoid collisions with a locally running relay that might be using the defaults.
                RELAY_TCP_PORT: String(LOCAL_RELAY_TCP_PORT),
                RELAY_WS_PORT: String(LOCAL_RELAY_WS_PORT),
                RELAY_QUIC_PORT: String(LOCAL_RELAY_QUIC_PORT),
                RELAY_WEBRTC_PORT: String(LOCAL_RELAY_WEBRTC_PORT),
                // Keep WebRTC enabled so browser peers can establish direct connections in e2e.
                RELAY_DISABLE_WEBRTC: 'false',
                // Local Playwright relay does not need public bootstrap peers; skipping them keeps logs quiet and startup tighter.
                RELAY_DISABLE_BOOTSTRAP: 'true',
                // Keep local E2E replication on the already-connected browser peer.
                // Empty public routing tables otherwise add repeated 10s DHT/AutoNAT
                // waits to every OrbitDB manifest/block lookup.
                RELAY_DISABLE_DHT: 'true',
                RELAY_DISABLE_AUTONAT: 'true',
                RELAY_DISABLE_QUIC: 'true',
                RELAY_DISABLE_IPV6: 'true',
                // Fixed test HTTP origin so Playwright can probe /health, /pinning/* and /ipfs/*.
                METRICS_PORT: String(LOCAL_RELAY_HTTP_PORT),
                // Keep the local relay peer id deterministic for Playwright seed addresses.
                TEST_PRIVATE_KEY: process.env.TEST_PRIVATE_KEY || LOCAL_RELAY_TEST_PRIVATE_KEY,

                // Keep CI output focused; Playwright records page/trace context on failure.
                ENABLE_GENERAL_LOGS: 'false',
                ENABLE_SYNC_LOGS: 'false',
                ENABLE_SYNC_STATS: 'false',
                LOG_LEVEL_CONNECTION: 'false',
                LOG_LEVEL_PEER: 'false',
                LOG_LEVEL_DATABASE: 'false',
                LOG_LEVEL_SYNC: 'false',
            }
        });

        pipeChildOutput(relayProcess, 'relay');

        // Set up error handling
        relayProcess.on('error', (err) => {
            console.error('Failed to start relay process:', err);
            throw err;
        });

        // Probe the actual HTTP health endpoint instead of depending on optional
        // debug-log markers from the relay process.
        const httpReady = await waitForRelayHttp(`${LOCAL_RELAY_ORIGIN}/health`, 30000);
        if (!httpReady) {
            throw new Error(`Relay HTTP endpoint did not become ready at ${LOCAL_RELAY_ORIGIN}/health`);
        }

        console.log('Test environment setup completed');
    } catch (error) {
        console.error('Error during setup:', error);
        // Attempt cleanup
        await teardownTestEnvironment();
        throw error;
    }
}

export async function cleanDirectories() {
    const directories = [
        'orbitdb',
        'pinning-service'
    ];

    console.log('Cleaning directories:', directories);

    for (const dir of directories) {
        try {
            await rm(dir, { recursive: true, force: true });
            console.log(`Cleaned directory: ${dir}`);
        } catch (error: any) {
            if (error.code !== 'ENOENT') {
                console.error(`Error cleaning directory ${dir}:`, error);
                throw error;
            } else {
                console.log(`Directory ${dir} did not exist, skipping`);
            }
        }
    }
}

export async function teardownTestEnvironment() {
    console.log('Tearing down test environment...');

    try {
        // Kill relay process if it exists
        if (relayProcess) {
            console.log('Stopping relay process...');
            const processToStop = relayProcess;
            relayProcess = null;

            if (processToStop.exitCode === null && processToStop.signalCode === null) {
                const exited = new Promise<void>((resolve) => {
                    processToStop.once('exit', () => resolve());
                });

                processToStop.kill('SIGTERM');

                const stoppedGracefully = await Promise.race([
                    exited.then(() => true),
                    new Promise<false>((resolve) => setTimeout(() => resolve(false), 5000)),
                ]);

                if (!stoppedGracefully && processToStop.exitCode === null) {
                    console.warn('Relay did not stop after SIGTERM; sending SIGKILL...');
                    processToStop.kill('SIGKILL');
                    await Promise.race([
                        exited,
                        new Promise<void>((resolve) => setTimeout(resolve, 3000)),
                    ]);
                }
            }
        }

        // Clean up directories
        await cleanDirectories();
        
        console.log('Test environment teardown completed');
    } catch (error) {
        console.error('Error during teardown:', error);
        throw error;
    }
}
