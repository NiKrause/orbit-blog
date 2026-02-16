import { test, expect, chromium } from '@playwright/test';

const config = {
    seedNodes: process.env.VITE_P2P_PUPSUB_DEV || ''
};

function parsePeersCount(text: string | null): number {
    if (!text) throw new Error('peers-header has no text');
    const match = text.match(/\((\d+)\)|\b(\d+)\b/);
    const count = Number(match?.[1] ?? match?.[2]);
    if (Number.isNaN(count)) throw new Error(`unable to parse peers count from: "${text}"`);
    return count;
}

async function expectPeerCount(page, expected, timeoutMs = 90000) {
    await expect(async () => {
        await ensurePeersHeaderVisible(page);
        const peersHeader = await page.getByTestId('peers-header').textContent();
        const peerCount = parsePeersCount(peersHeader);
        expect(peerCount).toBe(expected);
    }).toPass({ timeout: timeoutMs });
}

async function expectHasWebRTCTransport(page, timeoutMs = 90000) {
    await ensurePeersHeaderVisible(page);
    const peersList = page.getByTestId('peers-list');
    await expect(async () => {
        const isOpen = await peersList.isVisible().catch(() => false);
        if (!isOpen) {
            // Avoid Playwright actionability flake when sidebar rerenders and the header detaches.
            await page.evaluate(() => {
                const header = document.querySelector('[data-testid="peers-header"]') as HTMLElement | null;
                header?.click();
            });
        }
        await expect(peersList).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await expect(page.getByTestId('peers-list')).toContainText('WebRTC', { timeout: timeoutMs });
}

async function ensurePeersHeaderVisible(page, timeoutMs = 30000) {
    const peersHeader = page.getByTestId('peers-header');
    if (await peersHeader.isVisible().catch(() => false)) return;

    const menuButton = page.getByTestId('menu-button');
    if (await menuButton.isVisible().catch(() => false)) {
        await menuButton.click();
    }

    await expect(peersHeader).toBeVisible({ timeout: timeoutMs });
}
        

test.describe('Blog Sharing between Alice and Bob', () => {
    // This file shares mutable state across tests (aliceBlogAddress, pageAlice/pageBob),
    // so it must run serially.
    test.describe.configure({ mode: 'serial' });
    
    let pageAlice;
    let pageBob;
    let aliceBlogAddress;
    let daemon;
    let wsAddr;
    let contextAlice;  // Separate context for Alice
    let contextBob;    // Separate context for Bob

    async function closeSidebarOverlayIfPresent(page) {
        const overlay = page.locator('[aria-label="close_sidebar"]').first();
        if (await overlay.count() === 0) return;
        if (await overlay.isVisible().catch(() => false)) {
            await overlay.click({ force: true, timeout: 3000 }).catch(() => {});
        }
    }

    function updateSeedNodes(nodes: string) {
        config.seedNodes = nodes;
    }
    
    test.beforeAll(async ({ browser }) => {
        // Create fresh test directory
        contextAlice = await browser.newContext({
            ignoreHTTPSErrors: true,
            launchOptions: {
                args: [
                    '--allow-insecure-localhost',
                    '--unsafely-treat-insecure-origin-as-secure=ws://localhost:19092',
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
                    '--unsafely-treat-insecure-origin-as-secure=ws://localhost:19092',
                    '--disable-web-security'
                ]
            }
        });
    });

    test('Alice creates Bach blog and gets the database address', async () => {
        pageAlice = await contextAlice.newPage();
        pageAlice.on('console', msg => {
            console.log('BROWSER LOG:', msg.text());
        });
        pageAlice.on('pageerror', err => {
            console.error('PAGE ERROR:', err.message);
            if (err.stack) console.error(err.stack);
        });
        await pageAlice.goto('http://localhost:5173');
        await pageAlice.evaluate(() => {
            localStorage.setItem('debug', 'libp2p:*,le-space:*');
        });

        await expect(async () => {
            const peersHeader = await pageAlice.getByTestId('peers-header').textContent();
            const peerCount = parsePeersCount(peersHeader);
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
        // Settings render in main content; close the sidebar overlay so it doesn't intercept clicks.
        const closeSidebarOverlay = pageAlice.locator('[aria-label="close_sidebar"]');
        if (await closeSidebarOverlay.isVisible()) {
            await closeSidebarOverlay.click();
        }
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
            // Category selection is a custom MultiSelect with id="categories"
            await pageAlice.locator('#categories [role="button"]').click();
            await pageAlice.locator('#categories').getByRole('button', { name: post.category, exact: true }).click();
            // Close dropdown so it doesn't cover other controls
            await pageAlice.locator('#categories [role="button"]').click();
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
        // DBManager is in main content, close sidebar overlay so buttons are clickable.
        const closeSidebarOverlay2 = pageAlice.locator('[aria-label="close_sidebar"]');
        if (await closeSidebarOverlay2.isVisible()) {
            await closeSidebarOverlay2.click();
        }
        
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
        pageBob.on('console', msg => {
            console.log('BROWSER LOG:', msg.text());
        }); 
        pageBob.on('pageerror', err => {
            console.error('PAGE ERROR:', err.message);
            if (err.stack) console.error(err.stack);
        });
        await pageBob.goto(`http://localhost:5173/#${aliceBlogAddress}`);
        await pageBob.evaluate(() => {
            localStorage.setItem('debug', 'libp2p:*,le-space:*');
        });
        await expect(pageBob.getByTestId('loading-overlay')).toBeVisible({ timeout: 30000 });
        // Remote blog load can take a while depending on replication/bootstrap timing.
        await expect(pageBob.getByTestId('loading-overlay')).toBeHidden({ timeout: 120000 });
        await expect(pageBob.getByTestId('blog-name')).toHaveText('Bach Chronicles', { timeout: 120000 });

        // Alice and Bob should each see relay + direct browser peer.
        await Promise.all([
            expectPeerCount(pageAlice, 2),
            expectPeerCount(pageBob, 2),
        ]);
        await Promise.all([
            expectHasWebRTCTransport(pageAlice),
            expectHasWebRTCTransport(pageBob),
        ]);

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

    test('Alice edits a post and Bob sees the update while viewing', async () => {
        test.fail(true, 'Known issue: remote viewer does not receive post edits quickly while watching');
        await closeSidebarOverlayIfPresent(pageAlice);
        await closeSidebarOverlayIfPresent(pageBob);

        const targetTitle = "The Birth of a Musical Genius";
        const updatedContent = `Johann Sebastian Bach was born in Eisenach, Germany in 1685... (edited ${Date.now()})`;

        const aliceTargetPostTitle = pageAlice.getByTestId('post-item-title').filter({ hasText: targetTitle });
        await expect(aliceTargetPostTitle).toBeVisible({ timeout: 60000 });
        await aliceTargetPostTitle.first().click();

        const bobTargetPostTitle = pageBob.getByTestId('post-item-title').filter({ hasText: targetTitle });
        await expect(bobTargetPostTitle).toBeVisible({ timeout: 60000 });
        await bobTargetPostTitle.first().click();

        const aliceTargetPostItem = pageAlice
            .locator('[data-testid^="post-item-"]')
            .filter({ has: pageAlice.getByTestId('post-item-title').filter({ hasText: targetTitle }) })
            .first();
        await aliceTargetPostItem.hover();
        await aliceTargetPostItem.locator('[data-testid^="post-edit-"]').click();

        await expect(pageAlice.getByTestId('edit-post-content-input')).toBeVisible({ timeout: 30000 });
        await pageAlice.getByTestId('edit-post-content-input').fill(updatedContent);
        await pageAlice.getByTestId('save-edited-post-button').click();

        await expect(pageAlice.getByTestId('blog-post').getByText(updatedContent)).toBeVisible({ timeout: 60000 });

        await expect(async () => {
            await expect(pageBob.getByTestId('blog-post').getByText(updatedContent)).toBeVisible({ timeout: 5000 });
        }).toPass({ timeout: 60000 });
    });

    test('Alice deletes and restores her blog from OrbitDB address', async ({ browser }) => {
        // Close Bob's browser first
        if (pageBob) await pageBob.close();
        if (contextBob) await contextBob.close();

        // Reopen Alice's browser
        contextAlice = await browser.newContext({
            ignoreHTTPSErrors: true,
            launchOptions: {
                args: [
                    '--allow-insecure-localhost',
                    '--unsafely-treat-insecure-origin-as-secure=ws://localhost:19092',
                    '--disable-web-security'
                ]
            }
        });
        pageAlice = await contextAlice.newPage();
        await pageAlice.goto('http://localhost:5173');

        // Open Sidebar and DBManager
        // await pageAlice.getByTestId('menu-button').click();  
        await pageAlice.getByTestId('blogs-header').click();
        await pageAlice.getByTestId('db-manager-container').waitFor({ state: 'visible' });
        // DBManager renders in main content; ensure sidebar overlay doesn't intercept clicks.
        await closeSidebarOverlayIfPresent(pageAlice);

        //DBManager add aliceBlogAddress as remote database
        // await pageAlice.getByTestId('add-remote-db-button').click();
        await pageAlice.getByTestId('remote-db-address-input').fill(aliceBlogAddress);
        await closeSidebarOverlayIfPresent(pageAlice);
        await pageAlice.getByTestId('add-db-button').click();
 
        //check if aliceBlogAddress is in the remote databases list
        await expect(async () => {
            await expect(pageAlice.getByTestId('remote-db-item')).toBeVisible();
            
            // Get all remote database items
            const remoteDatabases = await pageAlice.getByTestId('remote-db-item').all();
            
            // Check their text content
            const remoteDBTexts = await Promise.all(remoteDatabases.map(db => db.textContent()));
            
            // Find at least one item that contains both the address and "Unknown Blog"
            const hasMatchingDB = remoteDBTexts.some(text => 
                text.includes("Unknown Blog") && text.includes(aliceBlogAddress)
            );
            
            expect(hasMatchingDB).toBe(true);
        }).toPass({ timeout: 30000 });
        //click on unknown blog
        await pageAlice.getByTestId('remote-db-item').first().click();
        await pageAlice.waitForTimeout(2000);

        //wait until we see the post titles in the posts list
        await expect(async () => {
            const posts = await pageAlice.getByTestId('post-item-title').all();
            expect(posts).toHaveLength(2);
            // Verify both posts are visible
            for (const post of posts) {
                await expect(post).toBeVisible();
            }
            // Verify the specific titles are present
            const postTitles = await Promise.all(posts.map(post => post.textContent()));
            expect(postTitles).toContain("The Birth of a Musical Genius");
            expect(postTitles).toContain("The Well-Tempered Clavier");
        }).toPass({ timeout: 30000 });

        //delete the database
        await pageAlice.getByTestId('delete-db-button').click();
        // Click the confirm button in the modal
        await pageAlice.getByRole('button', { name: 'Confirm' }).first().click();
        
        //wait until the database is deleted
        await expect(pageAlice.getByTestId('remote-db-item')).not.toBeVisible();
        // // Get the database address before deletion
        // const dbAddressInput = pageAlice.getByTestId('db-address-input');
        // await expect(dbAddressInput).toBeVisible();
        // const savedAddress = await dbAddressInput.inputValue();

        // // Delete the database - need to add test IDs for these elements
        // await pageAlice.getByTestId('delete-db-button').click();
        // await pageAlice.getByTestId('confirm-delete-button').click();

        // ... rest of the test ...
    });


    test.afterAll(async () => {
        // await pageAlice.close();
        // await pageBob.close();
        // await contextAlice.close();  // Close Alice's context
        // await contextBob.close();    // Close Bob's context
        
 
    });
}); 
