<script lang="ts">
  /**
   * Non-text status indicator for relay pin / gateway readiness (FR-7c).
   * Pairs color with `aria-label` (UX §7.5). Wrapper `title` gives a native hover tooltip.
   */
  import { _ } from 'svelte-i18n';
  import type { RelayLedState } from '$lib/services/relayPinStatus.js';

  interface Props {
    state: RelayLedState;
    /** When true, skip blink (in addition to CSS `prefers-reduced-motion`). */
    reducedMotion?: boolean;
    /** When true, render inside normal document flow instead of absolute top-right overlay. */
    inline?: boolean;
    /** Custom native tooltip text. Defaults to the translated state label. */
    titleOverride?: string;
    /** Custom aria label. Defaults to the translated state label. */
    ariaLabelOverride?: string;
    /** When false, still render an idle dot instead of hiding it. */
    hideWhenIdle?: boolean;
  }

  let {
    state,
    reducedMotion = false,
    inline = false,
    titleOverride,
    ariaLabelOverride,
    hideWhenIdle = true,
  }: Props = $props();

  const ariaKey = $derived(
    state === 'green'
      ? 'ai_relay_led_aria_ready'
      : state === 'orange'
        ? 'ai_relay_led_aria_pinning'
        : state === 'error'
          ? 'ai_relay_led_aria_stalled'
          : 'ai_relay_led_aria_syncing',
  );
  const resolvedLabel = $derived(titleOverride ?? $_(ariaKey));
  const resolvedAriaLabel = $derived(ariaLabelOverride ?? resolvedLabel);
</script>

{#if !hideWhenIdle || state !== 'idle'}
  <span class="relay-led-wrap" class:relay-led-wrap--inline={inline} title={resolvedLabel}>
    <span
      class="relay-led"
      class:relay-led--idle={state === 'idle'}
      class:relay-led--yellow={state === 'yellow'}
      class:relay-led--orange={state === 'orange'}
      class:relay-led--green={state === 'green'}
      class:relay-led--error={state === 'error'}
      class:relay-led--blink={state === 'yellow' && !reducedMotion}
      role="status"
      aria-label={resolvedAriaLabel}
    ></span>
  </span>
{/if}

<style>
  .relay-led-wrap {
    position: absolute;
    top: 0.25rem;
    inset-inline-end: 0.25rem;
    z-index: 2;
    padding: 0.35rem;
    margin: -0.35rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    cursor: help;
    box-sizing: content-box;
  }

  .relay-led {
    flex-shrink: 0;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 9999px;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--text, #111) 25%, transparent);
    pointer-events: none;
  }

  .relay-led-wrap--inline {
    position: static;
    top: auto;
    inset-inline-end: auto;
    z-index: auto;
    padding: 0;
    margin: 0;
  }

  .relay-led--idle {
    background: color-mix(in srgb, var(--text-secondary, #6b7280) 70%, transparent);
  }
  .relay-led--yellow {
    background: #eab308;
  }
  .relay-led--orange {
    background: #ea580c;
  }
  .relay-led--green {
    background: #16a34a;
  }
  .relay-led--error {
    background: #dc2626;
  }

  @keyframes relay-led-blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }

  .relay-led--blink {
    animation: relay-led-blink 1.1s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .relay-led--blink {
      animation: none;
      opacity: 0.9;
    }
  }
</style>
