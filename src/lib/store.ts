import { writable, derived } from 'svelte/store';
import type { Post, Category, RemoteDB } from './types';
import { localStorageStore } from './utils';

// Create writable stores
export const identity = writable(null)
export const identities = writable(null)
export const settingsDB = writable(null)
export const postsDB = writable(null)

export const remoteDBs = writable<RemoteDB[]>([])
export const selectedDBAddress = writable<string | null>(null)
export const remoteDBsDatabases = writable(null)
export const blogName = writable<string>('New Blog')
export const blogDescription = writable<string>('Change your blog description in the settings')
export const categories = writable<string[]>(['Bitcoin', 'Ethereum', 'DeFi', 'NFTs', 'Trading'])
export const postsDBAddress = writable<string | null>(null)
export const helia = writable()
export const libp2p = writable()
export const orbitdb = writable()
// Local storage-backed UI state stores
export const showDBManager = localStorageStore('showDBManager', false);
export const showPeers = localStorageStore('showPeers', false);
export const showSettings = localStorageStore('showSettings', false);

// Sample data
const samplePosts: Post[] = [ ];

export const posts = writable<Post[]>(samplePosts);
export const searchQuery = writable('');
export const selectedCategory = writable<Category | 'All'>('All');



