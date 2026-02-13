import { test, expect, chromium } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

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
    const closeSidebarIfOpen = async (page) => {
        const closeSidebarOverlay = page.getByLabel('close_sidebar');
        if (await closeSidebarOverlay.isVisible().catch(() => false)) {
            try {
                await closeSidebarOverlay.click({ force: true, timeout: 2000 });
            } catch {
                await page.keyboard.press('Escape');
            }
        }
    };
    const openDbManager = async (page) => {
        await expect(async () => {
            const dbManager = page.getByTestId('db-manager-container');
            if (await dbManager.isVisible().catch(() => false)) {
                return;
            }

            const menuButton = page.getByTestId('menu-button');
            if (await menuButton.isVisible().catch(() => false)) {
                await menuButton.click({ force: true });
            }

            const blogsByTestId = page.getByTestId('blogs-header').first();
            if (await blogsByTestId.isVisible().catch(() => false)) {
                await blogsByTestId.click({ force: true });
            } else {
                const blogsButton = page.getByRole('button', { name: /show database manager|blogs/i }).first();
                if (await blogsButton.isVisible().catch(() => false)) {
                    await blogsButton.click({ force: true });
                }
            }

            await expect(dbManager).toBeVisible();
        }).toPass({ timeout: 30000 });
    };
    const ensureRemoteDbMode = async (page) => {
        await expect(async () => {
            const remoteDbInput = page.getByTestId('remote-db-address-input');
            if (await remoteDbInput.isVisible().catch(() => false)) {
                return;
            }

            const modeToggle = page.locator('[data-testid="db-manager-container"] input[type="checkbox"]').first();
            if (await modeToggle.isVisible().catch(() => false)) {
                const isLocalMode = await modeToggle.isChecked();
                if (isLocalMode) {
                    await modeToggle.click({ force: true });
                }
            }

            await expect(remoteDbInput).toBeVisible();
        }).toPass({ timeout: 15000 });
    };
    const selectCategory = async (page, category: string) => {
        await closeSidebarIfOpen(page);
        await page.locator('#categories').click();
        await page.locator('.multiselect-container button', { hasText: category }).first().click();
    };
    const ensureAliceBlogPrepared = async () => {
        if (aliceBlogAddress) {
            return;
        }

        if (!pageAlice || pageAlice.isClosed()) {
            pageAlice = await contextAlice.newPage();
            pageAlice.on('console', msg => {
                console.log('BROWSER LOG:', msg.text());
            });
        }

        await pageAlice.goto(BASE_URL);
        await expect(pageAlice.getByTestId('blog-name')).toBeVisible();
        await expect(pageAlice.getByTestId('blog-description')).toBeVisible();

        await pageAlice.getByTestId('settings-header').click();
        await closeSidebarIfOpen(pageAlice);
        await pageAlice.getByTestId('blog-settings-accordion').click();
        await pageAlice.getByTestId('blog-name-input').fill('Bach Chronicles');
        await pageAlice.getByTestId('blog-description-input').fill('Exploring the life and works of Johann Sebastian Bach');

        await pageAlice.getByTestId('categories').click();
        const categories = ['General', 'Live', 'Works', 'Music'];
        for (const category of categories) {
            await pageAlice.getByTestId('new-category-input').fill(category);
            await pageAlice.getByTestId('add-category-button').click();
        }

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
            await selectCategory(pageAlice, post.category);
            await pageAlice.locator('#publish').check();
            await closeSidebarIfOpen(pageAlice);
            await pageAlice.getByTestId('publish-post-button').click();

            await expect(async () => {
                const postElements = await pageAlice.getByTestId('post-item-title').all();
                const postTitles = await Promise.all(postElements.map(el => el.textContent()));
                expect(postTitles).toContain(post.title);
            }).toPass({ timeout: 20000 });
        }

        // Stabilize local stores/settings writes before sharing address with Bob.
        // Without this, Bob may load a settings DB snapshot that is missing postsDBAddress.
        await pageAlice.reload();
        await expect(pageAlice.getByRole('heading', { level: 1, name: 'Bach Chronicles' })).toBeVisible();
        await expect(pageAlice.getByRole('heading', { level: 3, name: 'The Birth of a Musical Genius' })).toBeVisible();
        await expect(pageAlice.getByRole('heading', { level: 3, name: 'The Well-Tempered Clavier' })).toBeVisible();

        await closeSidebarIfOpen(pageAlice);
        await openDbManager(pageAlice);

        const dbAddressInput = pageAlice.getByTestId('db-address-input');
        await expect(dbAddressInput).toBeVisible();
        aliceBlogAddress = await dbAddressInput.inputValue();
        expect(aliceBlogAddress).toBeTruthy();
        expect(aliceBlogAddress).toMatch(/^\/orbitdb\/[a-zA-Z0-9]+$/);
    };

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
        test.setTimeout(120000);
        await ensureAliceBlogPrepared();
        
        // Copy the address to clipboard for Bob to use
        await closeSidebarIfOpen(pageAlice);
        await pageAlice.getByTestId('copy-db-address-button').click();
        // await pageAlice.
    });

    test('Bob opens Alice\'s blog and waits for replication', async () => {
        test.setTimeout(120000);
        await ensureAliceBlogPrepared();

        pageBob = await contextBob.newPage();
        pageBob.on('console', msg => {
            console.log('BROWSER LOG:', msg.text());
        }); 
        await pageBob.goto(BASE_URL);
        await pageBob.evaluate(() => {
            localStorage.setItem('debug', 'libp2p:*,le-space:*');
        });

        // Load Alice's settings DB via the DB manager to avoid flakiness around hash-based bootstrapping.
        await closeSidebarIfOpen(pageBob);
        await openDbManager(pageBob);
        await ensureRemoteDbMode(pageBob);
        await pageBob.getByTestId('remote-db-address-input').fill(aliceBlogAddress);
        await closeSidebarIfOpen(pageBob);
        await pageBob.getByTestId('add-db-button').click();

        await expect(async () => {
            const items = await pageBob.getByTestId('remote-db-item').all();
            const texts = await Promise.all(items.map((item) => item.textContent()));
            expect(texts.some((text) => text.includes(aliceBlogAddress))).toBe(true);
        }).toPass({ timeout: 30000 });

        await pageBob.getByTestId('remote-db-item').first().click({ force: true });

        await expect.poll(async () => {
            return await pageBob.evaluate(() => {
                const w = window as any;
                const t = w.__LE_SPACE_E2E__?.postTitles;
                return Array.isArray(t) ? t : [];
            });
        }, { timeout: 90000 }).toEqual(expect.arrayContaining([
            'The Birth of a Musical Genius',
            'The Well-Tempered Clavier'
        ]));

    });

    test('Alice deletes and restores her blog from OrbitDB address', async ({ browser }) => {
        test.setTimeout(120000);
        await ensureAliceBlogPrepared();

        // Close Bob's browser first
        if (pageBob && !pageBob.isClosed()) {
            await pageBob.close();
        }
        if (contextBob) {
            await contextBob.close();
        }

        // Reopen Alice's browser
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
        pageAlice = await contextAlice.newPage();
        await pageAlice.goto(BASE_URL);

        // Open Sidebar and DBManager
        await closeSidebarIfOpen(pageAlice);
        await openDbManager(pageAlice);

        //DBManager add aliceBlogAddress as remote database
        // await pageAlice.getByTestId('add-remote-db-button').click();
        await ensureRemoteDbMode(pageAlice);
        await pageAlice.getByTestId('remote-db-address-input').fill(aliceBlogAddress);
        await closeSidebarIfOpen(pageAlice);
        await expect(pageAlice.getByLabel('close_sidebar')).not.toBeVisible().catch(() => {});
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
        await closeSidebarIfOpen(pageAlice);
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
        await closeSidebarIfOpen(pageAlice);
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
