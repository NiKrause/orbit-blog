import { rm, access } from 'fs/promises'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { constants } from 'fs'
import {
    LOCAL_RELAY_HTTP_PORT,
    LOCAL_RELAY_ORIGIN,
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
    const binName = process.platform === 'win32' ? 'orbitdb-relay-pinner.cmd' : 'orbitdb-relay-pinner'
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

async function waitForRelay(timeoutMs = 10000): Promise<boolean> {
    const startTime = Date.now();
    const readyMarkers = [
        // Might be logged via debug-style logger (can be disabled)
        'Starting relay server',
        // Always printed by the relay CLI after libp2p starts
        'p2p addr:'
    ];
    
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            // Check if process is still running
            if (relayProcess && relayProcess.exitCode !== null) {
                clearInterval(checkInterval);
                console.error('Relay process exited with code:', relayProcess.exitCode);
                resolve(false);
                return;
            }

            // Timeout check
            if (Date.now() - startTime > timeoutMs) {
                clearInterval(checkInterval);
                console.error('Timeout waiting for relay to start');
                resolve(false);
                return;
            }
        }, 100);

        // Also set up error handling
        if (relayProcess) {
            relayProcess.on('error', (err) => {
                clearInterval(checkInterval);
                console.error('Relay process error:', err);
                resolve(false);
            });

            const onData = (data: Buffer) => {
                // libp2p/debug-style logging often goes to stderr, so watch both streams.
                const text = data.toString();
                if (readyMarkers.some((m) => text.includes(m))) {
                    clearInterval(checkInterval);
                    console.log('Relay server started successfully');
                    resolve(true);
                }
            }

            relayProcess.stdout?.on('data', onData);
            relayProcess.stderr?.on('data', onData);
        }
    });
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
                DEBUG: 'le-space:*,libp2p:*',

                // Avoid collisions with a locally running relay that might be using the defaults.
                RELAY_TCP_PORT: String(LOCAL_RELAY_TCP_PORT),
                RELAY_WS_PORT: String(LOCAL_RELAY_WS_PORT),
                RELAY_WEBRTC_PORT: String(LOCAL_RELAY_WEBRTC_PORT),
                // Keep WebRTC enabled so browser peers can establish direct connections in e2e.
                RELAY_DISABLE_WEBRTC: 'false',
                // Local Playwright relay does not need public bootstrap peers; skipping them keeps logs quiet and startup tighter.
                RELAY_DISABLE_BOOTSTRAP: 'true',
                // Fixed test HTTP origin so Playwright can probe /health, /pinning/* and /ipfs/*.
                METRICS_PORT: String(LOCAL_RELAY_HTTP_PORT),
                // Keep the local relay peer id deterministic for Playwright seed addresses.
                TEST_PRIVATE_KEY: process.env.TEST_PRIVATE_KEY || LOCAL_RELAY_TEST_PRIVATE_KEY,

                // Make relay logs visible and useful in Playwright output.
                ENABLE_GENERAL_LOGS: 'true',
                ENABLE_SYNC_LOGS: 'true',
                ENABLE_SYNC_STATS: 'true',
                LOG_LEVEL_CONNECTION: 'true',
                LOG_LEVEL_PEER: 'true',
                LOG_LEVEL_DATABASE: 'true',
                LOG_LEVEL_SYNC: 'true',
            }
        });

        pipeChildOutput(relayProcess, 'relay');

        // Set up error handling
        relayProcess.on('error', (err) => {
            console.error('Failed to start relay process:', err);
            throw err;
        });

        // Wait for relay to start
        const started = await waitForRelay(30000);
        if (!started) {
            throw new Error('Failed to start relay server');
        }

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
            relayProcess.kill();
            relayProcess = null;
        }

        // Clean up directories
        await cleanDirectories();
        
        console.log('Test environment teardown completed');
    } catch (error) {
        console.error('Error during teardown:', error);
        throw error;
    }
}
