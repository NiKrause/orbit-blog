import type { BlogPost } from '$lib/types.js';
import { get } from 'svelte/store';
import { locale } from 'svelte-i18n';
import { getBrowserLanguagePreferences } from '$lib/i18n/index.js';
import { info } from '../utils/logger.js';

/**
 * Interface for post group representing the same content in different languages
 */
interface PostGroup {
  originalPostId: string | null;
  posts: BlogPost[];
  availableLanguages: string[];
}

/**
 * Groups posts by their original content (handling translations)
 */
function groupPostsByOriginalContent(posts: BlogPost[]): Map<string, PostGroup> {
  const groups = new Map<string, PostGroup>();
  
  posts.forEach(post => {
    // Determine the group key - use originalPostId if it's a translation, otherwise use the post's own ID
    const groupKey = post.originalPostId || post._id;
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        originalPostId: post.originalPostId,
        posts: [],
        availableLanguages: []
      });
    }
    
    const group = groups.get(groupKey)!;
    group.posts.push(post);
    
    // Add language to available languages if not already present
    const postLang = post.language || 'en'; // Default to 'en' for posts without language
    if (!group.availableLanguages.includes(postLang)) {
      group.availableLanguages.push(postLang);
    }
  });
  
  return groups;
}

/**
 * Finds the best language match for a post group based on browser preferences
 */
function findBestLanguageMatch(group: PostGroup, browserLanguages: string[], currentLocale: string): BlogPost | null {
  const availableLanguages = group.availableLanguages;
  
  // Priority 1: Current UI language (if user manually selected it)
  if (availableLanguages.includes(currentLocale)) {
    const post = group.posts.find(p => p.language === currentLocale);
    if (post) {
      info(`Language fallback: Found post in current UI language '${currentLocale}'`);
      return post;
    }
  }
  
  // Priority 2: Browser language preferences in order
  for (const browserLang of browserLanguages) {
    if (availableLanguages.includes(browserLang)) {
      const post = group.posts.find(p => p.language === browserLang);
      if (post) {
        info(`Language fallback: Found post in browser preferred language '${browserLang}'`);
        return post;
      }
    }
  }
  
  // Priority 3: English as fallback
  if (availableLanguages.includes('en')) {
    const post = group.posts.find(p => p.language === 'en');
    if (post) {
      info(`Language fallback: Using English fallback`);
      return post;
    }
  }
  
  // Priority 4: Any available language (take the first one, preferably original)
  if (group.posts.length > 0) {
    // Try to find the original post first (without originalPostId)
    const originalPost = group.posts.find(p => !p.originalPostId);
    if (originalPost) {
      info(`Language fallback: Using original post in language '${originalPost.language || 'unknown'}'`);
      return originalPost;
    }
    
    // Otherwise take the first available translation
    const firstPost = group.posts[0];
    info(`Language fallback: Using first available translation in language '${firstPost.language || 'unknown'}'`);
    return firstPost;
  }
  
  return null;
}

/**
 * Main function to filter posts with intelligent language fallback
 * 
 * @param posts All available posts
 * @param searchTerm Optional search term filter
 * @param selectedCategory Optional category filter  
 * @param hasWriteAccess Function to check if user has write access
 * @returns Array of posts with best language matches
 */
export function filterPostsWithLanguageFallback(
  posts: BlogPost[],
  searchTerm: string = '',
  selectedCategory: string | 'All' = 'All',
  hasWriteAccess: () => boolean = () => true
): BlogPost[] {
  const currentLocale = get(locale) || 'en';
  const browserLanguages = getBrowserLanguagePreferences();
  
  info(`Language fallback: Current locale '${currentLocale}', Browser preferences: [${browserLanguages.join(', ')}]`);
  
  // First apply non-language filters
  const filteredPosts = posts.filter(post => {
    // For users without write access, only show published posts
    if (!hasWriteAccess() && post.published === false) return false;
    
    // Category filter
    const matchesCategory = selectedCategory === 'All' || selectedCategory === undefined || 
                          (post.categories && post.categories.includes(selectedCategory)) ||
                          post.category === selectedCategory;
    
    // Search filter
    const matchesSearch = !searchTerm || 
                        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        post.content.toLowerCase().includes(searchTerm.toLowerCase());
                        
    return matchesCategory && matchesSearch;
  });
  
  // Group posts by original content
  const postGroups = groupPostsByOriginalContent(filteredPosts);
  
  // Select best language match from each group
  const selectedPosts: BlogPost[] = [];
  
  postGroups.forEach((group, groupKey) => {
    const bestPost = findBestLanguageMatch(group, browserLanguages, currentLocale);
    if (bestPost) {
      selectedPosts.push(bestPost);
    }
  });
  
  // Sort by creation date (newest first)
  return selectedPosts.sort((a, b) => (b.createdAt || b.date) - (a.createdAt || a.date));
}

/**
 * Gets available languages for a specific post (including all its translations)
 */
export function getAvailableLanguagesForPost(posts: BlogPost[], postId: string): string[] {
  const targetPost = posts.find(p => p._id === postId);
  if (!targetPost) return [];
  
  // Find all related posts (translations)
  const groupKey = targetPost.originalPostId || targetPost._id;
  const relatedPosts = posts.filter(p => 
    p._id === groupKey || 
    p.originalPostId === groupKey ||
    (targetPost.originalPostId && p.originalPostId === targetPost.originalPostId)
  );
  
  // Extract unique languages
  const languages = relatedPosts
    .map(p => p.language || 'en')
    .filter((lang, index, array) => array.indexOf(lang) === index);
  
  return languages;
}

/**
 * Gets a specific translation of a post in the requested language
 */
export function getPostInLanguage(posts: BlogPost[], postId: string, targetLanguage: string): BlogPost | null {
  const targetPost = posts.find(p => p._id === postId);
  if (!targetPost) return null;
  
  // If the current post is already in the target language, return it
  if (targetPost.language === targetLanguage) {
    return targetPost;
  }
  
  // Find all related posts (translations)
  const groupKey = targetPost.originalPostId || targetPost._id;
  const relatedPosts = posts.filter(p => 
    p._id === groupKey || 
    p.originalPostId === groupKey ||
    (targetPost.originalPostId && p.originalPostId === targetPost.originalPostId)
  );
  
  // Find the post in the target language
  return relatedPosts.find(p => p.language === targetLanguage) || null;
}

/**
 * Updates the current UI locale based on post content availability and browser preferences
 * This is useful for automatically switching the UI language when there's a better match
 */
export function suggestOptimalUILanguage(posts: BlogPost[]): string {
  const currentLocale = get(locale) || 'en';
  const browserLanguages = getBrowserLanguagePreferences();
  
  // Get all available content languages
  const availableContentLanguages = new Set<string>();
  posts.forEach(post => {
    if (post.language) {
      availableContentLanguages.add(post.language);
    }
  });
  
  // If current locale has content, keep it
  if (availableContentLanguages.has(currentLocale)) {
    return currentLocale;
  }
  
  // Otherwise, find the first browser language that has content
  for (const browserLang of browserLanguages) {
    if (availableContentLanguages.has(browserLang)) {
      info(`Language fallback: Suggesting UI language switch to '${browserLang}' based on available content`);
      return browserLang;
    }
  }
  
  // Fallback to English or current locale
  return availableContentLanguages.has('en') ? 'en' : currentLocale;
}
