import { rm } from 'fs/promises'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

let relayProcess: ChildProcess | null = null;

async function waitForRelay(timeoutMs = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (relayProcess?.stdout) {
                // Check if process is still running
                if (relayProcess.exitCode !== null) {
                    clearInterval(checkInterval);
                    console.error('Relay process exited with code:', relayProcess.exitCode);
                    resolve(false);
                    return;
                }
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

            relayProcess.stdout?.on('data', (data) => {
                if (data.toString().includes('Starting relay server')) {
                    clearInterval(checkInterval);
                    console.log('Relay server started successfully');
                    resolve(true);
                }
            });
        }
    });
}

export async function setupTestEnvironment() {
    console.log('Setting up test environment...');
    
    try {
        // Clean directories first
        await cleanDirectories();
        console.log('Directories cleaned successfully');

        // Start relay server with ES modules support
        console.log('Starting relay server...');
        relayProcess = spawn('node', ['--experimental-specifier-resolution=node', 'src/relay.js'], {
            stdio: ['inherit', 'pipe', 'pipe'],
            env: {
                ...process.env,
                DEBUG: 'le-space:*,libp2p:*',
                NODE_OPTIONS: '--experimental-specifier-resolution=node'
            }
        });

        // Set up error handling
        relayProcess.on('error', (err) => {
            console.error('Failed to start relay process:', err);
            throw err;
        });

        relayProcess.stderr?.on('data', (data) => {
            console.error('Relay stderr:', data.toString());
        });

        // Wait for relay to start
        const started = await waitForRelay();
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
