import { init, register, locale } from 'svelte-i18n';
import { isRTL } from '../store.js';

// Definiere die verfügbaren Sprachen
export const LANGUAGES = {
  ar: 'العربية',
  de: 'Deutsch',
  el: 'Ελληνικά',
  en: 'English',
  es: 'Español',
  fa: 'فارسی',
  fr: 'Français',
  he: 'עברית',
  hi: 'हिन्दी',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  ka: 'ქართული',
  nl: 'Nederlands',
  pt: 'Português',
  ru: 'Русский',
  th: 'ไทย',
  tr: 'Türkçe',
  zh: '中文',
};

// Define RTL languages
const RTL_LANGUAGES = ['ar', 'fa', 'he'];

// Registriere die Übersetzungsdateien
const registerTranslations = () => {
  // Mit expliziten Dateierweiterungen
  register('en', () => import('./en.js'));
  register('de', () => import('./de.js'));
  register('el', () => import('./el.js'));
  register('fa', () => import('./fa.js'));
  register('he', () => import('./he.js'));
  register('hi', () => import('./hi.js'));
  register('id', () => import('./id.js'));
  register('ka', () => import('./ka.js'));
  register('nl', () => import('./nl.js'));
  register('fr', () => import('./fr.js'));
  register('es', () => import('./es.js'));
  register('it', () => import('./it.js'));
  register('pt', () => import('./pt.js'));
  register('ru', () => import('./ru.js'));
  register('zh', () => import('./zh.js'));
  register('ar', () => import('./ar.js'));
  register('th', () => import('./th.js'));
  register('tr', () => import('./tr.js'));
};

// Initialisiere die i18n-Bibliothek
export const setupI18n = () => {
  registerTranslations();

  init({
    fallbackLocale: 'en',
    initialLocale: getInitialLocale(),
  });
};

/**
 * Gets the browser's preferred languages in order of preference
 */
function getBrowserLanguagePreferences(): string[] {
  if (typeof window === 'undefined') return ['en'];
  
  const languages: string[] = [];
  
  // Get all browser languages from navigator.languages
  if (navigator.languages) {
    navigator.languages.forEach(lang => {
      // Extract main language code (e.g., 'en-US' -> 'en')
      const mainLang = lang.split('-')[0];
      if (!languages.includes(mainLang) && Object.keys(LANGUAGES).includes(mainLang)) {
        languages.push(mainLang);
      }
    });
  }
  
  // Fallback to navigator.language
  if (languages.length === 0 && navigator.language) {
    const mainLang = navigator.language.split('-')[0];
    if (Object.keys(LANGUAGES).includes(mainLang)) {
      languages.push(mainLang);
    }
  }
  
  // Ensure we have at least English as fallback
  if (!languages.includes('en')) {
    languages.push('en');
  }
  
  return languages;
}

// Funktion zum Ermitteln der Anfangssprache mit intelligenter Fallback-Logik
function getInitialLocale(): string {
  // Prüfe, ob wir im Browser sind
  if (typeof window !== 'undefined') {
    // Versuche, die gespeicherte Sprache zu laden (höchste Priorität)
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && Object.keys(LANGUAGES).includes(savedLanguage)) {
      console.info(`Using saved language preference: ${savedLanguage}`);
      return savedLanguage;
    }
    
    // Verwende Browser-Sprachpräferenzen in Reihenfolge
    const browserLanguages = getBrowserLanguagePreferences();
    if (browserLanguages.length > 0) {
      const selectedLang = browserLanguages[0];
      console.info(`Using browser language preference: ${selectedLang} (from ${browserLanguages.join(', ')})`);
      return selectedLang;
    }
  }
  
  // Standardsprache als letzte Option
  console.info('Using default language: en');
  return 'en';
}

/**
 * Export browser language preferences for use by language fallback service
 */
export { getBrowserLanguagePreferences };

// Funktion zum Ändern der Sprache
export const setLanguage = (newLocale: string) => {
  locale.set(newLocale);
  
  // Update RTL direction based on language
  isRTL.set(RTL_LANGUAGES.includes(newLocale));
  
  // Update document direction
  if (typeof document !== 'undefined') {
    document.documentElement.dir = RTL_LANGUAGES.includes(newLocale) ? 'rtl' : 'ltr';
    document.documentElement.lang = newLocale;
  }
  
  // Save the selected language in localStorage if in browser
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', newLocale);
  }
};

// Funktion zum Laden der gespeicherten Sprache
export const loadSavedLanguage = () => {
  if (typeof window !== 'undefined') {
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && Object.keys(LANGUAGES).includes(savedLanguage)) {
      locale.set(savedLanguage);
      isRTL.set(RTL_LANGUAGES.includes(savedLanguage));
      
      // Update document direction
      if (typeof document !== 'undefined') {
        document.documentElement.dir = RTL_LANGUAGES.includes(savedLanguage) ? 'rtl' : 'ltr';
        document.documentElement.lang = savedLanguage;
      }
    }
  }
};