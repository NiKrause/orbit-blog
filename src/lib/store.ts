import { writable, derived } from 'svelte/store';
import type { Post, Category, RemoteDB } from './types.js';
import { localStorageStore } from './utils.js';
import { LANGUAGES } from './i18n/index.js';

// Create writable stores
export const identity = writable(null)
export const identities = writable(null)
export const settingsDB = writable(null)
export const postsDB = writable(null)

export const initialAddress = writable<string | null>(null)
export const remoteDBs = writable<RemoteDB[]>([])
export const selectedDBAddress = writable<string | null>(null)
export const remoteDBsDatabases = writable(null)
export const blogName = writable<string>('New Blog')
export const blogDescription = writable<string>('Change your blog description in the settings')
export const categories = writable<string[]>(['Bitcoin', 'Ethereum', 'DeFi', 'NFTs', 'Trading'])
export const selectedPostId = writable<string | null>(null)
export const postsDBAddress = writable<string | null>(null)
export const seedPhrase = writable<string | null>(null)
export const helia = writable()
export const libp2p = writable()
export const orbitdb = writable()
export const voyager = writable()
// Local storage-backed UI state stores
export const showDBManager = localStorageStore('showDBManager', false);
export const showPeers = localStorageStore('showPeers', false);
export const showSettings = localStorageStore('showSettings', false);

// Language settings
export const enabledLanguages = localStorageStore('enabledLanguages', Object.keys(LANGUAGES));

// Sample data
const samplePosts: Post[] = [ ];

export const posts = writable<Post[]>(samplePosts);
export const searchQuery = writable('');
export const selectedCategory = writable<Category | 'All'>('All');

// Add commentsDB to your store exports
export const commentsDB = writable(null);
export const commentsDBAddress = writable(null);
export const allComments = writable([]);

// Add a store for the media database
export const mediaDB = writable(null);
export const mediaDBAddress = writable(null);
export const allMedia = writable([]);


