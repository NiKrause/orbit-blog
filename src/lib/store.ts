import { writable, derived } from 'svelte/store';
import type { Post, Category, RemoteDB, Media, Comment, Helia, OrbitDB, Voyager } from './types.js';
import { localStorageStore } from './utils.js';
import { LANGUAGES } from './i18n/index.js';

// Create writable stores
export const identity = writable<{ id: string } | null>(null);
export const identities = writable<{ id: string }[] | null>(null);
export const settingsDB = writable<OrbitDB | null>(null);
export const postsDB = writable<OrbitDB | null>(null);
export const loadingState = writable({
  step: 'initializing',
  detail: '',
  progress: 0
});
export const initialAddress = writable<string | null>(null);
export const remoteDBs = writable<RemoteDB[]>([]);
export const selectedDBAddress = writable<string | null>(null);
export const remoteDBsDatabases = writable<OrbitDB | null>(null);
export const profilePictureCid = writable<string | null>(null);
export const profileImageUrl = writable<string | null>(null);
export const blogName = writable<string>('New Blog');
export const blogDescription = writable<string>('Change your blog description in the settings');
export const categories = writable<string[]>(['General', 'Technology', 'Science', 'Art', 'Music', 'Sports', 'Politics', 'Economy', 'Entertainment', 'Other']);
export const selectedPostId = writable<string | null>(null);
export const postsDBAddress = writable<string | null>(null);
export const seedPhrase = writable<string | null>(null);
export const helia = writable<Helia | null>(null);
export const libp2p = writable<Helia['libp2p'] | null>(null);
export const orbitdb = writable<OrbitDB | null>(null);

// Local storage-backed UI state stores
export const showDBManager = localStorageStore('showDBManager', false);
export const showPeers = localStorageStore('showPeers', false);
export const showSettings = localStorageStore('showSettings', false);

// Language settings
export const enabledLanguages = localStorageStore('enabledLanguages', Object.keys(LANGUAGES));

// AI Translation settings
export const aiApiKey = writable<string>(localStorage.getItem('aiApiKey') || '');
export const aiApiUrl = writable<string>(localStorage.getItem('aiApiUrl') || '');

// Subscribe to changes and save to localStorage
aiApiKey.subscribe(value => localStorage.setItem('aiApiKey', value));
aiApiUrl.subscribe(value => localStorage.setItem('aiApiUrl', value));

// Sample data
const samplePosts: Post[] = [];

export const posts = writable<Post[]>(samplePosts);
export const searchQuery = writable('');
export const selectedCategory = writable<Category | 'All'>('All');

// Add commentsDB to your store exports
export const commentsDB = writable<OrbitDB | null>(null);
export const commentsDBAddress = writable<string | null>(null);
export const allComments = writable<Comment[]>([]);

// Add a store for the media database
export const mediaDB = writable<OrbitDB | null>(null);
export const mediaDBAddress = writable<string | null>(null);
export const allMedia = writable<Media[]>([]);

// Store for tracking the current language direction
export const isRTL = writable(false);


