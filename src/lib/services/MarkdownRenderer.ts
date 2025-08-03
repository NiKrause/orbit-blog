import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { unixfs } from '@helia/unixfs';
import mermaid from 'mermaid';
import { error } from '../utils/logger.js';
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
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
      ALLOWED_ATTR: ['class'],
      FORBID_TAGS: ['script', 'style', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'iframe'],
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
 * Singleton instance of UnixFS for IPFS operations
 */
let fs: ReturnType<typeof unixfs>;
const mediaCache = new Map<string, string>();

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

/**
 * Retrieves a blob URL for an IPFS CID.
 *
 * @param cid - The IPFS content identifier
 * @returns The blob URL or gateway URL
 */
async function getBlobUrl(cid: string): Promise<string | null> {
  if (!fs) initUnixFs();
  if (mediaCache.has(cid)) return mediaCache.get(cid) || null;

  try {
    const chunks = [];
    for await (const chunk of fs.cat(cid as any)) {
      chunks.push(chunk);
    }

    const fileData = new Uint8Array(chunks.reduce((acc, val) => [...acc, ...val], []));
    const blob = new Blob([fileData]);
    const url = URL.createObjectURL(blob);
    mediaCache.set(cid, url);
    return url;
  } catch (_error) {
    error('Error fetching from IPFS:', _error);
    return `https://dweb.link/ipfs/${cid}`;
  }
}

/**
 * Configure and retrieve the marked renderer
 */
function setupRenderer(): typeof marked.Renderer.prototype {
  const renderer = new marked.Renderer();
  const defaultImageRenderer = renderer.image.bind(renderer);

  renderer.image = (href, title, text) => {
    if (href.startsWith('ipfs://')) {
      const cid = href.replace('ipfs://', '');
      
      // Create a placeholder image that will be replaced
      const placeholderId = `ipfs-img-${Math.random().toString(36).substr(2, 9)}`;
      
      // Schedule async loading of the IPFS content
      setTimeout(async () => {
        try {
          const blobUrl = await getBlobUrl(cid);
          const imgElement = document.getElementById(placeholderId);
          if (imgElement && blobUrl) {
            imgElement.setAttribute('src', blobUrl);
            imgElement.classList.remove('ipfs-loading');
            imgElement.classList.add('ipfs-loaded');
          }
        } catch (error) {
          console.error('Failed to load IPFS image:', error);
          const imgElement = document.getElementById(placeholderId);
          if (imgElement) {
            // Fallback to gateway URL
            imgElement.setAttribute('src', `https://dweb.link/ipfs/${cid}`);
            imgElement.classList.remove('ipfs-loading');
            imgElement.classList.add('ipfs-error');
          }
        }
      }, 0);
      
      // Return placeholder image with loading state
      return `<img id="${placeholderId}" 
                   src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='12' text-anchor='middle' dy='.3em' fill='%236b7280'%3ELoading...%3C/text%3E%3C/svg%3E" 
                   alt="${text || 'IPFS Image'}" 
                   title="${title || 'Loading IPFS content...'}" 
                   class="ipfs-loading" 
                   data-ipfs-cid="${cid}" />`;
    }
    return defaultImageRenderer(href, title, text);
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
 * Configure marked with extensions
 */
function configureMarked() {
  marked.use({ extensions: [accordionExtension] });
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
        return node.parentNode?.removeChild(node);
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
    ADD_TAGS: ['details', 'summary', 'div'],
    ADD_ATTR: ['id', 'class', 'aria-controls', 'aria-expanded', 'aria-labelledby', 'role', 'data-ipfs-cid', 'src', 'alt', 'title'],
    ALLOW_DATA_ATTR: true
  });
}

