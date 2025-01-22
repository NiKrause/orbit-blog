import { writable, derived } from 'svelte/store';
import type { BlogPost, Category } from './types';
import { createLibp2p } from 'libp2p'
import { createHelia } from 'helia'
import { createOrbitDB } from '@orbitdb/core'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'
import { Libp2pOptions } from './config'
// Initialize storage
let blockstore = new LevelBlockstore('./helia-blocks');
let datastore = new LevelDatastore('./helia-data');
// Initialize Helia and OrbitDB
const libp2p = await createLibp2p(Libp2pOptions)
const helia = await createHelia({libp2p, datastore, blockstore})

const orbitdb = await createOrbitDB({ 
  ipfs: helia,
  storage: blockstore,
  directory: './orbitdb',
});

// Load initial data from localStorage or use sample data
const getSamplePosts = (): BlogPost[] => [
  {
    _id: '1',
    title: 'Getting Started with Svelte',
    content: '# Getting Started with Svelte\n\nSvelte is a radical new approach to building user interfaces...\n\n## Key Features\n- No Virtual DOM\n- True reactivity\n- Less code',
    author: 'John Doe',
    createdAt: '2024-03-20',
    category: 'Programming',
    comments: [
      { id: '1', content: 'Great introduction!', author: 'Alice', createdAt: '2024-03-20' },
      { id: '2', content: 'Very helpful tutorial', author: 'Bob', createdAt: '2024-03-20' }
    ]
  },
  {
    _id: '2',
    title: 'Why I Love TypeScript',
    content: '# TypeScript Benefits\n\nTypeScript adds optional static types to JavaScript...\n\n## Advantages\n- Type safety\n- Better tooling\n- Enhanced productivity',
    author: 'Jane Smith',
    createdAt: '2024-03-19',
    category: 'Technology',
    comments: [
      { id: '3', content: 'TypeScript is amazing!', author: 'Charlie', createdAt: '2024-03-19' }
    ]
  },
  {
    _id: '3',
    title: 'Web Development Best Practices',
    content: '# Web Development Best Practices\n\nHere are some essential best practices for modern web development...\n\n## Best Practices\n1. Write semantic HTML\n2. Optimize performance\n3. Follow accessibility guidelines',
    author: 'Mike Johnson',
    createdAt: '2024-03-18',
    category: 'Design',
    comments: [
      { id: '4', content: 'These tips are gold!', author: 'David', createdAt: '2024-03-18' },
      { id: '5', content: 'Thanks for sharing!', author: 'Eva', createdAt: '2024-03-18' }
    ]
  }
];

// Create stores
export const heliaStore = writable(helia)
export const orbitStore = writable(orbitdb)
export const postsDB = writable(null)
export const posts = writable<BlogPost[]>(getSamplePosts());

export const searchQuery = writable('');
export const selectedCategory = writable<Category | 'All'>('All');

// Filtered posts based on search query and category
export const filteredPosts = derived(
  [posts, searchQuery, selectedCategory],
  ([$posts, $searchQuery, $selectedCategory]) => {
    return $posts
      .filter(post => {
        const matchesSearch = 
          post.title.toLowerCase().includes($searchQuery.toLowerCase()) ||
          post.content.toLowerCase().includes($searchQuery.toLowerCase()) ||
          post.author.toLowerCase().includes($searchQuery.toLowerCase());
        
        const matchesCategory = $selectedCategory === 'All' || post.category === $selectedCategory;
        
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
);