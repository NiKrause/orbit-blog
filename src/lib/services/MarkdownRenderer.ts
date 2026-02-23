import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { unixfs } from '@helia/unixfs';
import mermaid from 'mermaid';
import { error, info } from '../utils/logger.js';
import { helia } from '../store.js';
import { get } from 'svelte/store';

/**
 * Custom accordion extension for markdown processing
 * Allows creation of collapsible sections using ---- syntax
 */
const accordionExtension = {
  name: 'accordion',
  level: 'block',
  start(src: string) {
    return src.match(/^----\s*\n/)?.index;
  },
  tokenizer(src: string, tokens: any) {
    const dashRule = /^----\s*\n/;
    if (!dashRule.test(src)) return;

    const afterDashes = src.replace(dashRule, '');
    const rule = /^(#{1,6}\s*(.+?))\n([\s\S]*?)(?=\n----|\n#{1,6}\s|$)/;
    const match = rule.exec(afterDashes);
    
    if (match) {
      const [raw, headerLine, title, content] = match;
      const token = {
        type: 'accordion',
        raw: '----\n' + raw,
        headerLine,
        title: title.trim(), 
        content: content.trim(),
        tokens: [],
        contentTokens: []
      };
      
      this.lexer.inline(headerLine.trim(), token.tokens);
      this.lexer.blockTokens(content.trim(), token.contentTokens);
      
      return token;
    }
  },
  renderer(token: any) {
    const accordionId = `accordion-${Math.random().toString(36).substr(2, 9)}`;
    
    // Parse content with strict sanitization
    const headerContent = this.parser.parseInline(token.tokens).replace(/#/g, '');
    const bodyContent = this.parser.parse(token.contentTokens);
    
    // Apply additional sanitization with very strict rules for accordion content
    const sanitizeConfig = {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'iframe'],
      ALLOWED_ATTR: ['class', 'src', 'width', 'height', 'frameborder', 'allowfullscreen'],
      FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
      FORBID_ATTR: ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'style'],
      ALLOW_DATA_ATTR: false
    };
    
    const sanitizedHeader = DOMPurify.sanitize(headerContent, sanitizeConfig);
    const sanitizedBody = DOMPurify.sanitize(bodyContent, sanitizeConfig);
    
    return `
      <div class="accordion-wrapper">
        <details class="accordion" id="${accordionId}">
          <summary class="accordion-header" tabindex="0">
            ${sanitizedHeader}
          </summary>
          <div class="accordion-content">
            ${sanitizedBody}
          </div>
        </details>
      </div>`;
  },
  childTokens: ['tokens', 'contentTokens']
};

/**
 * Remote markdown import extension
 * Allows importing markdown from remote URLs using @import[url] syntax
 */
