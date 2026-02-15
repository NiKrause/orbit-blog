import { rm, access } from 'fs/promises'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { constants } from 'fs'

let relayProcess: ChildProcess | null = null;

// Keep these ports in sync with `playwright.config.ts` so the app bootstraps
// against the relay spawned by Playwright globalSetup.
const RELAY_TCP_PORT = 19091
const RELAY_WS_PORT = 19092
const RELAY_WEBRTC_PORT = 19093

function getRelayBinPath() {
    const binName = process.platform === 'win32' ? 'orbitdb-relay-pinner.cmd' : 'orbitdb-relay-pinner'
    return join(process.cwd(), 'node_modules', '.bin', binName)
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

export async function setupTestEnvironment() {
    console.log('Setting up test environment...');
    
    try {
        // Clean directories first
        await cleanDirectories();
        console.log('Directories cleaned successfully');

        // Start relay server with ES modules support
        console.log('Starting relay server...');
        await ensureRelayBuilt();
        const relayBinPath = getRelayBinPath()
        // Run the published relay CLI from node_modules (source lives in NiKrause/orbitdb-relay-pinner).
        relayProcess = spawn(relayBinPath, ['--test'], {
            stdio: ['inherit', 'pipe', 'pipe'],
            env: {
                ...process.env,
                DEBUG: 'le-space:*,libp2p:*',

                // Avoid collisions with a locally running relay that might be using the defaults.
                RELAY_TCP_PORT: String(RELAY_TCP_PORT),
                RELAY_WS_PORT: String(RELAY_WS_PORT),
                RELAY_WEBRTC_PORT: String(RELAY_WEBRTC_PORT),
                // The Node relay's WebRTC stack binds UDP sockets. In some environments (local sandboxing,
                // CI runners, parallel jobs) this can flake or be disallowed. The webapp connects to the
                // relay over WebSockets for tests, so keep the relay WS-only here.
                RELAY_DISABLE_WEBRTC: 'true',
                // Prevent CI flakes from port collisions (e.g. 9090 already bound on runners).
                METRICS_PORT: '0',

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
