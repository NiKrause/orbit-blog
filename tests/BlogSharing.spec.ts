import { test, expect, chromium } from '@playwright/test';
import { join } from 'path';
import { rm, mkdir } from 'fs/promises';
import createDaemon from '@le-space/voyager/src/daemon.js';

const config = {
    seedNodes: process.env.VITE_P2P_PUPSUB_DEV || ''
};
        

test.describe('Blog Sharing between Alice and Bob', () => {
    
    let pageAlice;
    let pageBob;
    let aliceBlogAddress;
    let daemon;
    let wsAddr;
    let contextAlice;  // Separate context for Alice
    let contextBob;    // Separate context for Bob
    const testDir = join(process.cwd(), 'test-voyager-' + Date.now());

    function updateSeedNodes(nodes: string) {
        config.seedNodes = nodes;
    }
    
    test.beforeAll(async ({ browser }) => {
        // Create fresh test directory
        // await rm(testDir, { recursive: true, force: true });
        // await mkdir(testDir, { recursive: true });
        // // Initialize the daemon with test configuration
        // daemon = await createDaemon({
        //     options: {
        //         disableAutoTLS: true,
        //         directory: testDir,
        //         port: 9091, // Random port for API
        //         wsport: 9092, // Random port for WebSocket
        //         allow: true, // Allow all connections
        //         verbose: 1, // Enable basic logging
        //         metrics: true, // Enable metrics
        //         staging: true, // Use staging configuration
        //         ip4: '127.0.0.1', // Bind to localhost
        //         ip6: '::1'
        //     }
        // });
        
        // // Get the WebSocket address from the daemon
        // wsAddr = daemon.libp2p.getMultiaddrs()
        //     .map(addr => addr.toString())
        //     .join(',');
        // console.log('wsAddr', wsAddr);
        // const peerId = daemon.libp2p.peerId.toString();
        // console.log('peerId', peerId);
        // if (!wsAddr) {
        //     throw new Error('Failed to get WebSocket address from daemon');
        // }

        // Initialize browser context for Alice
        contextAlice = await browser.newContext({
            ignoreHTTPSErrors: true,
            launchOptions: {
                args: [
                    '--allow-insecure-localhost',
                    '--unsafely-treat-insecure-origin-as-secure=ws://localhost:9092',
                    '--disable-web-security'
                ]
            }
        });

        // Initialize browser context for Bob
        contextBob = await browser.newContext({
            ignoreHTTPSErrors: true,
            launchOptions: {
                args: [
                    '--allow-insecure-localhost',
                    '--unsafely-treat-insecure-origin-as-secure=ws://localhost:9092',
                    '--disable-web-security'
                ]
            }
        });
    });

    test('Alice creates Bach blog and gets the database address', async () => {
        pageAlice = await contextAlice.newPage();
        await pageAlice.goto('http://localhost:5173');
        await pageAlice.evaluate(() => {
            localStorage.setItem('debug', 'libp2p:*,le-space:*');
        });

        await expect(async () => {
            const peersHeader = await pageAlice.getByTestId('peers-header').textContent();
            const peerCount = parseInt(peersHeader.match(/\((\d+)\)/)[1]);
            console.log('peerCount', peerCount);
            expect(peerCount).toBeGreaterThanOrEqual(2);
        }).toPass({ timeout: 60000 }); // Give it up to 30 seconds to connect to peers
        // First, let's run the existing blog setup test
        const blogName = await pageAlice.getByTestId('blog-name').textContent();
        const blogDescription = await pageAlice.getByTestId('blog-description').textContent();
        
        await expect(pageAlice.getByTestId('blog-name')).toBeVisible();
        await expect(pageAlice.getByTestId('blog-description')).toBeVisible();
        
        // Configure blog settings
        await pageAlice.getByTestId('settings-header').click();
        await pageAlice.getByTestId('blog-settings-accordion').click();
        await pageAlice.getByTestId('blog-name-input').fill('Bach Chronicles');
        await pageAlice.getByTestId('blog-description-input').fill('Exploring the life and works of Johann Sebastian Bach');

        // Add categories
        await pageAlice.getByTestId('categories').click();
        const categories = ['General', 'Live', 'Works', 'Music'];
        for (const category of categories) {
            await pageAlice.getByTestId('new-category-input').fill(category);
            await pageAlice.getByTestId('add-category-button').click();
        }

        // Create posts about Bach
        const bachPosts = [
            {
                title: "The Birth of a Musical Genius",
                content: "Johann Sebastian Bach was born in Eisenach, Germany in 1685...",
                category: "Music"
            },
            {
                title: "The Well-Tempered Clavier",
                content: "One of Bach's most influential works, The Well-Tempered Clavier, demonstrates his mastery of counterpoint and harmony.",
                category: "Music"
            }
        ];

        for (const post of bachPosts) {
            // await pageAlice.getByTestId('new-post-link').click();
            await pageAlice.getByTestId('post-title-input').fill(post.title);
            await pageAlice.getByTestId('post-content-input').fill(post.content);
            await pageAlice.getByTestId('category-select').selectOption(post.category);
            await pageAlice.getByTestId('publish-post-button').click();
        }

        // Get the database address from DBManager
        await pageAlice.getByTestId('menu-button').click();
        await pageAlice.getByTestId('blogs-header').click();
        await pageAlice.getByTestId('db-manager-container').waitFor({ state: 'visible' });
        
        // Verify the database address input is visible and has a value
        const dbAddressInput = pageAlice.getByTestId('db-address-input');
        await expect(dbAddressInput).toBeVisible();
        aliceBlogAddress = await dbAddressInput.inputValue();
        
        // Verify the address is a valid OrbitDB address
        expect(aliceBlogAddress).toBeTruthy();
        expect(aliceBlogAddress).toMatch(/^\/orbitdb\/[a-zA-Z0-9]+$/);
        
        // Copy the address to clipboard for Bob to use
        await pageAlice.getByTestId('copy-db-address-button').click();
        // await pageAlice.
    });

    test('Bob opens Alice\'s blog and waits for replication', async () => {
        pageBob = await contextBob.newPage();
    
        await pageBob.goto(`http://localhost:5173/#${aliceBlogAddress}`);
        await pageBob.evaluate(() => {
            localStorage.setItem('debug', 'libp2p:*,le-space:*');
        });

        // Check initial loading state
        // await expect(pageBob.getByTestId('loading-overlay')).toBeVisible();
        
        // Check loading states in sequence
        await expect(async () => {
            const loadingMessage = await pageBob.getByTestId('loading-message').textContent();
            expect(loadingMessage).toMatch(/initializing|connecting to peers/i);
        }).toPass();



        // // Check database loading states
        await expect(async () => {
            const loadingMessage = await pageBob.getByTestId('loading-message').textContent();
            expect(loadingMessage).toMatch(/identifying database|Identifying database.../i);
        }).toPass();

        await expect(async () => {
            const loadingMessage = await pageBob.getByTestId('loading-message').textContent();
            expect(loadingMessage).toMatch(/identifying database|Opening database.../i);
        }).toPass();
        
        // await expect(async () => {
        //     const loadingMessage = await pageBob.getByTestId('loading-message').textContent();
        //     expect(loadingMessage).toMatch(/identifying database|loading blog settings/i);
        // }).toPass();

        // // // Check content loading states
        // await expect(async () => {
        //     const loadingMessage = await pageBob.getByTestId('loading-message').textContent();
        //     expect(loadingMessage).toMatch(/loading posts|loading comments|loading media/i);
        // }).toPass();

        // // Check loading completion
        // await expect(async () => {
        //     const loadingMessage = await pageBob.getByTestId('loading-message').textContent();
        //     expect(loadingMessage).toMatch(/complete|loaded successfully/i);
        // }).toPass();

        // Verify loading overlay disappears
        // await expect(pageBob.getByTestId('loading-overlay')).not.toBeVisible();
        
        // Wait for peer connections
        await expect(async () => {
            const peersHeader = await pageBob.getByTestId('peers-header').textContent();
            const peerCount = parseInt(peersHeader.match(/\((\d+)\)/)[1]);
            console.log('peerCount', peerCount);
            expect(peerCount).toBeGreaterThanOrEqual(2);
        }).toPass({ timeout: 30000 }); // Give it up to 30 seconds to connect to peers

        // Verify the final state
        await expect(pageBob.getByTestId('blog-name')).toHaveText('Bach Chronicles');
    });

    test.afterAll(async () => {
        // await pageAlice.close();
        // await pageBob.close();
        // await contextAlice.close();  // Close Alice's context
        // await contextBob.close();    // Close Bob's context
        
        // Cleanup daemon
        if (daemon) {
            // await daemon.stop();
        }
        await rm(testDir, { recursive: true, force: true });
    });
}); 