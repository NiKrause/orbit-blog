import { init, register, locale } from 'svelte-i18n';
import { isRTL } from '../store.js';

// Definiere die verfügbaren Sprachen
export const LANGUAGES = {
  ar: 'العربية',
  de: 'Deutsch',
  el: 'Ελληνικά',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  hi: 'हिन्दी',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  nl: 'Nederlands',
  pt: 'Português',
  ru: 'Русский',
  th: 'ไทย',
  tr: 'Türkçe',
  zh: '中文',
};

// Define RTL languages
const RTL_LANGUAGES = ['ar'];

// Registriere die Übersetzungsdateien
const registerTranslations = () => {
  // Mit expliziten Dateierweiterungen
  register('en', () => import('./en.js'));
  register('de', () => import('./de.js'));
  register('el', () => import('./el.js'));
  register('hi', () => import('./hi.js'));
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

// Funktion zum Ermitteln der Anfangssprache
function getInitialLocale(): string {
  // Prüfe, ob wir im Browser sind
  if (typeof window !== 'undefined') {
    // Versuche, die gespeicherte Sprache zu laden
    const savedLanguage = localStorage.getItem('language');
    if (savedLanguage && Object.keys(LANGUAGES).includes(savedLanguage)) {
      return savedLanguage;
    }
    
    // Versuche, die Browsersprache zu verwenden
    const browserLang = navigator.language.split('-')[0];
    if (Object.keys(LANGUAGES).includes(browserLang)) {
      return browserLang;
    }
  }
  
  // Standardsprache
  return 'en';
}

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