const remoteImportExtension = {
  name: 'remoteImport',
  level: 'block',
  start(src: string) {
    return src.match(/^@import\[/)?.index;
  },
  tokenizer(src: string, tokens: any) {
    const rule = /^@import\[([^\]]+)\](?:\s*\{([^}]*)\})?/;
    const match = rule.exec(src);
    
    if (match) {
      const [raw, url, options] = match;
      
      // Parse options to check if this is a physical import
      const parsedOptions: Record<string, string> = {};
      if (options) {
        options.split(',').forEach(opt => {
          const [key, value] = opt.split('=').map(s => s.trim());
          if (key && value) {
            parsedOptions[key] = value;
          }
        });
      }
      
      // Skip physical imports during rendering - they should be resolved before rendering
      if (parsedOptions.physical === 'true') {
        return {
          type: 'physicalImportPlaceholder',
          raw,
          url: url.trim(),
          options: options || '',
          tokens: []
        };
      }
      
      const token = {
        type: 'remoteImport',
        raw,
        url: url.trim(),
        options: options ? options.trim() : '',
        tokens: []
      };
      
      return token;
    }
  },
  renderer(token: any) {
    const importId = `remote-import-${Math.random().toString(36).substr(2, 9)}`;
    const { url, options } = token;
    
    // Parse options (e.g., "section=API, cache=false")
    const opts = {};
    if (options) {
      options.split(',').forEach(opt => {
        const [key, value] = opt.split('=').map(s => s.trim());
        if (key && value) {
          opts[key] = value;
        }
      });
    }
    
    // Create placeholder that will be replaced with actual content
    setTimeout(async () => {
      try {
        const element = document.getElementById(importId);
        if (!element) return;
        
        element.innerHTML = `
          <div class="remote-import-loading flex items-center space-x-2 p-4 bg-blue-50 dark:bg-blue-900 rounded-md">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span class="text-blue-700 dark:text-blue-300 text-sm">Loading content from ${url}...</span>
          </div>
        `;
        
        const remoteContent = await fetchRemoteMarkdown(url);
        
        // Process the remote content through markdown renderer
        // Note: We need to be careful about infinite recursion
        const processedContent = marked.parse(remoteContent, { renderer: setupRenderer() });
        const sanitizedContent = DOMPurify.sanitize(processedContent as string, {
          ADD_TAGS: ['details', 'summary', 'div', 'section', 'article', 'iframe'],
          ADD_ATTR: ['id', 'class', 'aria-controls', 'aria-expanded', 'aria-labelledby', 'role', 'data-ipfs-cid', 'src', 'alt', 'title', 'data-remote-url', 'width', 'height', 'frameborder', 'allowfullscreen', 'sandbox', 'loading', 'referrerpolicy'],
          ALLOW_DATA_ATTR: true
        });
        
        element.innerHTML = `
          <div class="remote-import-content border-l-4 border-green-500 pl-4 my-4" data-remote-url="${url}">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
              📄 Imported from: <a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">  ${url.split('/').pop()}</a>
            </div>
            ${sanitizedContent}
          </div>
        `;
        
        element.classList.remove('remote-import-loading');
        element.classList.add('remote-import-loaded');
        
      } catch (fetchError) {
        error(`Failed to load remote markdown from ${url}:`, fetchError);
        const element = document.getElementById(importId);
        if (element) {
          element.innerHTML = `
            <div class="remote-import-error p-4 bg-red-50 dark:bg-red-900 rounded-md border border-red-200 dark:border-red-700">
              <div class="flex items-start space-x-2">
                <svg class="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
                <div class="flex-1">
                  <h4 class="text-red-800 dark:text-red-200 font-medium">Failed to load remote content</h4>
                  <p class="text-red-700 dark:text-red-300 text-sm mt-1">Could not fetch markdown from: <code class="bg-red-100 dark:bg-red-800 px-1 rounded">${url}</code></p>
                  <p class="text-red-600 dark:text-red-400 text-xs mt-2">${fetchError.message}</p>
                </div>
              </div>
            </div>
          `;
          element.classList.remove('remote-import-loading');
          element.classList.add('remote-import-error');
        }
      }
    }, 0);
    
    // Return placeholder div
    return `<div id="${importId}" class="remote-import-placeholder">
      <div class="remote-import-loading flex items-center space-x-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
        <div class="animate-pulse rounded-full h-4 w-4 bg-gray-400"></div>
        <span class="text-gray-600 dark:text-gray-400 text-sm">Preparing to load content from ${url}...</span>
      </div>
    </div>`;
  }
};

/**
 * Singleton instance of UnixFS for IPFS operations
 */
let fs: ReturnType<typeof unixfs>;
const mediaCache = new Map<string, string>();

/**
 * Cache for remote markdown content with expiration
 */
interface RemoteContentCache {
  content: string;
  timestamp: number;
  expiry: number;
}

const remoteMarkdownCache = new Map<string, RemoteContentCache>();
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if a URL is allowed for remote markdown fetching
 */
