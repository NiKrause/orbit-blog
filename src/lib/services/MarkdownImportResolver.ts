import { info, error } from '../utils/logger.js';

/**
 * Interface for remote content cache
 */
interface RemoteContentCache {
  content: string;
  timestamp: number;
  expiry: number;
}

/**
 * Cache for remote markdown content with expiration
 */
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
 * Interface for import resolution results
 */
export interface ImportResolutionResult {
  success: boolean;
  resolvedContent: string;
  errors: Array<{ url: string; error: string }>;
  resolvedImports: Array<{ url: string; title?: string; physical: boolean }>;
}

/**
 * Service for resolving physical markdown imports
 */
export class MarkdownImportResolver {
  
  /**
   * Finds all @import statements in the markdown content
   */
  static findImports(content: string): Array<{ 
    match: string; 
    url: string; 
    options: Record<string, string>; 
    startIndex: number; 
    endIndex: number; 
  }> {
    const importRegex = /@import\[([^\]]+)\](?:\s*\{([^}]*)\})?/g;
    const imports: Array<{ 
      match: string; 
      url: string; 
      options: Record<string, string>; 
      startIndex: number; 
      endIndex: number; 
    }> = [];
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      // Parse options
      const options: Record<string, string> = {};
      if (match[2]) {
        match[2].split(',').forEach(opt => {
          const [key, value] = opt.split('=').map(s => s.trim());
          if (key && value) {
            options[key] = value === 'true' ? 'true' : value === 'false' ? 'false' : value;
          }
        });
      }
      
      imports.push({
        match: match[0],
        url: match[1].trim(),
        options,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
    
    return imports;
  }

  /**
   * Resolves physical @import statements by fetching and embedding the content
   */
  static async resolvePhysicalImports(content: string): Promise<ImportResolutionResult> {
    const imports = this.findImports(content);
    
    // Filter only physical imports
    const physicalImports = imports.filter(imp => imp.options.physical === 'true');
    
    if (physicalImports.length === 0) {
      return {
        success: true,
        resolvedContent: content,
        errors: [],
        resolvedImports: []
      };
    }

    info(`Found ${physicalImports.length} physical import statements to resolve`);
    
    let resolvedContent = content;
    const errors: Array<{ url: string; error: string }> = [];
    const resolvedImports: Array<{ url: string; title?: string; physical: boolean }> = [];
    
    // Process imports in reverse order to maintain string indices
    for (let i = physicalImports.length - 1; i >= 0; i--) {
      const importItem = physicalImports[i];
      
      try {
        info(`Resolving physical import: ${importItem.url}`);
        
        // Fetch the remote content
        const remoteContent = await fetchRemoteMarkdown(importItem.url);
        
        // Process the content based on options
        let processedContent = remoteContent;
        
        // If there's a section option, try to extract that section
        if (importItem.options.section) {
          const sectionContent = this.extractSection(remoteContent, importItem.options.section);
          if (sectionContent) {
            processedContent = sectionContent;
          }
        }
        
        // Add source attribution comment if not disabled
        let contentWithAttribution = processedContent;
        if (importItem.options.attribution !== 'false') {
          const attribution = `<!-- Imported from: ${importItem.url} at ${new Date().toISOString()} -->\n\n`;
          contentWithAttribution = attribution + processedContent + '\n\n';
        }
        
        // Replace the @import statement with the actual content
        resolvedContent = resolvedContent.substring(0, importItem.startIndex) + 
                         contentWithAttribution + 
                         resolvedContent.substring(importItem.endIndex);
        
        // Extract title from content for reporting
        const titleMatch = processedContent.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : undefined;
        
        resolvedImports.push({
          url: importItem.url,
          title: title,
          physical: true
        });
        
        info(`Successfully resolved physical import: ${importItem.url}`);
        
      } catch (fetchError) {
        error(`Failed to resolve physical import ${importItem.url}:`, fetchError);
        
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error';
        errors.push({
          url: importItem.url,
          error: errorMessage
        });
        
        // Replace the @import with an error comment
        const errorComment = `<!-- IMPORT ERROR: Failed to import from ${importItem.url} - ${errorMessage} -->\n\n`;
        resolvedContent = resolvedContent.substring(0, importItem.startIndex) + 
                         errorComment + 
                         resolvedContent.substring(importItem.endIndex);
      }
    }
    
    const success = errors.length === 0;
    
    info(`Physical import resolution completed. Success: ${success}, Resolved: ${resolvedImports.length}, Errors: ${errors.length}`);
    
    return {
      success,
      resolvedContent,
      errors,
      resolvedImports
    };
  }
  
  /**
   * Attempts to extract a specific section from markdown content
   */
  private static extractSection(content: string, sectionName: string): string | null {
    // Try to find a heading that matches the section name
    const headingRegex = new RegExp(`^(#{1,6})\\s+${sectionName}\\s*$`, 'im');
    const headingMatch = content.match(headingRegex);
    
    if (!headingMatch) {
      return null;
    }
    
    const headingLevel = headingMatch[1].length;
    const headingIndex = content.indexOf(headingMatch[0]);
    
    // Find the next heading of the same or higher level
    const nextHeadingRegex = new RegExp(`^#{1,${headingLevel}}\\s+.+$`, 'gm');
    let nextHeadingIndex = content.length;
    
    const matches = [...content.matchAll(nextHeadingRegex)];
    for (const match of matches) {
      if (match.index! > headingIndex) {
        nextHeadingIndex = match.index!;
        break;
      }
    }
    
    // Extract the section content
    const sectionContent = content.substring(headingIndex, nextHeadingIndex).trim();
    return sectionContent;
  }
  
  /**
   * Checks if content contains any physical @import statements
   */
  static hasPhysicalImports(content: string): boolean {
    const imports = this.findImports(content);
    return imports.some(imp => imp.options.physical === 'true');
  }
  
  /**
   * Gets a preview of what would be imported without actually fetching
   */
  static getImportPreview(content: string): Array<{ url: string; options: Record<string, string>; physical: boolean }> {
    const imports = this.findImports(content);
    return imports.map(imp => ({
      url: imp.url,
      options: imp.options,
      physical: imp.options.physical === 'true'
    }));
  }

  /**
   * Converts regular @import statements to physical imports
   */
  static convertToPhysicalImports(content: string): string {
    return content.replace(
      /@import\[([^\]]+)\](?:\s*\{([^}]*)\})?/g,
      (match, url, options) => {
        const optionsParsed: Record<string, string> = {};
        if (options) {
          options.split(',').forEach((opt: string) => {
            const [key, value] = opt.split('=').map((s: string) => s.trim());
            if (key && value) {
              optionsParsed[key] = value;
            }
          });
        }
        
        // Add physical=true to options
        optionsParsed.physical = 'true';
        
        // Reconstruct options string
        const optionsString = Object.entries(optionsParsed)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ');
        
        return `@import[${url}]{${optionsString}}`;
      }
    );
  }
}
