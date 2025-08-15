/**
 * Build information utilities
 */

import { get } from 'svelte/store';
import { locale } from 'svelte-i18n';

// Language code to locale mapping for proper date formatting
const LOCALE_MAP: Record<string, string> = {
  'ar': 'ar-SA',
  'de': 'de-DE',
  'el': 'el-GR', 
  'en': 'en-US',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'hi': 'hi-IN',
  'id': 'id-ID',
  'it': 'it-IT',
  'nl': 'nl-NL',
  'pt': 'pt-PT',
  'ru': 'ru-RU',
  'th': 'th-TH',
  'tr': 'tr-TR',
  'zh': 'zh-CN'
};

/**
 * Gets the current locale from the i18n store
 * @returns Locale string for date formatting (e.g., 'en-US', 'de-DE')
 */
function getCurrentLocale(): string {
  const currentLocale = get(locale);
  return LOCALE_MAP[currentLocale] || 'en-US';
}

/**
 * Gets the current locale from the i18n store with a specific language override
 * @param langCode - Optional language code to use instead of current locale
 * @returns Locale string for date formatting
 */
function getLocaleForLanguage(langCode?: string): string {
  const targetLang = langCode || get(locale);
  return LOCALE_MAP[targetLang] || 'en-US';
}

/**
 * Formats the build date in a human-readable format
 * @param isoDate - ISO date string from build time
 * @returns Formatted date and time string
 */
export function formatBuildDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const currentLocale = getCurrentLocale();
    
    // Format as: "Dec 15, 2024 at 14:44 UTC" (localized)
    const dateOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    };
    
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      hour12: false
    };
    
    const formattedDate = date.toLocaleDateString(currentLocale, dateOptions);
    const formattedTime = date.toLocaleTimeString(currentLocale, timeOptions);
    
    return `${formattedDate} at ${formattedTime} UTC`;
  } catch (error) {
    console.warn('Failed to format build date:', error);
    return isoDate; // Fallback to raw ISO string
  }
}

/**
 * Gets version and build information
 * @returns Object with version and formatted build date
 */
export function getBuildInfo() {
  return {
    version: __APP_VERSION__,
    buildDate: __BUILD_DATE__,
    formattedBuildDate: formatBuildDate(__BUILD_DATE__)
  };
}

/**
 * Creates a complete version string with build date
 * @returns Formatted version string like "v0.2.98 (Dec 15, 2024 at 14:44 UTC)"
 */
export function getVersionString(): string {
  const buildInfo = getBuildInfo();
  return `v${buildInfo.version} (${buildInfo.formattedBuildDate})`;
}

/**
 * Creates a compact version string for small displays
 * @returns Compact version string like "v0.2.98 - Dec 15"
 */
export function getCompactVersionString(): string {
  const buildInfo = getBuildInfo();
  try {
    const date = new Date(buildInfo.buildDate);
    const currentLocale = getCurrentLocale();
    const compactDate = date.toLocaleDateString(currentLocale, { 
      month: 'short', 
      day: 'numeric',
      timeZone: 'UTC'
    });
    return `v${buildInfo.version} - ${compactDate}`;
  } catch (error) {
    return `v${buildInfo.version}`;
  }
}

/**
 * Creates a locale-aware full version string with user's local date/time
 * @returns Full version string like "v0.2.98 (15. Dezember 2024, 15:44)" in German locale
 */
export function getLocaleVersionString(): string {
  const buildInfo = getBuildInfo();
  try {
    const date = new Date(buildInfo.buildDate);
    const currentLocale = getCurrentLocale();
    
    // Use the current i18n locale for date/time formatting
    const formattedDate = date.toLocaleString(currentLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      // Don't specify timeZone to use user's local timezone
    });
    
    return `v${buildInfo.version} (${formattedDate})`;
  } catch (error) {
    console.warn('Failed to format locale version string:', error);
    return `v${buildInfo.version}`;
  }
}