function isAllowedMarkdownUrl(url: string): boolean {
  const allowedDomains = [
    'raw.githubusercontent.com',
    'gist.githubusercontent.com',
    'gitlab.com',
    'bitbucket.org',
    // Add more trusted domains as needed
  ];

  try {
    const urlObj = new URL(url);
    return allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

/**
 * Fetches remote markdown content with caching
 */
async function fetchRemoteMarkdown(url: string): Promise<string> {
  // Check cache first
  const cached = remoteMarkdownCache.get(url);
  if (cached && Date.now() < cached.expiry) {
    info(`Using cached content for ${url}`);
    return cached.content;
  }

  // Validate URL
  if (!isAllowedMarkdownUrl(url)) {
    throw new Error(`Domain not allowed for remote markdown: ${url}`);
  }

  try {
    info(`Fetching remote markdown from ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain, text/markdown, text/*',
        'User-Agent': 'Le-Space-Blog/1.0'
      },
      // Add timeout
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    
    // Cache the content
    remoteMarkdownCache.set(url, {
      content,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_EXPIRY_MS
    });

    info(`Successfully fetched and cached markdown from ${url}`);
    return content;
  } catch (fetchError) {
    error(`Failed to fetch remote markdown from ${url}:`, fetchError);
    
    // Try to return stale cache if available
    if (cached) {
      info(`Using stale cached content for ${url}`);
      return cached.content;
    }
    
    throw fetchError;
  }
}

/**
 * Checks if a domain is allowed for iframe embedding
 */
function isAllowedDomain(src: string, node?: Element): boolean {
  const allowedDomains = [
    // Western platforms
    'youtube.com', 'youtu.be', 'youtube-nocookie.com', // YouTube domains
    'player.vimeo.com',                // Vimeo embed
    'www.dailymotion.com',             // Dailymotion
    'rutube.ru', 'video.rutube.ru',    // RuTube
    'player.bilibili.com',             // Bilibili embed
    'player.youku.com',                // Youku embed
    'embed.nicovideo.jp',              // Niconico embed
    'www.tudou.com',                   // Tudou
    'player.iqiyi.com',                // iQiyi embed
    'v.qq.com', 'video.qq.com',        // Tencent Video
    'tv.naver.com',                    // Naver TV
    'www.vlive.tv',                    // VLive
    'embed.peertube.tv'                // PeerTube
  ];

  try {
    const url = new URL(src);
    
    // Special handling for YouTube URLs to convert them to embed format
    if (url.hostname === 'www.youtube.com' && url.pathname.startsWith('/watch')) {
      const videoId = url.searchParams.get('v');
      if (videoId && node) {
        // Replace the node's src with the embed URL
        node.setAttribute('src', `https://www.youtube-nocookie.com/embed/${videoId}`);
        // Add helpful attributes
        if (!node.hasAttribute('width')) node.setAttribute('width', '560');
        if (!node.hasAttribute('height')) node.setAttribute('height', '315');
        if (!node.hasAttribute('frameborder')) node.setAttribute('frameborder', '0');
        if (!node.hasAttribute('allowfullscreen')) node.setAttribute('allowfullscreen', '');
        return true;
      }
    }
    
    // Handle youtu.be short URLs
    if (url.hostname === 'youtu.be') {
      const videoId = url.pathname.slice(1); // Remove leading slash
      if (videoId && node) {
        node.setAttribute('src', `https://www.youtube-nocookie.com/embed/${videoId}`);
        if (!node.hasAttribute('width')) node.setAttribute('width', '560');
        if (!node.hasAttribute('height')) node.setAttribute('height', '315');
        if (!node.hasAttribute('frameborder')) node.setAttribute('frameborder', '0');
        if (!node.hasAttribute('allowfullscreen')) node.setAttribute('allowfullscreen', '');
        return true;
      }
    }
    
    return allowedDomains.some(domain => url.hostname.endsWith(domain));
  } catch {
    return false;
  }
}

/**
 * Initializes IPFS UnixFS instance.
 */
function initUnixFs() {
  if (!fs) {
    const heliaInstance = get(helia);
    if (heliaInstance && typeof heliaInstance === 'object' && 'blockstore' in heliaInstance) {
      fs = unixfs(heliaInstance as any);
    }
  }
}

async function waitForUnixFs(maxAttempts = 20, delayMs = 500): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    initUnixFs();
    if (fs) return true;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

/**
 * Retrieves a blob URL for an IPFS CID from local Helia only.
 *
 * @param cid - The IPFS content identifier
 * @returns The blob URL or null when unavailable in the connected Helia network
 */
async function getBlobUrl(cid: string): Promise<string | null> {
  if (mediaCache.has(cid)) return mediaCache.get(cid) || null;

  const hasFs = await waitForUnixFs();
  if (!hasFs || !fs) {
    info(`Helia UnixFS is not ready yet; cannot load CID ${cid}`);
    return null;
  }

  try {
    const chunks: Uint8Array[] = [];
    for await (const chunk of fs.cat(cid as any)) {
      chunks.push(chunk);
    }

    const blob = new Blob(chunks as BlobPart[]);
    const url = URL.createObjectURL(blob);
    mediaCache.set(cid, url);
    return url;
  } catch (_error) {
    error(`Error fetching CID ${cid} from local Helia:`, _error);
    return null;
  }
}

/**
 * Parses image size options from markdown syntax
 * Supports: ![alt](url){size=small|medium|large|full} or ![alt](url){width=300,height=200}
 */
function parseImageSizeOptions(text: string): { sizeClass: string; attributes: string; cleanText: string } {
  // Check for size options in curly braces at the end of alt text
  const sizeMatch = text?.match(/^(.*)\{(.+)\}$/);
  if (!sizeMatch) {
    return { sizeClass: '', attributes: '', cleanText: text || '' };
  }

  const cleanText = sizeMatch[1].trim();
  const options = sizeMatch[2].trim();
  let sizeClass = '';
  let attributes = '';

  // Parse different option formats
  const optionPairs = options.split(',').map(opt => opt.trim());
  
  optionPairs.forEach(option => {
    const [key, value] = option.split('=').map(s => s.trim());
    
    switch (key) {
      case 'size':
        switch (value) {
          case 'xs':
          case 'tiny':
            sizeClass += ' w-16 h-auto';
            break;
          case 'small':
          case 'sm':
            sizeClass += ' w-32 h-auto';
            break;
          case 'medium':
          case 'md':
            sizeClass += ' w-64 h-auto';
            break;
          case 'large':
          case 'lg':
            sizeClass += ' w-96 h-auto';
            break;
          case 'xl':
          case 'extra-large':
            sizeClass += ' w-[32rem] h-auto';
            break;
          case 'full':
            sizeClass += ' w-full h-auto';
            break;
          case 'responsive':
            sizeClass += ' w-full sm:w-1/2 md:w-1/3 lg:w-1/4 h-auto';
            break;
          default:
            sizeClass += ' w-64 h-auto'; // default to medium
        }
        break;
      case 'width':
        if (value.match(/^\d+$/)) {
          attributes += ` width="${value}"`;
        } else {
          sizeClass += ` w-[${value}]`;
        }
        break;
      case 'height':
        if (value.match(/^\d+$/)) {
          attributes += ` height="${value}"`;
        } else {
          sizeClass += ` h-[${value}]`;
        }
        break;
      case 'class':
        sizeClass += ` ${value}`;
        break;
      case 'align':
        switch (value) {
          case 'left':
            sizeClass += ' float-left mr-4 mb-2';
            break;
          case 'right':
            sizeClass += ' float-right ml-4 mb-2';
            break;
          case 'center':
            sizeClass += ' mx-auto block';
            break;
        }
        break;
      case 'rounded':
        if (value === 'true' || value === '') {
          sizeClass += ' rounded-lg';
        } else if (value === 'full') {
          sizeClass += ' rounded-full';
        }
        break;
    }
  });

  return { sizeClass: sizeClass.trim(), attributes: attributes.trim(), cleanText };
}

/**
 * Configure and retrieve the marked renderer
 */
function setupRenderer(): typeof marked.Renderer.prototype {
  const renderer = new marked.Renderer();
  const defaultImageRenderer = renderer.image.bind(renderer);

  renderer.image = (href, title, text) => {
    // Parse size options from alt text
    const { sizeClass, attributes, cleanText } = parseImageSizeOptions(text);
    const finalAltText = cleanText || 'Image';
    
    if (href.startsWith('ipfs://')) {
      const cid = href.replace('ipfs://', '');
      
      // Create a placeholder image that will be replaced
      const placeholderId = `ipfs-img-${Math.random().toString(36).substr(2, 9)}`;
      
      // Schedule async loading of the IPFS content
      setTimeout(async () => {
        try {
          let blobUrl: string | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            blobUrl = await getBlobUrl(cid);
            if (blobUrl) break;
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }

          const imgElement = document.getElementById(placeholderId);
          if (imgElement && blobUrl) {
            imgElement.setAttribute('src', blobUrl);
            imgElement.classList.remove('ipfs-loading');
            imgElement.classList.add('ipfs-loaded');
          } else if (imgElement) {
            imgElement.classList.remove('ipfs-loading');
            imgElement.classList.add('ipfs-error');
            imgElement.setAttribute('title', 'Unable to load from local IPFS/Helia');
          }
        } catch (error) {
          console.error('Failed to load IPFS image:', error);
          const imgElement = document.getElementById(placeholderId);
          if (imgElement) {
            imgElement.classList.remove('ipfs-loading');
            imgElement.classList.add('ipfs-error');
            imgElement.setAttribute('title', 'Unable to load from local IPFS/Helia');
          }
        }
      }, 0);
      
      // Build class string with both IPFS and size classes
      const combinedClasses = `ipfs-loading${sizeClass ? ' ' + sizeClass : ''}`;
      
      // Return placeholder image with loading state and size classes
      return `<img id="${placeholderId}" 
                   src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='12' text-anchor='middle' dy='.3em' fill='%236b7280'%3ELoading...%3C/text%3E%3C/svg%3E" 
                   alt="${finalAltText}" 
                   title="${title || 'Loading IPFS content...'}" 
                   class="${combinedClasses}" 
                   data-ipfs-cid="${cid}" 
                   ${attributes} />`;
    }
    
    // Handle regular images with size options
    const classAttr = sizeClass ? ` class="${sizeClass}"` : '';
    const attributesStr = attributes ? ` ${attributes}` : '';
    const titleAttr = title ? ` title="${title}"` : '';
    
    return `<img src="${href}" alt="${finalAltText}"${titleAttr}${classAttr}${attributesStr} />`;
  };

  renderer.code = (code, language) => {
    if (language === 'mermaid') {
      return `<div class="mermaid">${code}</div>`;
    }
    // Escape HTML entities and curly braces to prevent interpretation
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\{/g, '&#123;')
      .replace(/\}/g, '&#125;');
    return `<pre><code>${escapedCode}</code></pre>`;
  };

  // Also handle inline code spans
  renderer.codespan = (code) => {
    // Escape curly braces to prevent Svelte template interpretation
    const sanitizedCode = DOMPurify.sanitize(code)
      .replace(/\{/g, '&#123;')
      .replace(/\}/g, '&#125;');
    return `<code>${sanitizedCode}</code>`;
  };

  return renderer;
}

