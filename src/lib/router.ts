import { readable, derived, writable, get} from 'svelte/store';
import { switchToRemoteDB } from './dbUtils';
import { initialAddress, postsDBAddress, postsDB } from './store';
const isBrowser = typeof window !== 'undefined';

// Add a loading state store
export const isLoadingRemoteBlog = writable(true);

// A helper to read the current hash minus the leading '#'
function getHash() {
  if (!isBrowser) return '';
  return window.location.hash ? window.location.hash.slice(1) : '';
}

// Extract OrbitDB address from hash path (e.g., "#/orbitdb/abcd..." -> "/orbitdb/abcd...")
function extractOrbitDBAddress(hash) {
  if (!hash) return '';
  
  // Remove leading slash if present to normalize
  const normalizedHash = hash.startsWith('/') ? hash : '/' + hash;
  
  // Check if this is an OrbitDB address
  if (normalizedHash.includes('/orbitdb/')) {
    return normalizedHash;
  }
  
  return '';
}

// Create a readable store that updates when the hash changes
export const hashRoute = readable(getHash(), (set) => {
  if (!isBrowser) return;

  function onHashChange() {
    set(getHash());
  }

  window.addEventListener('hashchange', onHashChange);
  return () => window.removeEventListener('hashchange', onHashChange);
});

// Create a derived store specifically for OrbitDB addresses
export const orbitDBAddress = derived(hashRoute, ($hashRoute) => {
  return extractOrbitDBAddress($hashRoute);
});

// Function to handle database switching based on hash
export function initHashRouter() {
  if (!isBrowser) return;
  
  let previousAddress = '';
  
  // Initial check for URL hash on page load
  const _initialAddress = extractOrbitDBAddress(getHash())

  if (_initialAddress) {
    // Keep isLoadingRemoteBlog as true since we found an address
    switchToRemoteDB(_initialAddress, true)
      .then(success => {
        initialAddress.set(_initialAddress);
        console.log('Initial remote blog load:', success ? 'success' : 'failed');
      })
      .catch(error => console.error('Error loading initial remote blog:', error))
      .finally(() => {
        setTimeout(() => isLoadingRemoteBlog.set(false), 1000);
      });
  } else {
    // No OrbitDB address in the URL, so immediately set loading to false
    isLoadingRemoteBlog.set(false);
  }
  
  // Subscribe to address changes
  const unsubscribe = orbitDBAddress.subscribe(async (address) => {
    if (address && address !== previousAddress) {
      console.log('Detected OrbitDB address in URL:', address);
      previousAddress = address;
      
      try {
        // Set loading state to true when we start loading a remote blog
        isLoadingRemoteBlog.set(true);
        
        const success = await switchToRemoteDB(address, true);
        if (success) {
          console.log('Successfully switched to database from URL:', address);
        } else {
          console.error('Failed to switch to database from URL:', address);
        }
      } catch (error) {
        console.error('Error switching to database from URL:', error);
      } finally {
        // Set loading state to false when finished, whether successful or not
        setTimeout(() => isLoadingRemoteBlog.set(false), 1000); // Small delay for UX
      }
    }
  });
  
  return unsubscribe;
} 