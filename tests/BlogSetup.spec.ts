import { test, expect, chromium } from '@playwright/test';

test.describe('Blog Setup and Bach Posts', () => {
    let page;

    test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
        await page.goto('http://localhost:5173'); 
    });

    test('Check initial blog state', async () => {
        const blogName = await page.getByTestId('blog-name').textContent();
        const blogDescription = await page.getByTestId('blog-description').textContent();
        
        await expect(page.getByTestId('blog-name')).toBeVisible();
        await expect(page.getByTestId('blog-description')).toBeVisible();
        
        // Add assertions for the actual text content
        expect(blogName).toBe('New Blog');
        expect(blogDescription).toBe('Change your blog description in the settings');
        // Check main sections exist
        await expect(page.getByTestId('sidebar-container')).toBeVisible();
        await expect(page.getByTestId('blogs-section')).toBeVisible();
        await expect(page.getByTestId('peers-section')).toBeVisible();
        await expect(page.getByTestId('settings-section')).toBeVisible();

        // Check blog name in sidebar
        await expect(page.getByTestId('sidebar-blog-name')).toBeVisible();
        const sidebarBlogName = await page.getByTestId('sidebar-blog-name').textContent();
        expect(sidebarBlogName).toBe('New Blog');

        // Check connection status
        await expect(page.getByTestId('write-access-icon')).toBeVisible();
        // await expect(page.getByTestId('menu-button')).toBeVisible();
    });

    test('Setup blog settings and create Bach posts', async () => {
        // Configure blog settings
        await page.getByTestId('settings-header').click();
        await page.getByTestId('blog-settings-accordion').click(); // Open the accordion first
        await page.getByTestId('blog-name-input').fill('Bach Chronicles');
        await page.getByTestId('blog-description-input').fill('Exploring the life and works of Johann Sebastian Bach');

        // Add categories
        await page.getByTestId('categories').click(); // Open the categories accordion

        // First remove all existing categories
        while (await page.getByTestId(/^remove-category-button-/).count() > 0) {
            const removeButton = await page.getByTestId(/^remove-category-button-/).first();
            await removeButton.click();
        }

        // Now add the new categories
        const categories = ['General', 'Live', 'Works', 'Music'];
        for (const category of categories) {
            await page.getByTestId('new-category-input').fill(category);
            await page.getByTestId('add-category-button').click();
        }

        // Verify all categories are present
        const categoryElements = await page.getByTestId('category-item').all();
        expect(categoryElements.length).toBe(categories.length);
        
        // Verify each category element's content matches our expected categories
        for (const element of categoryElements) {
            const text = await element.textContent();
            const categoryName = text.replace(' ×', '');  // Remove the × symbol
            expect(categories).toContain(categoryName);
        }

        // First try to create a post without a category (negative test)
        await page.getByTestId('new-post-link').click();
        await page.getByTestId('post-title-input').fill('Test Post Without Category');
        await page.getByTestId('post-content-input').fill('This post should not be published without a category');
        await page.getByTestId('publish-post-button').click();
        
        // Verify the post was not created (should still be on the form page)
        await expect(page.getByTestId('post-form')).toBeVisible();

        // Create posts about Bach with proper categories
        const bachPosts = [
            {
                title: "The Birth of a Musical Genius",
                content: "Johann Sebastian Bach was born in Eisenach, Germany in 1685...",
                category: "Music"
            },
            {
                title: "The Well-Tempered Clavier",
                content: "One of Bach's most influential works, The Well-Tempered Clavier, demonstrates his mastery of counterpoint and harmony.\n\nListen to Book I, Prelude in C Major:\n\nhttps://youtube.com/watch?v=BachWTC456",
                category: "Music"
            },
            {
                title: "Bach's Sacred Music",
                content: "The St. Matthew Passion stands as one of Bach's greatest achievements in sacred music.\n\nExperience the opening chorus:\n\nhttps://youtube.com/watch?v=BachSMP789",
                category: "Music"
            },
            {
                title: "The Art of Fugue",
                content: "Bach's final unfinished work showcases the pinnacle of contrapuntal composition.\n\nWatch a visualization of Contrapunctus I:\n\nhttps://youtube.com/watch?v=BachAOF101",
                category: "Music"
            },
            {
                title: "Bach's Legacy",
                content: "Bach's influence extends far beyond his time, inspiring countless musicians across centuries.\n\nExplore modern interpretations:\n\nhttps://youtube.com/watch?v=BachMod202",
                category: "Music"
            }
        ];

        for (const post of bachPosts) {
            // Navigate to new post page
            await page.getByTestId('new-post-link').click();
            
            // Fill in post details including category
            await page.getByTestId('post-title-input').fill(post.title);
            await page.getByTestId('post-content-input').fill(post.content);
            await page.getByTestId('category-select').selectOption(post.category);
            
            // Submit post
            await page.getByTestId('publish-post-button').click();
            
            // Wait for the post to appear in the post list and verify its title
            // await expect(page.getByTestId('post-item-title')).toContainText(post.title, {timeout: 10000});
            
            // Click on the post to view it
            const postElement = await page.getByTestId('post-item-title').first();
            await postElement.click();
        }

        for (const post of bachPosts) {
            // Verify post title exists
            const titles = await page.getByTestId('post-item-title').allTextContents();
            await expect(titles).toContain(post.title);
            
            // Find the specific post by its title
            const postTitle = await page.getByTestId('post-item-title').filter({ hasText: post.title });
            const postContainer = await postTitle.locator('..').locator('..');
            
            // Look specifically for the category badge span
            await expect(postContainer.locator('span.bg-indigo-100')).toHaveText(post.category);
        }
    });

    test.afterAll(async () => {
        await page.close();
    });
});

