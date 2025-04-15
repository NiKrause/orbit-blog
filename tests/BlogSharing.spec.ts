import { test, expect, chromium } from '@playwright/test';

test.describe('Blog Sharing between Alice and Bob', () => {
    let pageAlice;
    let pageBob;
    let aliceBlogAddress;

    test.beforeAll(async ({ browser }) => {
        // Initialize Alice's browser
        pageAlice = await browser.newPage();
        await pageAlice.goto('http://localhost:5173');
        
        // Initialize Bob's browser
        pageBob = await browser.newPage();
    });

    test('Alice creates Bach blog and gets the database address', async () => {
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
            await pageAlice.getByTestId('new-post-link').click();
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
    });

    test('Bob opens Alice\'s blog and waits for replication', async () => {


        // Define the expected loading states
        const expectedLoadingStates = [
            { step: 'initializing', progress: 5 },
            { step: 'connecting_peers', progress: 10 },
            { step: 'identifying_db', progress: 30 },
            { step: 'loading_settings', progress: 40 },
            { step: 'loading_posts', progress: 60 },
            { step: 'loading_comments', progress: 70 },
            { step: 'loading_media', progress: 80 },
            { step: 'complete', progress: 100 }
        ];

        try {
            await Promise.all([
                // Navigation
                pageBob.goto(`http://localhost:5173/#${aliceBlogAddress}`),
                
                // Loading state verification
                (async () => {
                    // First wait for the overlay to appear
                    await pageBob.waitForSelector('[data-testid="loading-overlay"]', { 
                        state: 'visible',
                        timeout: 5000
                    });
                    await pageBob.getByTestId('menu-button').click();
                    await pageBob.getByTestId('blogs-header').click();
                    //check if db-manager-container is hidden
                    await expect(pageBob.getByTestId('db-manager-container')).toBeHidden();
                    await pageBob.getByTestId('menu-button').click();
            
                    // Then check each loading state
                    for (const state of expectedLoadingStates) {

                        await pageBob.waitForFunction(
                            (expectedStep) => {
                                const message = document.querySelector('[data-testid="loading-message"]')?.textContent || '';
                                return message.includes(expectedStep);
                            },
                            state.step,
                            { timeout: 10000 }
                        );

                        const loadingMessage = await pageBob.getByTestId('loading-message').textContent();
                        const progressBar = await pageBob.getByTestId('progress-bar').getAttribute('style');
                        
                        console.log(`Loading state: ${state.step}, Message: ${loadingMessage}, Progress: ${progressBar}`);
                        
                        if (loadingMessage.includes('error')) {
                            console.error('Loading error detected:', loadingMessage);
                            throw new Error(`Loading failed at step ${state.step}: ${loadingMessage}`);
                        }
                        
                        await expect(pageBob.getByTestId('progress-bar')).toHaveAttribute('style', `width: ${state.progress}%`);
                    }

                    // Finally wait for the overlay to disappear
                    await pageBob.waitForSelector('[data-testid="loading-overlay"]', { 
                        state: 'hidden',
                        timeout: 15000
                    });
                })()
            ]);

            // Add a small delay to ensure the page has fully loaded
            await pageBob.waitForTimeout(1000);
            
            // Verify the final state
            await expect(pageBob.getByTestId('blog-name')).toHaveText('Bach Chronicles');
            
            const postTitles = await pageBob.getByTestId('post-item-title').allTextContents();
            expect(postTitles).toContain('The Birth of a Musical Genius');
            expect(postTitles).toContain('The Well-Tempered Clavier');
            
            const categoryElements = await pageBob.getByTestId('category-item').all();
            expect(categoryElements.length).toBe(4);
        } catch (error) {
            console.error('Error during blog loading:', error);
            
            // Log the current state when error occurs
            const currentMessage = await pageBob.getByTestId('loading-message').textContent().catch(() => 'not found');
            const currentProgress = await pageBob.getByTestId('progress-bar').getAttribute('style').catch(() => 'not found');
            console.log('Current state when error occurred:', {
                message: currentMessage,
                progress: currentProgress
            });
            
            throw error;
        }
    });

    test.afterAll(async () => {
        await pageAlice.close();
        await pageBob.close();
    });
}); 