/**
 * Physical import placeholder extension
 * Shows a notice that physical imports should be resolved before rendering
 */
const physicalImportPlaceholderExtension = {
  name: 'physicalImportPlaceholder',
  level: 'block',
  renderer(token: any) {
    const { url } = token;
    return `
      <div class="physical-import-placeholder p-4 bg-yellow-50 dark:bg-yellow-900 rounded-md border border-yellow-200 dark:border-yellow-700 my-4">
        <div class="flex items-start space-x-2">
          <svg class="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <div class="flex-1">
            <h4 class="text-yellow-800 dark:text-yellow-200 font-medium">Physical Import Pending</h4>
            <p class="text-yellow-700 dark:text-yellow-300 text-sm mt-1">This import needs to be resolved: <code class="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">${url}</code></p>
            <p class="text-yellow-600 dark:text-yellow-400 text-xs mt-2">Use the "Resolve Imports" button to fetch and embed the content before saving.</p>
          </div>
        </div>
      </div>
    `;
  }
};

/**
 * Configure marked with extensions
 */
function configureMarked() {
  marked.use({ extensions: [accordionExtension, remoteImportExtension, physicalImportPlaceholderExtension] });
}

// Mermaid initialization
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose'
});

/**
 * Renders mermaid diagrams in the DOM
 * Call this after content is added to the DOM
 */
