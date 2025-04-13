<script lang="ts">
  import { onMount } from 'svelte';
  import confetti from 'canvas-confetti';

  export let show = false;

  let audio: HTMLAudioElement;

  onMount(() => {
    // Create audio element for the jingle
    audio = new Audio('/echopop.mp3');
    audio.volume = 0.5; // Set to 50% volume
  });

  $: if (show) {
    // Play celebration sound
    audio?.play().catch(err => console.warn('Could not play audio:', err));
    
    // Launch fireworks
    const end = Date.now() + 1000; // Animation duration: 1 second

    const colors = ['#00ff00', '#0099ff', '#ff0099'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: colors
      });
      
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }
</script> 