import { readable, derived, writable, get } from 'svelte/store';
import { switchToRemoteDB } from './dbUtils.js';
import { initialAddress } from './store.js';
import { info, debug, error } from './utils/logger.js';
const domain = window.location.hostname;
const isBrowser = typeof window !== 'undefined';

export const isLoadingRemoteBlog = writable(true);

async function queryTXT(domain: string) {
    // const _domain = 'nicokrause.com';
    const url = `https://${domain}/.orbitblog`;

    try {
        debug('querying initialAddress for domain', url);
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            cache: 'no-store'
        });
        const data = await response.json();
        if (data.initialAddress) {
            info('initialAddress', data.initialAddress);
            return data.initialAddress;
        }
    } catch (error) {
        info('LeSpaceBlog InitialAddress query not available:');
    }
    return '';
}

function getHash() {
    if (!isBrowser)
        return '';
    return window.location.hash ? window.location.hash.slice(1) : '';
}
// Extract OrbitDB address from hash path (e.g., "#/orbitdb/abcd..." -> "/orbitdb/abcd...")
function extractOrbitDBAddress(hash) {
    if (!hash)
        return '';
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
    if (!isBrowser)
        return;
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
export async function initHashRouter() {
    if (!isBrowser)
        return;
    let previousAddress = '';
    // Initial check for URL hash on page load
    const _initialAddressRouter = extractOrbitDBAddress(getHash());
    const _initialAddressDNS =  await queryTXT(domain);
    if (_initialAddressRouter || _initialAddressDNS) {
        const _initialAddress = _initialAddressRouter || _initialAddressDNS;
        info('initialAddress', _initialAddress);
        // Prevent immediate duplicate switch when orbitDBAddress store emits current hash.
        previousAddress = _initialAddress;
        
        await switchToRemoteDB(_initialAddress, true)
        initialAddress.set(_initialAddress);
        info('Initial remote blog load success');
        // No delay needed - switchToRemoteDB will handle the loading state
        debug('Setting isLoadingRemoteBlog to false');
        isLoadingRemoteBlog.set(false);
        // console.log('Switching to remote blog again');
        // await switchToRemoteDB(_initialAddress, true) //Workaround for initial load issue
    }
    else {
        // No OrbitDB address in the URL, so immediately set loading to false
        isLoadingRemoteBlog.set(false);
    }
    // Subscribe to address changes
    const unsubscribe = orbitDBAddress.subscribe(async (address) => {
        if (address && address !== previousAddress) {
            info('Detected OrbitDB address in URL:', address);
            previousAddress = address;
            try {
                // Set loading state to true when we start loading a remote blog
                isLoadingRemoteBlog.set(true);
                const success = await switchToRemoteDB(address, true);
                if (success) {
                    info('Successfully switched to database from URL:', address);
                }
                else {
                    info('Failed to switch to database from URL:', address);
                }
            }
            catch (_error) {
                error('Error switching to database from URL:', _error);
            }
            finally {
                // Set loading state to false when finished, whether successful or not
                // No delay needed - switchToRemoteDB will handle the loading state
                isLoadingRemoteBlog.set(false);
                // await switchToRemoteDB(address) //Workaround for initial load issue
            }
        }
    });
    return unsubscribe;
}
