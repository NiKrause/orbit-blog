<script lang="ts">
  import { _ } from 'svelte-i18n';

  let showHelp = $state(false);

  function toggleHelp() {
    showHelp = !showHelp;
  }

  function closeHelp() {
    showHelp = false;
  }

  // Markdown features organized by category
  const markdownFeatures = {
    basic: [
      { name: 'Headers', syntax: '# H1 Header\n## H2 Header\n### H3 Header' },
      { name: 'Bold/Italic', syntax: '**Bold text**\n*Italic text*\n~~Strikethrough~~' },
      { name: 'Lists', syntax: '- Unordered item\n- Another item\n\n1. Ordered item\n2. Another item' },
      { name: 'Links', syntax: '[Link text](https://example.com)' },
      { name: 'Images', syntax: '![Alt text](https://example.com/image.jpg)' },
      { name: 'Code', syntax: '`inline code`\n\n```javascript\nfunction hello() {\n  console.log("Hello!");\n}\n```' },
      { name: 'Quotes', syntax: '> This is a blockquote\n> It can span multiple lines' },
      { name: 'Tables', syntax: '| Column 1 | Column 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |' }
    ],
    custom: [
      { 
        name: '📐 Responsive Images (NEW!)', 
        syntax: '![Small{size=small}](url)\n![Large centered{size=large,align=center}](url)\n![Custom{width=300,height=200}](url)\n![Rounded{size=medium,rounded=true}](url)',
        description: 'Control image size, alignment, and styling with custom syntax'
      },
      { 
        name: 'Accordions', 
        syntax: '----\n## Section Title\nCollapsible content here...\n- Lists work too\n- **Bold text**\n----',
        description: 'Create collapsible sections'
      },
      { 
        name: 'Remote Import (On-Demand)', 
        syntax: '@import[https://raw.githubusercontent.com/user/repo/main/README.md]',
        description: 'Dynamic import - content fetched when page loads'
      },
      { 
        name: 'Physical Import', 
        syntax: '@import[https://raw.githubusercontent.com/user/repo/main/API.md]{physical=true}',
        description: 'Permanent embed - use "Resolve Imports" button to fetch & save content'
      },
      { 
        name: 'Mermaid Diagrams', 
        syntax: '```mermaid\ngraph TD\n    A[Start] --> B{Decision?}\n    B -->|Yes| C[End]\n    B -->|No| A\n```',
        description: 'Create flowcharts, sequence diagrams, etc.'
      },
      { 
        name: 'IPFS Images', 
        syntax: '![My Image](ipfs://QmYourImageCIDHere)',
        description: 'Display images stored on IPFS'
      },
      { 
        name: 'Video Embeds', 
        syntax: '<iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" width="560" height="315" frameborder="0" allowfullscreen></iframe>\n\n<iframe src="https://youtu.be/VIDEO_ID" width="560" height="315" frameborder="0" allowfullscreen></iframe>\n\n<iframe src="https://www.youtube.com/watch?v=VIDEO_ID" width="560" height="315" frameborder="0" allowfullscreen></iframe>',
        description: 'Embed YouTube videos using the preferred nocookie/embed URL. Short and watch URLs are also normalized automatically by the renderer.'
      }
    ]
  };
</script>

<div class="markdown-help-container">
  <!-- Help Button -->
  <button
    type="button"
    onclick={toggleHelp}
    class="help-button"
    aria-label="Markdown help"
    title="Markdown syntax help"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
    </svg>
  </button>

  <!-- Help Panel -->
  {#if showHelp}
    <div 
      class="help-overlay" 
      onclick={closeHelp}
      onkeydown={(e) => {
        if (e.key === 'Escape') {
          closeHelp();
        }
      }}
      role="button"
      tabindex="0"
      aria-label="Close help panel"
    >
      <div 
        class="help-panel" 
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        tabindex="-1"
      >
        <div class="help-header">
          <h3>📝 Markdown Syntax Help</h3>
          <button onclick={closeHelp} class="close-button" aria-label="Close help">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <div class="help-content">
          <!-- Basic Markdown Section -->
          <div class="help-section">
            <h4>📄 Basic Markdown</h4>
            {#each markdownFeatures.basic as feature}
              <div class="feature-item">
                <div class="feature-name">{feature.name}</div>
                <pre class="feature-syntax"><code>{feature.syntax}</code></pre>
              </div>
            {/each}
          </div>

          <!-- Custom Extensions Section -->
          <div class="help-section">
            <h4>🚀 Le Space Blog Extensions</h4>
            {#each markdownFeatures.custom as feature}
              <div class="feature-item">
                <div class="feature-name">
                  {feature.name}
                  {#if feature.description}
                    <span class="feature-description">{feature.description}</span>
                  {/if}
                </div>
                <pre class="feature-syntax"><code>{feature.syntax}</code></pre>
              </div>
            {/each}
          </div>

          <div class="embed-warning">
            ⚠️ Use YouTube embed iframe URLs whenever possible. The renderer also normalizes `youtu.be/VIDEO_ID` and `youtube.com/watch?v=VIDEO_ID` sources, but the `youtube-nocookie.com/embed/VIDEO_ID` form is the most reliable.
          </div>

          <div class="help-footer">
            <p>💡 <strong>Pro Tip:</strong> Use the Preview toggle to see your formatted content before publishing!</p>
            <p>📚 For detailed documentation, check the <code>docs/MARKDOWN_GUIDE.md</code> file.</p>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .markdown-help-container {
    position: relative;
    display: inline-block;
  }

  .help-button {
    padding: 0.5rem;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    line-height: 1.25rem;
    min-width: 2rem;
    min-height: 2rem;
  }

  .help-button:hover {
    color: var(--text);
    background-color: var(--bg-hover);
  }

  .help-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .help-panel {
    background: var(--bg);
    color: var(--text);
    border-radius: 0.75rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    max-width: 800px;
    max-height: 80vh;
    width: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .help-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .help-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text);
  }

  .close-button {
    padding: 0.25rem;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    color: var(--text);
    background-color: var(--bg-hover);
  }

  .help-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .help-section {
    margin-bottom: 2rem;
  }

  .help-section h4 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text);
    border-bottom: 2px solid var(--border);
    padding-bottom: 0.5rem;
  }

  .feature-item {
    margin-bottom: 1.5rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--bg-secondary);
  }

  .feature-name {
    font-weight: 600;
    color: var(--text);
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
  }

  .feature-description {
    font-weight: 400;
    color: var(--text-secondary);
    font-size: 0.75rem;
    display: block;
    margin-top: 0.25rem;
  }

  .feature-syntax {
    margin: 0;
    padding: 0.75rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--text);
    overflow-x: auto;
  }

  .feature-syntax code {
    background: none;
    padding: 0;
    font-family: 'SFMono-Regular', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
    white-space: pre;
  }

  .help-footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .help-footer p {
    margin: 0.5rem 0;
  }

  .help-footer code {
    background: var(--bg-tertiary);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
  }

  .embed-warning {
    margin-top: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    background: var(--bg-hover);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 0.8125rem;
  }

  @media (max-width: 640px) {
    .help-overlay {
      padding: 0.5rem;
    }

    .help-panel {
      max-height: 90vh;
    }

    .help-header,
    .help-content {
      padding: 1rem;
    }

    .feature-syntax {
      font-size: 0.6875rem;
    }
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .help-overlay {
      padding: 0.5rem;
    }

    .help-panel {
      max-height: 90vh;
    }

    .help-header,
    .help-content {
      padding: 1rem;
    }

    .feature-syntax {
      font-size: 0.6875rem;
    }
  }
</style>
