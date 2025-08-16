# Remote Markdown Import Feature

The Le Space Blog now supports importing remote Markdown files directly into your blog posts using a custom `@import` syntax.

## Syntax

### On-Demand Import (Default)
```markdown
@import[URL]
```

### Physical Import
```markdown
@import[URL]{physical=true}
```

### With Additional Options
```markdown
@import[URL]{physical=true, attribution=false, section=API}
```

## Import Types

### On-Demand Import (Default)
Content is fetched and rendered dynamically when the page loads. This is the default behavior.

```markdown
@import[https://raw.githubusercontent.com/user/repo/main/README.md]
```

### Physical Import
Content is fetched once and permanently embedded in the markdown before saving. This is ideal for:
- **Translation workflows**: Import content physically, then translate the entire post
- **Permanent archiving**: Content becomes part of your post permanently
- **Offline functionality**: No need to fetch remote content when viewing

```markdown
@import[https://raw.githubusercontent.com/user/repo/main/README.md]{physical=true}
```

## Examples

### Basic On-Demand Import
```markdown
# My Blog Post

Here's some content from a remote GitHub repository:

@import[https://raw.githubusercontent.com/user/repo/main/README.md]

And here's more of my content.
```

### Physical Import for Translation
```markdown
# My Multilingual Blog Post

Importing content that I want to translate:

@import[https://raw.githubusercontent.com/user/repo/main/API.md]{physical=true}

<!-- After clicking "Resolve Imports", the content will be embedded here -->
<!-- Then you can use the translation feature to translate the entire post -->
```

### Import from Different Sources
```markdown
# API Documentation

Let me include the latest API docs:

@import[https://raw.githubusercontent.com/mycompany/api/main/docs/api.md]

## Installation Guide

@import[https://gist.githubusercontent.com/username/gistid/raw/installation.md]
```

## Supported Domains

For security reasons, only certain trusted domains are allowed:

- `raw.githubusercontent.com` - GitHub raw file URLs
- `gist.githubusercontent.com` - GitHub Gist raw URLs
- `gitlab.com` - GitLab raw file URLs  
- `bitbucket.org` - Bitbucket raw file URLs

## Features

### 🔄 Automatic Caching (On-Demand Imports)
- Remote content is cached for 5 minutes
- If a remote fetch fails, stale cached content is used as fallback
- Cache improves loading performance for frequently accessed content

### 🏗️ Physical Import Resolution
- **"Resolve Imports" button**: Appears when physical imports are detected
- **One-click resolution**: Fetches all physical imports and embeds them permanently
- **Translation-ready**: Perfect for translating imported content
- **Source attribution**: Automatically adds import source comments
- **Error handling**: Clear feedback for failed imports

### 🔐 Security
- Only whitelisted domains are allowed
- All remote content is sanitized through DOMPurify
- Content is processed through the same markdown renderer as local content
- 10-second timeout prevents hanging requests

### 🎨 Visual Indicators
- **On-demand**: Loading spinner while fetching content, green border for imported content
- **Physical**: Yellow warning for unresolved imports, green success for resolved imports
- Success indicator showing the source URL
- Error messages with detailed failure information

### 🌐 Translation Integration
- Physical imports can be resolved before translation
- Imported content becomes part of the translatable text
- Supports the full translation workflow

### 📱 Responsive Design
- Works seamlessly with the existing dark/light theme
- Mobile-friendly loading and error states
- Styled using existing TailwindCSS classes

## Advanced Usage

### Physical Import Options

#### Basic Physical Import
```markdown
@import[https://raw.githubusercontent.com/user/repo/main/docs.md]{physical=true}
```

#### Physical Import without Attribution
```markdown
@import[https://raw.githubusercontent.com/user/repo/main/docs.md]{physical=true, attribution=false}
```

#### Import Specific Section Physically
```markdown
@import[https://raw.githubusercontent.com/user/repo/main/docs.md]{physical=true, section=Installation}
```

### Translation Workflow
1. **Write your post** with physical import statements
2. **Click "Resolve Imports"** to fetch and embed the remote content
3. **Verify the imported content** looks correct
4. **Use the translation feature** to translate the entire post (including imported content)
5. **Save and publish** your multilingual post

### URL Examples

#### GitHub Repository Files
```markdown
@import[https://raw.githubusercontent.com/username/repo/main/docs/getting-started.md]
```

#### GitHub Gist
```markdown
@import[https://gist.githubusercontent.com/username/abc123/raw/example.md]
```

#### GitLab Files
```markdown
@import[https://gitlab.com/username/project/-/raw/main/documentation.md]
```

## Error Handling

If a remote import fails, you'll see a user-friendly error message showing:
- The URL that failed to load
- The specific error message
- The content remains in an error state with clear visual feedback

Common failure reasons:
- Network connectivity issues
- File not found (404)
- Domain not whitelisted
- Request timeout (10 seconds)
- CORS restrictions

## Implementation Details

### Browser Compatibility
- Uses modern `fetch` API with AbortSignal timeout
- Requires JavaScript enabled
- Works in all modern browsers

### Performance
- Asynchronous loading doesn't block page rendering
- Content appears as soon as it's fetched
- Cached content loads immediately

### Markdown Processing
- Remote content supports all markdown features (headers, lists, code, etc.)
- Nested imports are supported (but be careful of infinite loops!)
- Mermaid diagrams work in imported content
- IPFS images work in imported content

## Best Practices

1. **Use Stable URLs**: Use URLs that won't change, like tagged releases or specific commits
2. **Keep Imports Short**: Large imported files may affect loading performance  
3. **Test Your Imports**: Always test remote imports before publishing
4. **Have Fallbacks**: Consider what happens if the remote content becomes unavailable
5. **Cache Considerations**: Remember that content is cached for 5 minutes

## Troubleshooting

### Import Not Loading
- Check that the URL is accessible in your browser
- Verify the domain is in the whitelist
- Check browser developer console for error messages

### Content Not Appearing
- Wait for the loading indicator to complete
- Refresh the page to clear any cached errors
- Verify the remote file contains valid markdown

### CORS Errors
- This typically happens with non-whitelisted domains
- Use raw file URLs from supported platforms
- Consider copying content locally if remote access isn't working

## Future Enhancements

Potential future features could include:
- Custom cache expiration times
- Section-specific imports (e.g., import only headers)
- Import validation and preview
- Batch import operations
- Import from more platforms

## Security Notice

This feature makes HTTP requests to external servers. Only trusted domains are whitelisted, and all content is sanitized, but be aware that:
- Remote servers can see your IP address when fetching content
- Imported content could change without your knowledge
- Always review imported content for appropriateness

---

*This feature was added to enhance the local-first philosophy of Le Space Blog while enabling dynamic content inclusion from trusted sources.*
