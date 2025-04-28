import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    function updateSeedNodes(nodes: string) {
        config.seedNodes = nodes;
    }
    
    test.beforeAll(async ({ browser }) => {
        // let relayProcess: ChildProcessWithoutNullStreams;
        const relayPath = path.resolve(__dirname, '../dist/relay/index.js');
        let relayProcess = spawn('node', [relayPath, '--test'], {
            env: {
                ...process.env,
                NODE_ENV: 'test',
                // DEBUG: 'le-space:*'
            },
            stdio: 'inherit'
        });

        
        // Create fresh test directory
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
            expect(peerCount).toBeGreaterThanOrEqual(1);
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
            await pageAlice.getByTestId('post-title-input').fill(post.title);
            await pageAlice.getByTestId('post-content-input').fill(post.content);
            await pageAlice.getByTestId('category-select').selectOption(post.category);
            await pageAlice.locator('#publish').check();
            await pageAlice.getByTestId('publish-post-button').click();
            
            // Add an initial delay after clicking publish
            await pageAlice.waitForTimeout(2000);
            
            // Add wait for the post to appear in the list with increased timeout
            await expect(async () => {
                const postElements = await pageAlice.getByTestId('post-item-title').all();
                const postTitles = await Promise.all(postElements.map(el => el.textContent()));
                expect(postTitles).toContain(post.title);
            }).toPass({ timeout: 20000 }); // Increased timeout to 20 seconds

            // Add additional delay after confirmation to ensure DB processing
            await pageAlice.waitForTimeout(2000);
        }

        // Replace the simple posts check with a retry mechanism
        await expect(async () => {
            const posts = await pageAlice.getByTestId('post-item-title').all();
            expect(posts).toHaveLength(2);
            
            // Verify both post titles are present
            const postTitles = await Promise.all(
                posts.map(post => post.textContent())
            );
            expect(postTitles).toContain("The Birth of a Musical Genius");
            expect(postTitles).toContain("The Well-Tempered Clavier");
        }).toPass({ timeout: 30000 });

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
        await expect(pageBob.getByTestId('loading-overlay')).toBeVisible();
        await expect(pageBob.getByTestId('blog-name')).toHaveText('Bach Chronicles');
        const posts = await pageBob.getByTestId('post-item-title').all();
        const postTitles = await Promise.all(posts.map(post => post.textContent()));
        expect(postTitles).toContain("The Birth of a Musical Genius");
        expect(postTitles).toContain("The Well-Tempered Clavier");
        for (const post of posts) {
            const postTitle = await post.textContent();
            console.log('postTitle', postTitle);
            await expect(post).toBeVisible();
        }

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
    });
}); 