export async function renderMermaidDiagrams(): Promise<void> {
  try {
    await mermaid.run({
      querySelector: '.mermaid'
    });
  } catch (error) {
    console.error('Error rendering mermaid diagrams:', error);
  }
}

/**
 * Setup DOMPurify hooks for iframe sanitization and security
 */
function setupDOMPurifyHooks(): void {
  // Clear any existing hooks first
  DOMPurify.removeAllHooks();
  
  // Custom DOMPurify hook for iframe security
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'iframe') {
      const element = node as Element;
      const src = element.getAttribute('src');
      if (!src || !isAllowedDomain(src, element)) {
        // Replace blocked iframe with helpful error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'iframe-error p-4 bg-red-50 dark:bg-red-900 rounded-md border border-red-200 dark:border-red-700 my-4';
        errorDiv.innerHTML = `
          <div class="flex items-start space-x-2">
            <svg class="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <div class="flex-1">
              <h4 class="text-red-800 dark:text-red-200 font-medium">Video Embedding Blocked</h4>
              <p class="text-red-700 dark:text-red-300 text-sm mt-1">This video platform doesn't allow embedding: <code class="bg-red-100 dark:bg-red-800 px-1 rounded">${src}</code></p>
              <p class="text-red-600 dark:text-red-400 text-xs mt-2">Try using a link instead: <a href="${src}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">Open Video</a></p>
            </div>
          </div>
        `;
        node.parentNode?.replaceChild(errorDiv, node);
        return;
      }
      
      // Set secure attributes for iframes
      element.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
      element.setAttribute('loading', 'lazy');
      element.setAttribute('referrerpolicy', 'no-referrer');
    }
  });
  
  // Hook to remove dangerous attributes but preserve code content
  DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
    const attrName = data.attrName || '';
    const attrValue = data.attrValue || '';
    
    // Block event handlers
    if (attrName.startsWith('on')) {
      data.allowedAttributes = data.allowedAttributes || {};
      delete data.allowedAttributes[attrName];
      (node as Element).removeAttribute(attrName);
      return;
    }
    
    // Block dangerous attribute patterns (but allow code content)
    const dangerousAttrPatterns = [
      /javascript:/i,               // JavaScript URLs
      /data:text\/html/i,           // Data URLs with HTML
      /vbscript:/i,                 // VBScript URLs
      /eval\s*\(/i,               // eval in attributes
    ];
    
    const isDangerousAttr = dangerousAttrPatterns.some(pattern => 
      pattern.test(attrName) || pattern.test(attrValue)
    );
    
    if (isDangerousAttr) {
      data.allowedAttributes = data.allowedAttributes || {};
      delete data.allowedAttributes[attrName];
      (node as Element).removeAttribute(attrName);
    }
  });
}

/**
 * Primary function to render content
 *
 * @param content - The markdown content
 * @param options - Options to add custom renderers
 * @returns Rendered content
 */
export function renderContent(content: string): string {
  // Setup DOMPurify hooks before sanitization
  setupDOMPurifyHooks();
  
  // Configure marked with extensions
  configureMarked();
  
  const renderedContent = marked.parse(content, { renderer: setupRenderer() }) as string;
  return DOMPurify.sanitize(renderedContent, {
    ADD_TAGS: ['details', 'summary', 'div', 'section', 'article', 'svg', 'path', 'iframe'],
    ADD_ATTR: [
      'id', 'class', 'aria-controls', 'aria-expanded', 'aria-labelledby', 'role', 
      'data-ipfs-cid', 'data-remote-url', 'src', 'alt', 'title', 'href', 'target', 
      'rel', 'viewBox', 'fill', 'fill-rule', 'clip-rule', 'd', 'width', 'height', 
      'frameborder', 'allowfullscreen', 'sandbox', 'loading', 'referrerpolicy'
    ],
    ALLOW_DATA_ATTR: true
  });
}
