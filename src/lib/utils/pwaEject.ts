import { info, debug, warn, error } from './logger.js';

export interface EjectOptions {
  clearServiceWorker?: boolean;
  clearIndexedDB?: boolean;
  clearLocalStorage?: boolean;
  clearOrbitDB?: boolean;
  clearHelia?: boolean;
}

/**
 * Comprehensive PWA eject function that clears ALL application data
 * This essentially "factory resets" the PWA back to a clean state
 */
export async function ejectPWA(options: EjectOptions = {}): Promise<void> {
  const {
    clearServiceWorker = true,
    clearIndexedDB = true,
    clearLocalStorage = true,
    clearOrbitDB = true,
    clearHelia = true
  } = options;

  info('🚀 Starting PWA eject process...');
  const cleanupTasks: Promise<void>[] = [];

  try {
    // 1. Unregister service worker and clear caches
    if (clearServiceWorker && 'serviceWorker' in navigator) {
      cleanupTasks.push(clearServiceWorkerAndCaches());
    }

    // 2. Clear all IndexedDB databases
    if (clearIndexedDB) {
      cleanupTasks.push(clearAllIndexedDBDatabases());
    }

    // 3. Clear localStorage (except theme preference to maintain UX)
    if (clearLocalStorage) {
      cleanupTasks.push(clearLocalStorageData());
    }

    // 4. Clear OrbitDB specific data
    if (clearOrbitDB) {
      cleanupTasks.push(clearOrbitDBData());
    }

    // 5. Clear Helia/IPFS data
    if (clearHelia) {
      cleanupTasks.push(clearHeliaData());
    }

    // Execute all cleanup tasks
    await Promise.allSettled(cleanupTasks);
    
    info('✅ PWA eject completed successfully');
    
    // Force reload to fresh state
    setTimeout(() => {
      window.location.reload();
    }, 1000);

  } catch (err) {
    error('❌ Error during PWA eject:', err);
    throw err;
  }
}

async function clearServiceWorkerAndCaches(): Promise<void> {
  try {
    info('🧹 Clearing service worker and caches...');
    
    // Get all service worker registrations
    const registrations = await navigator.serviceWorker.getRegistrations();
    
    // Unregister all service workers
    await Promise.all(
      registrations.map(registration => {
        debug(`Unregistering service worker: ${registration.scope}`);
        return registration.unregister();
      })
    );

    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          debug(`Deleting cache: ${cacheName}`);
          return caches.delete(cacheName);
        })
      );
    }

    info('✅ Service worker and caches cleared');
  } catch (err) {
    warn('Failed to clear service worker/caches:', err);
  }
}

async function clearAllIndexedDBDatabases(): Promise<void> {
  try {
    info('🗄️ Clearing all IndexedDB databases...');
    
    // Get list of all databases (if supported)
    let databases: IDBDatabaseInfo[] = [];
    if ('databases' in indexedDB) {
      databases = await indexedDB.databases();
    }
    
    // Common database names used by the app
    const commonDBNames = [
      'orbitdb',
      'orbitdb-cache', 
      'orbitdb-keystore',
      'level-js-orbitdb',
      'blockstore',
      'datastore',
      'helia-blocks',
      'helia-data',
      'level-js',
      // Add patterns for dynamic names
    ];

    // Combine detected databases with common names
    const dbNames = new Set([
      ...databases.map(db => db.name || ''),
      ...commonDBNames
    ]);

    // Delete all databases
    const deletePromises = Array.from(dbNames).map(dbName => {
      if (!dbName) return Promise.resolve();
      
      return new Promise<void>((resolve) => {
        debug(`Deleting IndexedDB: ${dbName}`);
        const deleteReq = indexedDB.deleteDatabase(dbName);
        
        deleteReq.onsuccess = () => {
          debug(`✅ Deleted IndexedDB: ${dbName}`);
          resolve();
        };
        
        deleteReq.onerror = () => {
          debug(`⚠️ Could not delete IndexedDB: ${dbName} (may not exist)`);
          resolve(); // Don't fail on non-existent DBs
        };
        
        deleteReq.onblocked = () => {
          debug(`⏸️ IndexedDB deletion blocked: ${dbName}`);
          resolve();
        };
        
        // Timeout after 5 seconds
        setTimeout(() => {
          debug(`⏰ Timeout deleting IndexedDB: ${dbName}`);
          resolve();
        }, 5000);
      });
    });

    await Promise.all(deletePromises);
    info('✅ IndexedDB databases cleared');
  } catch (err) {
    warn('Failed to clear IndexedDB databases:', err);
  }
}

async function clearLocalStorageData(): Promise<void> {
  try {
    info('📦 Clearing localStorage data...');
    
    // Preserve theme setting for better UX
    const theme = localStorage.getItem('theme');
    const language = localStorage.getItem('locale');
    
    // Clear all localStorage
    localStorage.clear();
    
    // Restore preserved items
    if (theme) localStorage.setItem('theme', theme);
    if (language) localStorage.setItem('locale', language);
    
    info('✅ localStorage cleared (preserved theme and language)');
  } catch (err) {
    warn('Failed to clear localStorage:', err);
  }
}

async function clearOrbitDBData(): Promise<void> {
  try {
    info('🌐 Clearing OrbitDB specific data...');
    
    // This will be handled by the IndexedDB cleanup, but we can add
    // specific OrbitDB cleanup logic here if needed
    
    // Clear any OrbitDB related sessionStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.includes('orbitdb')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
      debug(`Cleared sessionStorage key: ${key}`);
    });
    
    info('✅ OrbitDB data cleared');
  } catch (err) {
    warn('Failed to clear OrbitDB data:', err);
  }
}

async function clearHeliaData(): Promise<void> {
  try {
    info('🪐 Clearing Helia/IPFS data...');
    
    // Helia data is primarily stored in IndexedDB via LevelDB adapters
    // This is handled by the IndexedDB cleanup, but we can add specific
    // cleanup logic here if needed
    
    info('✅ Helia/IPFS data cleared');
  } catch (err) {
    warn('Failed to clear Helia data:', err);
  }
}

/**
 * Get an estimate of storage usage for the app
 */
export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return await navigator.storage.estimate();
    }
  } catch (err) {
    warn('Failed to get storage estimate:', err);
  }
  return null;
}

/**
 * Check if the app can be ejected (has data to clear)
 */
export async function canEject(): Promise<boolean> {
  try {
    // Check if we have any stored data
    const hasLocalStorage = localStorage.length > 0;
    const hasServiceWorker = 'serviceWorker' in navigator && 
      (await navigator.serviceWorker.getRegistrations()).length > 0;
    
    let hasIndexedDB = false;
    if ('databases' in indexedDB) {
      const databases = await indexedDB.databases();
      hasIndexedDB = databases.length > 0;
    }
    
    return hasLocalStorage || hasServiceWorker || hasIndexedDB;
  } catch (err) {
    warn('Failed to check eject status:', err);
    return false;
  }
}
