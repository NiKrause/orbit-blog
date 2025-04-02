<script lang="ts">
  export let status: 'default' | 'success' | 'error' = 'default';
  export let language: string;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  const getLanguageLabel = (lang: string) => {
    const labels = {
      en: 'EN',
      de: 'DE',
      fr: 'FR',
      it: 'IT',
      // Add more languages as needed
    };
    return labels[lang] || lang.toUpperCase();
  };
</script>

<div class="inline-flex items-center gap-1 mr-2" title={`Translation status for ${language}: ${status}`}>
  <span class="text-xs font-medium">{getLanguageLabel(language)}</span>
  <div class="w-2 h-2 rounded-full {getStatusColor(status)} shadow-sm"></div>
</div>

<style>
  /* Add a subtle glow effect for the LEDs */
  .rounded-full {
    box-shadow: 0 0 4px currentColor;
  }
</style> 