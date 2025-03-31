<script lang="ts">
  import { locale } from 'svelte-i18n';
  import { LANGUAGES, setLanguage } from '../i18n/index.js';

  type LanguageCode = keyof typeof LANGUAGES;

  // Aktuelle Sprache
  let currentLocale = $state<LanguageCode>('en');

  // Funktion zum Ändern der Sprache
  function changeLanguage(lang: LanguageCode) {
    setLanguage(lang);
    currentLocale = lang;
  }

  // Aktualisiere die aktuelle Sprache, wenn sich $locale ändert
  $effect(() => {
    if ($locale && Object.keys(LANGUAGES).includes($locale)) {
      currentLocale = $locale as LanguageCode;
    }
  });
</script>

<div class="language-selector">
  <div class="selected-language">
    <button class="language-button" aria-label="Select language">
      {LANGUAGES[currentLocale] || 'Language'}
      <svg class="dropdown-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
    <div class="language-dropdown">
      {#each Object.entries(LANGUAGES) as [code, name]}
        <button 
          class="language-option {code === currentLocale ? 'active' : ''}" 
          onclick={() => changeLanguage(code as LanguageCode)}
        >
          {name}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .language-selector {
    position: relative;
    display: inline-block;
  }

  .language-button {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    background-color: rgb(229 231 235 / var(--tw-bg-opacity, 1));
    border-radius: 0.5rem;
    transition-property: all;
    transition-duration: 300ms;
    color: rgb(55 65 81 / var(--tw-text-opacity, 1));
    border: none;
    cursor: pointer;
  }

  :global(.dark) .language-button {
    background-color: rgb(75 85 99 / var(--tw-bg-opacity, 1));
    color: rgb(229 231 235 / var(--tw-text-opacity, 1));
  }

  .language-button:hover {
    opacity: 0.9;
    transform: scale(1.05);
  }

  .dropdown-icon {
    width: 1rem;
    height: 1rem;
    margin-left: 0.25rem;
  }

  .language-dropdown {
    display: none;
    position: absolute;
    top: 100%;
    right: 0;
    z-index: 60;
    min-width: 10rem;
    padding: 0.5rem 0;
    margin-top: 0.25rem;
    background-color: white;
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  :global(.dark) .language-dropdown {
    background-color: rgb(75 85 99 / var(--tw-bg-opacity, 1));
    color: rgb(229 231 235 / var(--tw-text-opacity, 1));
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
  }

  .language-selector:hover .language-dropdown {
    display: block;
  }

  .language-option {
    display: block;
    width: 100%;
    padding: 0.5rem 1rem;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    color: rgb(55 65 81 / var(--tw-text-opacity, 1));
  }

  :global(.dark) .language-option {
    color: rgb(229 231 235 / var(--tw-text-opacity, 1));
  }

  .language-option:hover {
    background-color: rgb(243 244 246 / var(--tw-bg-opacity, 1));
  }

  :global(.dark) .language-option:hover {
    background-color: rgb(107 114 128 / var(--tw-bg-opacity, 1));
  }

  .language-option.active {
    font-weight: bold;
    background-color: rgb(243 244 246 / var(--tw-bg-opacity, 1));
  }

  :global(.dark) .language-option.active {
    background-color: rgb(107 114 128 / var(--tw-bg-opacity, 1));
  }

  @media (max-width: 768px) {
    .language-dropdown {
      right: 0;
    }
  }
</style>