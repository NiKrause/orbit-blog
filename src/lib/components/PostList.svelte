<script lang="ts">
  import { run } from 'svelte/legacy';
  import { _, locale } from 'svelte-i18n';
  import { derived } from 'svelte/store';

  import { posts, selectedPostId, identity, postsDB, enabledLanguages, isRTL } from '$lib/store.js';
  import { formatTimestamp } from '$lib/dateUtils.js';

  import type { Post, Category } from '$lib/types.js';
  import { onMount } from 'svelte';
  import { categories } from '$lib/store.js';
  import BlogPost from './BlogPost.svelte';
  import MediaManager from './MediaManager.svelte';
  import ContentEditor from './ContentEditor.svelte';
  import MediaUploader from './MediaUploader.svelte';
  import { TranslationService } from '$lib/services/translationService.js';
import { handleMediaSelection, removeMediaFromContent, validateEncryptionFields, truncateTitle } from '$lib/utils/postUtils.js';
import { renderContent } from '$lib/services/MarkdownRenderer.js';
import { filterPostsWithLanguageFallback, getAvailableLanguagesForPost, getPostInLanguage } from '$lib/services/languageFallbackService.js';
  
  // Import html2pdf for PDF generation
  import html2pdf from 'html2pdf.js';

  import LanguageStatusLED from './LanguageStatusLED.svelte';
  import { encryptPost } from '$lib/cryptoUtils.js';
  import PostPasswordPrompt from './PostPasswordPrompt.svelte';
  import { info, error } from '../utils/logger.js'
  import MultiSelect from './MultiSelect.svelte';
  import { MarkdownImportResolver } from '$lib/services/MarkdownImportResolver.js';
  import MarkdownHelp from './MarkdownHelp.svelte';

  let searchTerm = $state('');
  let selectedCategory: Category | 'All' = $state('All');
  // let selectedPostId: string | null = null;
  let hoveredPostId = $state<string | null>(null); // Track the ID of the hovered post
  let editMode = $state(false); // Track if we're in edit mode
  let editedTitle = $state('');
  let editedContent = $state('');
  let editedCategories = $state<string[]>([]); // Support multiple categories
  let editedUpdatedAt = $state('');
  let editedCreatedAt = $state('');
  let editedPublished = $state(false);
  let showHistory = $state(false);
  let postHistory = $state<Post[]>([]);
  let showMediaUploader = $state(false);
  let selectedMedia = $state<string[]>([]);
  let showDeleteConfirm = $state(false);
  let postToDelete = $state<Post | null>(null);
  let deleteAllTranslations = $state(false); // Add this new state variable

  // Add these state variables with the other state declarations at the top
  let isTranslating = $state(false);
  let translationError = $state('');

  let translationStatuses = $state<Record<string, 'success' | 'error' | 'default'>>({});

  let showPreview = $state(false);

  // Add these state variables at the top with other state declarations
  let isEncrypting = $state(false);
  let showPasswordPrompt = $state(false);
  let encryptionPassword = $state('');
  let encryptionError = $state('');

  // Import resolution state
  let isResolvingImports = $state(false);
  let importResolutionError = $state('');
  let importResolutionResult = $state<any>(null);

  // Create a reactive date formatter that updates when locale changes
  const reactiveDateFormatter = derived(locale, ($locale) => {
    return (timestamp: number | string) => formatTimestamp(timestamp);
  });

  // Derive available years from posts
  let availableYears = $derived.by(() => {
    const years = new Set();
    $posts.forEach(post => {
      const date = new Date(post.createdAt || post.date);
      if (!isNaN(date.getTime())) {
        years.add(date.getFullYear());
      }
    });
    return Array.from(years).sort((a: number, b: number) => b - a); // Most recent first
  });

  // Function to jump to the last post of a specific year
  function jumpToYear(year: number) {
    const yearPosts = displayedPosts.filter(post => {
      const date = new Date(post.createdAt || post.date);
      return date.getFullYear() === year;
    });
    
    if (yearPosts.length > 0) {
      // Find the last post of that year (most recent)
      const lastPostOfYear = yearPosts[yearPosts.length - 1];
      $selectedPostId = lastPostOfYear._id;
      
      // Scroll to the post in the list
      setTimeout(() => {
        const postElement = document.querySelector(`[data-post-id="${lastPostOfYear._id}"]`);
        if (postElement) {
          postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }

  // Capture the current values outside of the $derived to prevent reactive subscriptions inside the filter
  let currentPostsDB = $state($postsDB);
  let currentIdentity = $state($identity);
  
  // Update these values when the reactive stores change
  $effect(() => {
    currentPostsDB = $postsDB;
  });
  
  $effect(() => {
    currentIdentity = $identity;
  });
  
  // Replace the $effect with a $derived store to prevent infinite reactive loops
  let displayedPosts = $derived(
    filterPostsWithLanguageFallback(
      $posts as any[],
      searchTerm,
      selectedCategory,
      () => {  // Use captured values instead of reading reactive stores directly in the filter
        if (!currentPostsDB || !currentIdentity) return false;
        return currentPostsDB.access.write.includes(currentIdentity.id) || currentPostsDB.access.write.includes("*");
      },
      $locale || 'en',  // Pass the current locale directly instead of having the function call get(locale)
      false  // Disable logging to prevent reactive loops
    )
  );

  // Add a function to check write permissions for UI display
  function hasWriteAccess(): boolean {
    if (!$postsDB || !$identity) return false;
    return $postsDB.access.write.includes($identity.id) || $postsDB.access.write.includes("*");
  }
  // $effect(() => {
  //   info('displayedPosts', displayedPosts);
  // });

  let selectedPost = $derived($selectedPostId ? displayedPosts.find(post => post._id === $selectedPostId) : null);

  onMount(() => {
    info('PostList component mounted');
  });

  $effect(() => {
    if (displayedPosts.length > 0 && (!$selectedPostId || !displayedPosts.find(post => post._id === $selectedPostId))) {
      $selectedPostId = displayedPosts[0]._id;
    }
  });

  // Using shared renderMarkdown function from utils

  async function selectPost(postId: string) {
    $selectedPostId = postId;
    editMode = false; // Exit edit mode when selecting a different post
    
    // Find the selected post
    const selectedPost = $posts.find(p => p._id === postId);
    if (!selectedPost) return;
    
    // Log the original post
    info(`Selected post: ${selectedPost.title} (${selectedPost.language || 'no language'})`);
    info('posts', $posts) 
    
    // Get available languages for this post using the language service
    const availableLanguages = getAvailableLanguagesForPost($posts as any[], postId);
    info(`Available languages for post: [${availableLanguages.join(', ')}]`);
    
    // Find all related translations
    const allTranslations = $posts.filter(p => 
      // If this is a translated post, find all posts with same originalPostId including the original
      (selectedPost.originalPostId && (
        p.originalPostId === selectedPost.originalPostId || 
        p._id === selectedPost.originalPostId
      )) ||
      // If this is an original post, find all posts that were translated from it
      p.originalPostId === selectedPost._id
    );
    
    // Log all translations
    if (allTranslations.length > 0) {
      info('Related translations:');
      allTranslations.forEach(translation => {
        info(`- ${translation.title} (${translation.language})`);
      });
    } else {
      info('No translations found for this post');
    }
  }

  function editPost(post: Post, event: MouseEvent | KeyboardEvent | TouchEvent) {
    event.stopPropagation();
    $selectedPostId = post._id;
    editedTitle = post.title;
    editedContent = post.content;
    // Handle both single category and multiple categories
    editedCategories = post.categories || (post.category ? [post.category] : []);
    editedUpdatedAt = new Date(post.updatedAt).toISOString().slice(0, 16);
    editedCreatedAt = new Date(post.createdAt).toISOString().slice(0, 16);
    selectedMedia = post.mediaIds || [];
    editedPublished = post.published ?? false;
    editMode = true;
  }

  async function saveEditedPost() {
    if (selectedPost && editedTitle && editedContent) {
      try {
        console.log('Updating post with identity:', $identity);
        console.log('Identity ID:', $identity?.id);
        
        // Ensure identity is available before updating post
        if (!$identity || !$identity.id) {
          console.error('Identity not available when updating post');
          alert('Identity not initialized. Please wait for the app to fully load.');
          return;
        }
        
        // Support both single category (backward compatibility) and multiple categories
        const categoryData = editedCategories.length > 0 ? editedCategories : [];
        
        let updatedPost: Partial<Post> = {
          _id: $selectedPostId,
          title: editedTitle,
          content: editedContent,
          language: $locale,
          category: categoryData.length === 1 ? categoryData[0] : categoryData[0] || '', // Keep single category for backward compatibility
          categories: categoryData, // New field for multiple categories
          createdAt: new Date(editedCreatedAt).getTime(),
          updatedAt: new Date(editedUpdatedAt).getTime(),
          identity: $identity.id,
          mediaIds: selectedMedia,
          published: editedPublished
        };
        
        console.log('Updated post data with identity:', {...updatedPost, identity: updatedPost.identity });

        // If post is being encrypted or was previously encrypted
        if (isEncrypting || selectedPost.isEncrypted) {
          const encryptedData = await encryptPost(
            { title: editedTitle, content: editedContent }, 
            encryptionPassword
          );
          updatedPost = {
            ...updatedPost,
            title: encryptedData.encryptedTitle,
            content: encryptedData.encryptedContent,
            isEncrypted: true
          };
        }

        await $postsDB.put(updatedPost);
        info('Post updated successfully', updatedPost);
        editMode = false;
        isEncrypting = false;
        encryptionPassword = '';
        $selectedPostId = updatedPost._id;
      } catch (_error) {
        error('Error updating post:', error);
      }
    }
  }

  async function deletePost(post: Post, event: MouseEvent | TouchEvent) {
    event.stopPropagation();
    postToDelete = post;
    showDeleteConfirm = true;
  }

  async function confirmDelete() {
    if (!postToDelete) return;
    
    try {
      const allPosts = $posts;
      let postsToDelete = [];
      
      if (deleteAllTranslations) {
        // Delete all translations
        postsToDelete = allPosts.filter(p => 
          // If this is a translated post, find all posts with same originalPostId
          (postToDelete.originalPostId && p.originalPostId === postToDelete.originalPostId) ||
          // If this is an original post, find all posts that were translated from it
          (p.originalPostId === postToDelete._id)
        );
        
        // Add the original post to the deletion list if not already included
        if (!postsToDelete.includes(postToDelete)) {
          postsToDelete.push(postToDelete);
        }
      } else {
        // Delete only current language version
        postsToDelete = [postToDelete];
      }

      // Delete selected posts
      for (const post of postsToDelete) {
        await $postsDB.del(post._id);
      }

      info(`Posts deleted successfully: ${deleteAllTranslations ? 'all translations' : 'current language only'}`);
      if ($selectedPostId === postToDelete._id && displayedPosts.length > 1) {
        $selectedPostId = displayedPosts[0]._id;
      }
      showDeleteConfirm = false;
      postToDelete = null;
      deleteAllTranslations = false; // Reset the choice
    } catch (error) {
      error('Error deleting posts:', error);
    }
  }

  // Using shared truncateTitle function from utils

  async function viewPostHistory(post: Post, event: MouseEvent | TouchEvent) {
    event.stopPropagation();
    showHistory = true;
    
    // Get all operations for this post
    const history = [];
    for await (const entry of $postsDB.log.iterator({ reverse: true })) {
      if (entry?.payload?.value?._id === post._id) {
        history.push({
          ...entry.payload.value,
          timestamp: entry.payload.value.updatedAt 
        });
      }
    }
    postHistory = history;
  }

  function restoreVersion(historicalPost: Post) {
    editedTitle = historicalPost.title;
    editedContent = historicalPost.content;
    // Handle both single category and multiple categories
    editedCategories = historicalPost.categories || (historicalPost.category ? [historicalPost.category] : []);
    editMode = true;
    showHistory = false;
  }

  function handleMediaSelected(mediaCid: string) {
    const result = handleMediaSelection(mediaCid, selectedMedia, editedContent);
    selectedMedia = result.updatedMedia;
    editedContent = result.updatedContent;
    showMediaUploader = false;
  }

  function removeSelectedMedia(mediaId: string) {
    const result = removeMediaFromContent(mediaId, selectedMedia, editedContent);
    selectedMedia = result.updatedMedia;
    editedContent = result.updatedContent;
  }

  // Function to export the selected post as PDF
  function exportToPdf() {
    if (!selectedPost) return;
    
    // Create a temporary div to render the post content
    const element = document.createElement('div');
    element.className = 'pdf-export';
    
    element.innerHTML = `
      <style>
        .pdf-export {
          font-family: 'Arial', sans-serif;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 {
          font-size: 22px;
          margin-bottom: 16px;
          color: #333;
        }
        .meta {
          font-size: 12px;
          color: #666;
          margin-bottom: 20px;
          text-align: right;
        }
        .content {
          font-size: 14px;
          line-height: 1.5;
        }
        .content p {
          margin-bottom: 1em;
        }
        .content br {
          display: block;
          content: "";
          margin-top: 0.5em;
        }
        /* Fix for bullet points */
        .content ul {
          list-style-type: disc;
          padding-left: 2em;
          margin-bottom: 1em;
        }
        .content ol {
          list-style-type: decimal;
          padding-left: 2em;
          margin-bottom: 1em;
        }
        .content li {
          margin-bottom: 0.5em;
          display: list-item;
          vertical-align: middle;
          line-height: 1.4;
        }
        /* Fix bullet alignment */
        .content ul li::before,
        .content ol li::before {
          vertical-align: middle;
        }
        img {
          max-width: 100%;
          height: auto;
        }
        .category {
          display: inline-block;
          padding: 3px 8px;
          background: #f0f0f0;
          border-radius: 12px;
          font-size: 12px;
          margin-right: 10px;
        }
      </style>
      <h1>${selectedPost.title}</h1>
      <div class="meta">
        <span>${formatTimestamp(selectedPost.createdAt)}</span>
        ${selectedPost.updatedAt && selectedPost.updatedAt !== selectedPost.createdAt 
          ? `<span>(Updated: ${formatTimestamp(selectedPost.updatedAt)})</span>` 
          : ''}
      </div>
      <div class="content">
${renderContent(selectedPost.content)}
      </div>
    `;
    
    // Append temporarily to the document to ensure images load
    document.body.appendChild(element);
    
    // Configure the PDF options
    const options = {
      margin: [10, 10, 10, 10],
      filename: `${selectedPost.title.replace(/[^a-z0-9]/gi, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Generate the PDF
    html2pdf().from(element).set(options).save()
      .then(() => {
        // Remove the temporary element after PDF generation
        document.body.removeChild(element);
      });
  }

  async function exportToLatex() {
    if (!selectedPost) return;
    
    // Basic LaTeX document structure
    const latexContent = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{graphicx}
\\title{${selectedPost.title.replace(/[&$%#_{}]/g, '\\$&')}}
\\author{${selectedPost.identity ? `...${selectedPost.identity.slice(-5)}` : 'Unknown'}}
\\date{${formatTimestamp(selectedPost.createdAt)}${
  selectedPost.updatedAt && selectedPost.updatedAt !== selectedPost.createdAt 
    ? `\\\\Updated: ${formatTimestamp(selectedPost.updatedAt)}` 
    : ''
}}

\\begin{document}
\\maketitle

${convertMarkdownToLatex(selectedPost.content)}

\\end{document}`;

    // Create and download the .tex file
    const blob = new Blob([latexContent], { type: 'application/x-tex' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedPost.title.replace(/[^a-z0-9]/gi, '_')}.tex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function convertMarkdownToLatex(markdown: string): string {
    // This is a very basic conversion - you'd want to use a proper parser
    return markdown
      .replace(/#{1,6} (.+)/g, (_, title) => `\\section{${title}}`) // Headers
      .replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}') // Bold
      .replace(/\*(.+?)\*/g, '\\textit{$1}') // Italic
      .replace(/!\[(.+?)\]\((.+?)\)/g, '\\includegraphics{$2}') // Images
      .replace(/[&$%#_{}]/g, '\\$&'); // Escape special characters
  }

  // Modify the handleTranslate function similarly to the PostForm version
  async function handleTranslate(forceRetranslate = false) {
    console.log('🎯 TRANSLATE BUTTON CLICKED! 🎯');
    console.log('🚀 Houston, we have a translation request! Starting countdown...');
    console.log('3... 2... 1... BLAST OFF! 🚀');
    
    isTranslating = true;
    translationError = '';
    translationStatuses = Object.fromEntries([...$enabledLanguages].map(lang => [lang, 'default']));
    
    console.log('🔧 Setting up the translation machinery...');
    console.log('⚡ isTranslating =', isTranslating);
    console.log('🌍 Enabled languages:', [...$enabledLanguages]);
    console.log('📝 Current post title:', editedTitle);
    console.log('📄 Content length:', editedContent?.length, 'characters');

    try {
      // Support both single category (backward compatibility) and multiple categories
        const categoryData = editedCategories.length > 0 ? editedCategories : [];
        
        console.log('🏷️ Categories collected:', categoryData);

      const post = {
        _id:  $selectedPostId,
        title: editedTitle,
        content: editedContent,
        category: categoryData.length === 1 ? categoryData[0] : '', // Keep single category for backward compatibility
        categories: categoryData, // New field for multiple categories
        language: $locale,
        isEncrypted: isEncrypting 
      };
      
      console.log('📦 Post package prepared for translation:');
      console.log('   🆔 ID:', post._id);
      console.log('   🏷️ Title:', post.title);
      console.log('   🌐 Language:', post.language);
      console.log('   🔒 Encrypted:', post.isEncrypted);
      console.log('🎪 Time to call the Translation Circus! 🎪');

      const result = await TranslationService.translateAndSavePost({
        post,
        postsDB: $postsDB,
        identity: $identity,
        mediaIds: selectedMedia,
        timestamps: {
          createdAt: new Date(editedCreatedAt).getTime(),
          updatedAt: new Date(editedUpdatedAt).getTime()
        },
        encryptionPassword: encryptionPassword,
        isEncrypting: isEncrypting,
        forceRetranslate: forceRetranslate
      })
      
      console.log('🎭 Translation Circus has returned! Results:', result);

      if (result.success) {
        console.log('🎉 SUCCESS! Translation party time! 🎉');
        console.log('🏆 Translation statuses:', result.translationStatuses);
        console.log('🚪 Exiting edit mode like a boss!');
        translationStatuses = result.translationStatuses;
        editMode = false;
      } else {
        console.log('😱 OH NO! Translation failed! 😱');
        console.log('💥 Error:', result.error);
        console.log('📊 Status report:', result.translationStatuses);
        translationError = result.error;
        translationStatuses = result.translationStatuses;
      }
    } catch (error) {
      console.log('🔥 CATASTROPHIC FAILURE! 🔥');
      console.log('💀 The translation gods are angry:', error);
      console.log('🆘 Emergency protocols activated!');
      translationError = $_('translation_failed');
    } finally {
      console.log('🏁 Translation marathon complete!');
      console.log('😴 Setting isTranslating to false... zzz');
      isTranslating = false;
      console.log('✅ All done! Thanks for using the Le Space Blog Translation Extravaganza! ✨');
    }
  }

  // Add this function to handle encryption request
  async function handleEncrypt() {
    const validationError = validateEncryptionFields(editedTitle, editedContent);
    if (validationError) {
      encryptionError = validationError;
      return;
    }
    showPasswordPrompt = true;
  }

  function passwordSubmitted(event: CustomEvent) {
    info('passwordSubmitted', event.detail.password);
    encryptionPassword = event.detail.password;
    isEncrypting = true;
    showPasswordPrompt = false;
    encryptionError = '';
  }

  async function handlePostDecrypted(event: CustomEvent) {
    const decryptedData = event.detail.post;
    editedTitle = decryptedData.title;
    editedContent = decryptedData.content;
    
    if (selectedPost) {
      // Update the posts store
      $posts = $posts.map(post => {
        if (post._id === selectedPost._id) {
          const updatedPost = { ...post };
          updatedPost.title = decryptedData.title;
          updatedPost.content = decryptedData.content;
          updatedPost.createdAt = post.createdAt;
          updatedPost.updatedAt = post.updatedAt;
          updatedPost.date = post.date;
          updatedPost.isDecrypted = true;
          return updatedPost;
        }
        return post;
      });

      // displayedPosts will automatically update via the $derived reactive declaration
    }
    
    showPasswordPrompt = false;
    encryptionError = '';
  }

  // Function to handle resolving physical imports in edit mode
  async function handleResolveImports() {
    if (!editedContent) return;
    
    isResolvingImports = true;
    importResolutionError = '';
    importResolutionResult = null;
    
    try {
      info('Resolving physical imports in edited content...');
      const result = await MarkdownImportResolver.resolvePhysicalImports(editedContent);
      
      if (result.success) {
        editedContent = result.resolvedContent;
        importResolutionResult = result;
        info(`Successfully resolved ${result.resolvedImports.length} physical imports`);
      } else {
        importResolutionError = `Failed to resolve some imports: ${result.errors.map(e => e.error).join(', ')}`;
        importResolutionResult = result;
      }
    } catch (error) {
      console.error('Error resolving imports:', error);
      importResolutionError = error instanceof Error ? error.message : 'Unknown error occurred';
    } finally {
      isResolvingImports = false;
    }
  }

  // Check if edited content has physical imports
  let hasPhysicalImports = $derived(editMode && editedContent ? MarkdownImportResolver.hasPhysicalImports(editedContent) : false);
</script>

<div data-testid="post-list" class="{$isRTL ? 'rtl' : 'ltr'}">
  <!-- Search + Filter Bar -->
  <div class="flex gap-3 mb-6">
    <input
      type="text"
      placeholder={$_('search_posts')}
      bind:value={searchTerm}
      class="input flex-1"
    />
    <select
      id="edit-category"
      bind:value={selectedCategory}
      class="input"
      style="width: auto; min-width: 120px;"
    >
      <option value="All">{$_('all')}</option>
      {#each [...$categories].sort((a, b) => b.localeCompare(a)) as cat}
        <option value={cat}>{cat}</option>
      {/each}
    </select> 
  </div>

  <div class="grid grid-cols-12 gap-6 responsive-grid">
    <!-- Post List Panel -->
    <div class="col-span-4 card p-4 post-list-container flex flex-col">
      <div class="flex justify-between items-center mb-3">
        <h2 class="text-sm font-semibold" style="color: var(--text);">{$_('blog_posts')}</h2>
      </div>
      
      <!-- Year Navigation -->
      {#if availableYears.length > 1}
        <div class="mb-3 pb-3" style="border-bottom: 1px solid var(--border-subtle);">
          <div class="flex flex-wrap gap-1 max-h-16 overflow-y-auto" style="scrollbar-width: none;">
            {#each availableYears as year}
              <button
                class="badge cursor-pointer hover:opacity-80 transition-opacity"
                onclick={() => jumpToYear(year as number)}
                title={`Jump to last post from ${year}`}
              >
                {year}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="space-y-0.5 overflow-y-auto max-h-96 min-h-48" style="scrollbar-width: thin;">
        {#each displayedPosts as post (post._id)}
          <div data-testid="post-item-{post._id}" class="post-item w-full text-left px-3 py-2.5 rounded-md transition-all cursor-pointer"
            style="{$selectedPostId === post._id ? 'background-color: var(--bg-active); border-left: 2px solid var(--accent);' : 'border-left: 2px solid transparent;'}"
            onclick={() => selectPost(post._id)}
            onmouseover={() => hoveredPostId = post._id}
            onmouseout={() => hoveredPostId = null}
            onfocus={() => hoveredPostId = post._id}
            onblur={() => hoveredPostId = null}
            ontouchstart={(e) => { e.stopPropagation(); selectPost(post._id) }}
            ontouchend={(e) => { e.preventDefault(); e.stopPropagation(); selectPost(post._id) }}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && selectPost(post._id)}
            class:active={hoveredPostId === post._id}
            data-post-id={post._id}
          >
            <div class="post-content">
              {#if hasWriteAccess()}
                <div class="flex justify-end gap-1 action-buttons {hoveredPostId === post._id ? 'opacity-100' : 'opacity-0'} transition-opacity">
                  <button
                    type="button"
                    class="btn-icon"
                    onclick={(e) => { e.stopPropagation(); editPost(post, e); }}
                    onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); editPost(post, e); } }}
                    ontouchend={(e) => { e.preventDefault(); e.stopPropagation(); editPost(post, e); }}
                    aria-label={$_('edit_post')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    class="btn-icon"
                    style="color: var(--danger);"
                    onclick={(e) => deletePost(post, e)}
                    ontouchend={(e) => {e.preventDefault(); e.stopPropagation(); deletePost(post, e)}}
                    aria-label={$_('delete_post')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                  </button>
                  <button
                    class="btn-icon"
                    onclick={(e) => viewPostHistory(post, e)}
                    ontouchend={(e) => {e.preventDefault(); e.stopPropagation(); viewPostHistory(post, e)}}
                    aria-label={$_('view_history')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/>
                    </svg>
                  </button>
                </div>
              {/if}
              <div>
                <h3 data-testid="post-item-title" class="text-sm font-medium overflow-hidden whitespace-nowrap text-ellipsis" style="color: var(--text);" title={post.title}>
                  {post.isDecrypted ? truncateTitle(post.title, 40) : truncateTitle(post.isEncrypted ? $_('encrypted_post') : post.title, 40)}
                </h3>
                <div class="mt-1">
                  <span class="text-xs" style="color: var(--text-muted);">
                    {$reactiveDateFormatter(post.createdAt || post.date)}
                  </span>
                  {#if post.categories && post.categories.length > 0}
                    <div class="flex flex-wrap gap-1 mt-1">
                      {#each post.categories as categoryItem}
                        <span class="badge">{categoryItem}</span>
                      {/each}
                    </div>
                  {:else if post.category}
                    <div class="mt-1">
                      <span class="badge">{post.category}</span>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Selected Post Content -->
    <div class="col-span-8">
      {#if selectedPost}
        {#if editMode}
          <!-- Edit Form -->
          <div class="card p-6">
            <h2 class="text-lg font-semibold mb-4" style="color: var(--text);">{$_('edit_post')}</h2>
            
            <div class="space-y-4">
              <div>
                <label for="edit-title" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('title')}</label>
                <input
                  id="edit-title"
                  type="text"
                  bind:value={editedTitle}
                  class="input"
                  required
                />
              </div>

              <div>
                <label for="edit-category" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('categories')}</label>
                <MultiSelect
                  bind:values={editedCategories}
                  options={$categories}
                  id="edit-category"
                  placeholder="Select categories..."
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="edit-updated-at" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('last_updated')}</label>
                  <input
                    id="edit-updated-at"
                    type="datetime-local"
                    bind:value={editedUpdatedAt}
                    class="input"
                  />
                </div>
                <div>
                  <label for="edit-created-at" class="block text-xs font-medium mb-1" style="color: var(--text-secondary);">{$_('created_at')}</label>
                  <input
                    id="edit-created-at"
                    type="datetime-local"
                    bind:value={editedCreatedAt}
                    class="input"
                  />
                </div>
              </div>

              <div class="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-published"
                  bind:checked={editedPublished}
                  class="rounded"
                  style="border-color: var(--border); color: var(--accent);"
                />
                <label for="edit-published" class="text-sm" style="color: var(--text-secondary);">{$_('publish_post')}</label>
              </div>

              <div>
                <div class="flex justify-between items-center mb-2">
                  <label for="edit-content" class="block text-xs font-medium" style="color: var(--text-secondary);">{$_('content')}</label>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onclick={() => showMediaUploader = !showMediaUploader}
                      class="btn-ghost btn-sm"
                    >
                      {showMediaUploader ? $_('hide_media_library') : $_('add_media')}
                    </button>
                    {#if hasPhysicalImports}
                    <button
                      type="button"
                      onclick={handleResolveImports}
                      disabled={isResolvingImports}
                      class="btn-ghost btn-sm disabled:opacity-50"
                    >
                      {isResolvingImports ? 'Resolving...' : 'Resolve Imports'}
                    </button>
                    {/if}
                    <MarkdownHelp />
                    <button
                      type="button"
                      onclick={() => showPreview = !showPreview}
                      class="btn-ghost btn-sm"
                    >
                      {showPreview ? $_('show_editor') : $_('show_preview')}
                    </button>
                  </div>
                </div>

                {#if showMediaUploader}
                  <MediaUploader onMediaSelected={handleMediaSelected} />
                {/if}

                {#if showPreview}
                  <div class="prose dark:prose-invert max-w-none min-h-[200px] p-4 rounded-md" style="background-color: var(--bg-tertiary); border: 1px solid var(--border);">
{@html renderContent(editedContent || `*${$_('preview_will_appear_here')}...*`)}
                  </div>
                {:else}
                  <textarea
                    id="edit-content"
                    bind:value={editedContent}
                    rows="10"
                    class="input"
                    style="min-height: 200px;"
                    required
                    placeholder={$_('markdown_placeholder')}
                  ></textarea>
                {/if}
              </div>

              <MediaManager 
                selectedMedia={selectedMedia}
                showMediaUploader={false}
                on:mediaRemoved={(e) => removeSelectedMedia(e.detail.mediaId)}
              />

              {#if importResolutionError}
                <div class="text-sm" style="color: var(--danger);">
                  Import Resolution Error: {importResolutionError}
                </div>
              {/if}

              {#if importResolutionResult && importResolutionResult.resolvedImports.length > 0}
                <div class="p-3 rounded-md" style="background-color: var(--bg-tertiary); border: 1px solid var(--border);">
                  <h4 class="font-medium text-sm" style="color: var(--success);">Physical Imports Resolved</h4>
                  <ul class="mt-1 text-xs space-y-1" style="color: var(--text-secondary);">
                    {#each importResolutionResult.resolvedImports as resolvedImport}
                      <li>{resolvedImport.title || 'Untitled'} from {resolvedImport.url}</li>
                    {/each}
                  </ul>
                  {#if importResolutionResult.errors.length > 0}
                    <div class="mt-2">
                      <h5 class="font-medium text-xs" style="color: var(--danger);">Some imports failed:</h5>
                      <ul class="mt-1 text-xs space-y-1" style="color: var(--danger);">
                        {#each importResolutionResult.errors as error}
                          <li>{error.url}: {error.error}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                </div>
              {/if}

              <div class="flex gap-3 justify-end pt-2" style="border-top: 1px solid var(--border);">
                <button
                  type="button"
                  onclick={() => editMode = false}
                  class="btn-outline"
                >
                  {$_('cancel')}
                </button>
                <div class="relative inline-flex">
                  <button
                    type="button"
                    onclick={handleTranslate}
                    disabled={isTranslating}
                    class="btn-outline inline-flex items-center gap-2 rounded-r-none disabled:opacity-50"
                  >
                    <div class="grid grid-cols-3 gap-0.5">
                      {#each [...$enabledLanguages] as lang}
                        <LanguageStatusLED 
                          language={lang} 
                          status={
                            translationStatuses[lang] === 'success' ? 'success' :
                            translationStatuses[lang] === 'error' ? 'error' : 
                            'default'
                          }
                        />
                      {/each}
                    </div>
                    {#if isTranslating}
                      {$_('translating')}...
                    {:else}
                      {$_('translate_and_post')}
                    {/if}
                  </button>
                  <button
                    type="button"
                    onclick={() => handleTranslate(true)}
                    disabled={isTranslating}
                    title={$_('force_retranslate_tooltip')}
                    class="btn-outline rounded-l-none px-2 disabled:opacity-50"
                    style="border-left: none;"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
                <button
                  type="button"
                  onclick={handleEncrypt}
                  class="btn-outline inline-flex items-center gap-1.5"
                >
                  {#if isEncrypting || selectedPost.isEncrypted}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
                    </svg>
                    {$_('decrypt_post')}
                  {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />
                    </svg>
                    {$_('encrypt_post')}
                  {/if}
                </button>
                <button
                  type="button"
                  onclick={saveEditedPost}
                  class="btn-primary"
                >
                  {$_('save_changes')}
                </button>
              </div>
            </div>
          </div>
        {:else}
          <!-- View Mode -->
          <div class="card">
            <div class="flex justify-end px-4 pt-3 gap-1">
              <button
                type="button"
                onclick={exportToPdf}
                class="btn-icon"
                aria-label={$_('export_as_pdf')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                  <path d="M14 11a1 1 0 01-1 1H7a1 1 0 110-2h6a1 1 0 011 1z" />
                </svg>
              </button>
              <button
                type="button"
                onclick={exportToLatex}
                class="btn-icon"
                aria-label={$_('export_as_latex')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
            <BlogPost post={selectedPost} />
          </div>
        {/if}
      {:else}
        <div class="card p-8 text-center" style="color: var(--text-muted);">
          <p>{$_('select_post_to_view')}</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- History Modal -->
{#if showHistory}
  <div class="fixed inset-0 flex items-center justify-center z-50" style="background-color: rgba(0, 0, 0, 0.4); backdrop-filter: blur(2px);">
    <div class="card p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto mx-4" style="box-shadow: var(--shadow-lg);">
      <h3 class="text-lg font-semibold mb-4" style="color: var(--text);">{$_('post_history')}</h3>
      <div class="space-y-3">
        {#each postHistory as version}
          <div class="p-4 rounded-md" style="border: 1px solid var(--border);">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs" style="color: var(--text-muted);">{formatTimestamp(version.createdAt)}</span>
              <button
                class="btn-primary btn-sm"
                onclick={() => restoreVersion(version)}
              >
                {$_('restore_this_version')}
              </button>
            </div>
            <h4 class="font-medium text-sm" style="color: var(--text);">{version.title}</h4>
            <div class="relative">
              <p class="text-xs mt-1 cursor-help" style="color: var(--text-secondary);">{version.content ? version.content.substring(0, version.content.length > 100 ? 100 : version.content.length) : $_('no_content')}...</p>
              {#if version.content && version.content.length > 100}
                <div class="content-tooltip">
                  <div class="tooltip-content">
                    {version.content}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      <button
        class="btn-outline mt-4"
        onclick={() => showHistory = false}
      >
        {$_('close')}
      </button>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <div class="fixed inset-0 flex items-center justify-center z-50" style="background-color: rgba(0, 0, 0, 0.4); backdrop-filter: blur(2px);">
    <div class="card p-6 max-w-md w-full mx-4" style="box-shadow: var(--shadow-lg);">
      <h3 class="text-lg font-semibold mb-3" style="color: var(--text);">{$_('confirm_delete')}</h3>
      <p class="text-sm mb-4" style="color: var(--text-secondary);">
        {$_('delete_post_confirm')} "{postToDelete?.title}"?
      </p>
      
      <div class="mb-6 space-y-2">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            id="delete-current"
            bind:group={deleteAllTranslations}
            value={false}
            style="color: var(--accent);"
          />
          <span class="text-sm" style="color: var(--text-secondary);">
            {$_('delete_current_language_only')} ({postToDelete?.language || $locale})
          </span>
        </label>
        
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            id="delete-all"
            bind:group={deleteAllTranslations}
            value={true}
            style="color: var(--accent);"
          />
          <span class="text-sm" style="color: var(--text-secondary);">
            {$_('delete_all_translations')}
          </span>
        </label>
      </div>

      <div class="flex justify-end gap-3">
        <button
          class="btn-outline"
          onclick={() => {
            showDeleteConfirm = false;
            postToDelete = null;
            deleteAllTranslations = false;
          }}
        >
          {$_('cancel')}
        </button>
        <button
          class="btn-danger"
          onclick={confirmDelete}
        >
          {$_('delete')}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showPasswordPrompt && selectedPost}
  <PostPasswordPrompt
    mode={selectedPost.isEncrypted? 'decrypt' : 'encrypt'}
    on:passwordSubmitted={passwordSubmitted}
    on:postDecrypted={handlePostDecrypted}
    on:cancel={() => {
      info('cancel');
      showPasswordPrompt = false;
      isEncrypting = false;
    }}
    post={{
      title: editedTitle,
      content: editedContent
    }}
  />
{/if} 
<style>
  h3 {
    max-width: 100%; 
  }

  .transition-opacity {
    transition: opacity 0.15s ease;
  }

  @media (max-width: 768px) {
    .responsive-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    .responsive-grid > * {
      grid-column: 1 !important;
    }
    .post-list-container {
      max-width: 100vw;
      overflow-x: hidden;
    }
  }

  .relative {
    position: relative;
  }
  
  .content-tooltip .tooltip-content {
    visibility: hidden;
    position: absolute;
    z-index: 100;
    width: 300px;
    max-height: 200px;
    overflow-y: auto;
    bottom: 125%;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--bg-secondary);
    color: var(--text);
    padding: 0.75rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow-lg);
    opacity: 0;
    transition: opacity 0.2s, visibility 0.2s;
  }
  
  .relative:hover .content-tooltip .tooltip-content {
    visibility: visible;
    opacity: 1;
  }

  .post-item {
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    user-select: none;
    position: relative;
    word-wrap: break-word;
    overflow-wrap: break-word;
    min-width: 0;
  }

  .post-item:hover {
    background-color: var(--bg-hover) !important;
  }

  .action-buttons button {
    min-width: 32px;
    min-height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 768px) {
    .post-item {
      padding: 12px;
      max-width: 100%;
      overflow: hidden;
    }
    .action-buttons {
      opacity: 1 !important;
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      flex-shrink: 0;
    }
    .post-content {
      max-width: 100%;
      overflow: hidden;
    }
    .post-content .flex {
      flex-wrap: wrap;
    }
    .post-content h3 {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: calc(100% - 120px);
    }
  }

  :global([dir="rtl"]) .flex {
    flex-direction: row-reverse;
  }
  :global([dir="rtl"]) .text-left {
    text-align: right;
  }
</style>
