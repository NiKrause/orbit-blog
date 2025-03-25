import { writable, derived } from 'svelte/store';
import { localStorageStore } from './utils';
// Create writable stores
export const identity = writable(null);
export const identities = writable(null);
export const settingsDB = writable(null);
export const postsDB = writable(null);
export const initialAddress = writable(null);
export const remoteDBs = writable([]);
export const selectedDBAddress = writable(null);
export const remoteDBsDatabases = writable(null);
export const blogName = writable('New Blog');
export const blogDescription = writable('Change your blog description in the settings');
export const categories = writable(['Bitcoin', 'Ethereum', 'DeFi', 'NFTs', 'Trading']);
export const selectedPostId = writable(null);
export const postsDBAddress = writable(null);
export const seedPhrase = writable(null);
export const helia = writable();
export const libp2p = writable();
export const orbitdb = writable();
export const voyager = writable();
// Local storage-backed UI state stores
export const showDBManager = localStorageStore('showDBManager', false);
export const showPeers = localStorageStore('showPeers', false);
export const showSettings = localStorageStore('showSettings', false);
// Sample data
const samplePosts = [];
export const posts = writable(samplePosts);
export const searchQuery = writable('');
export const selectedCategory = writable('All');
// Add commentsDB to your store exports
export const commentsDB = writable(null);
export const commentsDBAddress = writable(null);
export const allComments = writable([]);
// Add a store for the media database
export const mediaDB = writable(null);
export const mediaDBAddress = writable(null);
export const allMedia = writable([]);
