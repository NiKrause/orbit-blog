import { DateTime } from 'luxon';
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

export const formatDate = (dateString: string, format = DateTime.DATETIME_MED, localeOverride?: string): string => {
  if (!dateString) return '';
  const targetLocale = localeOverride || getCurrentLocale();
  return DateTime.fromISO(dateString).setLocale(targetLocale).toLocaleString(format);
};

export const formatTimestamp = (timestamp: number | string, format = DateTime.DATETIME_MED, localeOverride?: string): string => {
  if (!timestamp) return 'Date not available';
  const targetLocale = localeOverride || getCurrentLocale();
  
  if (typeof timestamp === 'string') {
    try {
      return DateTime.fromISO(timestamp).setLocale(targetLocale).toLocaleString(format);
    } catch (e) {
      // If ISO parsing fails, just return the string as-is
      return timestamp;
    }
  }
  
  try {
    return DateTime.fromMillis(timestamp).setLocale(targetLocale).toLocaleString(format);
  } catch (e) {
    return 'Date not available';
  }
};

/**
 * Format timestamp with full month name (e.g., "August 15, 2024" instead of "Aug 15, 2024")
 */
export const formatTimestampLong = (timestamp: number | string, localeOverride?: string): string => {
  if (!timestamp) return 'Date not available';
  const targetLocale = localeOverride || getCurrentLocale();
  
  if (typeof timestamp === 'string') {
    try {
      return DateTime.fromISO(timestamp).setLocale(targetLocale).toLocaleString(DateTime.DATETIME_FULL);
    } catch (e) {
      // If ISO parsing fails, just return the string as-is
      return timestamp;
    }
  }
  
  try {
    return DateTime.fromMillis(timestamp).setLocale(targetLocale).toLocaleString(DateTime.DATETIME_FULL);
  } catch (e) {
    return 'Date not available';
  }
};

// Reactive version that can be used in Svelte derived stores
export const createReactiveFormatTimestamp = () => {
  return (timestamp: number | string, format = DateTime.DATETIME_MED) => {
    return formatTimestamp(timestamp, format, getCurrentLocale());
  };
};

// Add more date utility functions as needed
