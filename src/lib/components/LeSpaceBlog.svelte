<!-- @migration-task Error while migrating Svelte code: Cannot subscribe to stores that are not declared at the top level of the component
https://svelte.dev/e/store_invalid_scoped_subscription -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { _ } from 'svelte-i18n';

  import { createHelia } from 'helia';
  import { createLibp2p } from 'libp2p';
  import { createOrbitDB } from '@orbitdb/core';
  import OrbitDBAccessController from '@orbitdb/core/src/access-controllers/orbitdb.js';
  import { CID } from 'multiformats/cid';
  
  import { LevelDatastore } from 'datastore-level';
  import { LevelBlockstore } from 'blockstore-level';

  import Sidebar from './Sidebar.svelte';
  import PostForm from './PostForm.svelte';
  import PostList from './PostList.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import DBManager from './DBManager.svelte';
  import ConnectedPeers from './ConnectedPeers.svelte';
  import Settings from './Settings.svelte';
  import LoadingBlog from './LoadingBlog.svelte';
  import LanguageSelector from './LanguageSelector.svelte';
  import PWAEjectModal from './PWAEjectModal.svelte';

  import FaBars from 'svelte-icons/fa/FaBars.svelte';
  import FaTimes from 'svelte-icons/fa/FaTimes.svelte';
  import { getLocaleVersionString } from '$lib/utils/buildInfo.js';
  import { derived } from 'svelte/store';
  import { locale } from 'svelte-i18n';

  import { libp2pOptions, multiaddrs } from '$lib/config.js';
  import createIdentityProvider from '$lib/identityProvider.js';
  import { initHashRouter, isLoadingRemoteBlog } from '$lib/router.js';
  import { setupPeerEventListeners } from '$lib/peerConnections.js';
  import { getImageUrlFromHelia } from '$lib/utils/mediaUtils.js';
  import {
    WebAuthnVarsigProvider,
    createWebAuthnVarsigIdentity,
    createWebAuthnVarsigIdentities,
    storeWebAuthnVarsigCredential,
    loadWebAuthnVarsigCredential
  } from '@le-space/orbitdb-identity-provider-webauthn-did';
  import { unixfs } from '@helia/unixfs';
  import { 
    initialAddress,
    loadingState,
    postsDB, 
    postsDBAddress, 
    posts, 
    selectedPostId,
    remoteDBs, 
    remoteDBsDatabases, 
    showDBManager, 
    showPeers, 
    showSettings, 
    profilePictureCid,
    profileImageUrl,
    blogName, 
    libp2p, 
    helia, 
    orbitdb, 
    identity, 
    identities, 
    settingsDB, 
    blogDescription, 
    categories, 
    commentsDB,
    commentsDBAddress,
    mediaDB,
    mediaDBAddress,
    isRTL
  } from '$lib/store';

  import { info, debug, warn, error } from '../utils/logger.js'
  import { canEject } from '../utils/pwaEject.js'

  let blockstore = new LevelBlockstore('./helia-blocks');
  let datastore = new LevelDatastore('./helia-data');
  const WRITER_SESSION_SEED_KEY = 'writerSessionSeedV1';

  let identityMode = $state<'session' | 'passkey'>('session');
  let isActivatingIdentity = $state(false);
  let passkeyError = $state('');
  let hasStoredPasskey = $state(false);
  let canActivateWriterMode = $state(false);
  let canWrite = $state(false);
  let ownerIdentityId = $state<string | null>(null);
  let activeSignerDid = $state('not available');
  let passkeySignerDid = $state('not available');
  let showEjectModal = $state(false);
  let canEjectPWA = $state(false);

  // Add sidebar state variables
  let sidebarVisible = $state(true);
  let touchStartX = 0;
  let touchEndX = 0;
  const SWIPE_THRESHOLD = 50; 

  let routerUnsubscribe;
  let showNotification = false;

  let settingsDBUpdateHandler;
  let showWebRTCTester = false;
  
  // Track event listeners to prevent memory leaks
  let settingsDBUpdateListener = null;
  let postsDBUpdateListener = null;

  const sidebarPosition = $derived($isRTL ? 'right' : 'left');
  const sidebarButtonPosition = $derived($isRTL ? 'right' : 'left');
  const sidebarTriggerPosition = $derived($isRTL ? 'right' : 'left');

  // Create a reactive version string that updates when locale changes
  const reactiveVersionString = derived(locale, ($locale) => {
    return getLocaleVersionString();
  });

  // Check if PWA can be ejected (runs once on mount)
  $effect(() => {
    canEject().then(result => {
      canEjectPWA = result;
    });
  });

  let fs = $state();

  // Default behavior: use temporary session identity so readers don't need passkeys.
  // Writer mode can be explicitly enabled with passkey auth.
  if (typeof window !== 'undefined' && sessionStorage.getItem('identityMode') === 'passkey') {
    identityMode = 'passkey';
  }

  const bytesToBase64 = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes));
  const base64ToBytes = (value: string) =>
    Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const shortDid = (value?: string | null) => {
    if (!value) return 'not available';
    if (value.length <= 24) return value;
    return `${value.slice(0, 12)}...${value.slice(-8)}`;
  };

  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
  }

  async function activatePasskeyIdentity() {
    console.log('[LeSpaceBlog] activatePasskeyIdentity start', {
      identityMode,
      currentIdentityId: $identity?.id,
      currentIdentityType: $identity?.type,
      ownerIdentityId
    });
    passkeyError = '';
    isActivatingIdentity = true;
    try {
      let credential = loadWebAuthnVarsigCredential();
      console.log('[LeSpaceBlog] loaded stored credential', {
        hasCredential: !!credential,
        did: credential?.did
      });
      if (!credential) {
        console.log('[LeSpaceBlog] creating new credential');
        credential = await WebAuthnVarsigProvider.createCredential({
          userId: `le-space-${Date.now()}`,
          displayName: 'Le Space Blog Writer'
        });
        console.log('[LeSpaceBlog] created credential', { did: credential?.did });
        storeWebAuthnVarsigCredential(credential);
        hasStoredPasskey = true;
      }

      // Re-verify passkey once when unlocking writer mode.
      await createWebAuthnVarsigIdentity({
        credential,
        userVerification: 'required',
        mediation: 'required'
      });

      // Always rotate delegated writer-session credentials when unlocking writer mode.
      const writerSessionSeed = crypto.getRandomValues(new Uint8Array(32));
      const writerSessionIdProvider = await createIdentityProvider('ed25519', writerSessionSeed, $helia);
      const writerSessionDid = writerSessionIdProvider.identity.id;

      if (ownerIdentityId && credential.did !== ownerIdentityId) {
        // Local session-owner promotion path:
        // grant passkey DID on all current blog DBs, then revoke session DID.
        const isLocalOwnerSession = Boolean(
          identityMode === 'session' &&
          $identity?.id &&
          ownerIdentityId === $identity.id &&
          $settingsDB &&
          $postsDB &&
          $commentsDB &&
          $mediaDB
        );

        if (!isLocalOwnerSession) {
          throw new Error('This passkey is not authorized as writer for the current blog.');
        }

        const dbs = [
          { name: 'settings', db: $settingsDB },
          { name: 'posts', db: $postsDB },
          { name: 'comments', db: $commentsDB },
          { name: 'media', db: $mediaDB }
        ];
        const currentSessionDid = $identity.id;
        const passkeyDid = credential.did;

        for (const { name, db } of dbs) {
          if (typeof db?.access?.grant !== 'function' || typeof db?.access?.revoke !== 'function') {
            throw new Error('Current blog uses a static access controller. Cannot promote writer with grant/revoke.');
          }
        }

        const withTimeout = async (promise: Promise<any>, label: string, ms = 7000) => {
          let timer: any;
          const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), ms);
          });
          try {
            return await Promise.race([promise, timeout]);
          } finally {
            clearTimeout(timer);
          }
        };

        const reopenDbByName = async (name: string, addr: string) => {
          const reopened = await $orbitdb.open(addr, { create: false });
          if (name === 'settings') $settingsDB = reopened as any;
          if (name === 'posts') $postsDB = reopened as any;
          if (name === 'comments') $commentsDB = reopened as any;
          if (name === 'media') $mediaDB = reopened as any;
          return reopened;
        };

        for (const entry of dbs) {
          const { name } = entry;
          let db = entry.db;
          const addr = db?.address?.toString?.() || `unknown-${name}`;
          const writeList = db?.access?.write || [];
          if (writeList.includes('*') || writeList.includes(writerSessionDid)) {
            console.log('[LeSpaceBlog] skipped grant write', { name, db: addr, reason: 'already writable (wildcard or passkey DID present)' });
            continue;
          }
          try {
            console.log('[LeSpaceBlog] granting write', { name, db: addr, writerSessionDid });
            await withTimeout(db.access.grant('write', writerSessionDid), `grant write ${name}`);
            console.log('[LeSpaceBlog] granted write', { name, db: addr, writerSessionDid });
          } catch (grantErr) {
            if (String((grantErr as any)?.message || '').includes('Database is not open')) {
              try {
                console.warn('[LeSpaceBlog] db closed during grant, reopening and retrying', { name, db: addr });
                db = await reopenDbByName(name, addr);
                entry.db = db;
                await withTimeout(db.access.grant('write', writerSessionDid), `grant write retry ${name}`);
                console.log('[LeSpaceBlog] granted write after reopen', { name, db: addr, writerSessionDid });
                continue;
              } catch (retryErr) {
                console.error('[LeSpaceBlog] grant retry failed', { name, db: addr, writerSessionDid, retryErr });
                throw retryErr;
              }
            }
            console.error('[LeSpaceBlog] grant write failed', { name, db: addr, writerSessionDid, grantErr });
            throw grantErr;
          }
        }

        await $settingsDB.put({ _id: 'ownerIdentity', value: passkeyDid });
        ownerIdentityId = passkeyDid;

        for (const { name, db } of dbs) {
          const addr = db?.address?.toString?.() || `unknown-${name}`;
          const writeList = db?.access?.write || [];
          if (writeList.includes('*')) {
            console.log('[LeSpaceBlog] skipped revoke on wildcard db', { name, db: addr });
            continue;
          }
          try {
            await withTimeout(db.access.revoke('write', currentSessionDid), `revoke write ${name}`);
            console.log('[LeSpaceBlog] revoked previous session write', { name, db: addr, currentSessionDid });
          } catch (revokeErr) {
            console.warn('[LeSpaceBlog] revoke session write failed (non-fatal)', { name, db: addr, currentSessionDid, revokeErr });
          }
        }

        try {
          await $settingsDB.put({ _id: 'activeSessionDid', value: writerSessionDid });
        } catch {}
      }

      sessionStorage.setItem(WRITER_SESSION_SEED_KEY, bytesToBase64(writerSessionSeed));

      // Switch to delegated writer-session identity in-place (no full page reload) by creating a
      // fresh OrbitDB instance and reopening databases with the new identity.
      const writerSeedB64 = sessionStorage.getItem(WRITER_SESSION_SEED_KEY);
      if (!writerSeedB64) throw new Error('No delegated writer session seed available.');
      const writerSeed = base64ToBytes(writerSeedB64);
      const writerIdentityProvider = await createIdentityProvider('ed25519', writerSeed, $helia);
      const writerIdentity = writerIdentityProvider.identity;
      const writerIdentities = writerIdentityProvider.identities;

      const previousOrbitdb = $orbitdb;
      const previousDbs = {
        settings: $settingsDB,
        posts: $postsDB,
        comments: $commentsDB,
        media: $mediaDB,
        remote: $remoteDBsDatabases
      };

      const settingsAddr = $settingsDB?.address?.toString?.();
      const postsAddr = $postsDB?.address?.toString?.();
      const commentsAddr = $commentsDB?.address?.toString?.();
      const mediaAddr = $mediaDB?.address?.toString?.();
      const remoteAddr = $remoteDBsDatabases?.address?.toString?.();

      // Stop previous handles first to avoid duplicate libp2p protocol handlers.
      try { await previousDbs.settings?.close?.(); } catch {}
      try { await previousDbs.posts?.close?.(); } catch {}
      try { await previousDbs.comments?.close?.(); } catch {}
      try { await previousDbs.media?.close?.(); } catch {}
      try { await previousDbs.remote?.close?.(); } catch {}
      try { await previousOrbitdb?.stop?.(); } catch {}

      // Let protocol unregistrations settle before creating a new OrbitDB instance.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const newOrbitdb = await createOrbitDB({
        ipfs: $helia,
        identity: writerIdentity,
        identities: writerIdentities as any,
        storage: blockstore,
        directory: './orbitdb',
      });

      const newSettings = await newOrbitdb.open(settingsAddr || 'settings', {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/settings',
        identity: writerIdentity,
        identities: writerIdentities as any,
        AccessController: OrbitDBAccessController({ write: [writerIdentity.id] }),
      });
      const newPosts = await newOrbitdb.open(postsAddr || 'posts', {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/posts',
        identity: writerIdentity,
        identities: writerIdentities as any,
        AccessController: OrbitDBAccessController({ write: [writerIdentity.id] }),
      });
      const newComments = await newOrbitdb.open(commentsAddr || 'comments', {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/comments',
        identity: writerIdentity,
        identities: writerIdentities as any,
        AccessController: OrbitDBAccessController({ write: ['*'] }),
      });
      const newMedia = await newOrbitdb.open(mediaAddr || 'media', {
        type: 'documents',
        create: true,
        overwrite: false,
        directory: './orbitdb/media',
        identity: writerIdentity,
        identities: writerIdentities as any,
        AccessController: OrbitDBAccessController({ write: [writerIdentity.id] }),
      });
      const newRemoteDbs = await newOrbitdb.open(remoteAddr || 'remote-dbs', {
        type: 'documents',
        create: true,
        overwrite: false,
        identity: writerIdentity,
        identities: writerIdentities as any,
        AccessController: OrbitDBAccessController({ write: [writerIdentity.id] }),
      });

      $orbitdb = newOrbitdb as any;
      $identities = writerIdentities as any;
      $identity = writerIdentity as any;
      $settingsDB = newSettings as any;
      $postsDB = newPosts as any;
      $commentsDB = newComments as any;
      $mediaDB = newMedia as any;
      $remoteDBsDatabases = newRemoteDbs as any;
      $postsDBAddress = newPosts.address?.toString?.() || $postsDBAddress;
      $commentsDBAddress = newComments.address?.toString?.() || $commentsDBAddress;
      $mediaDBAddress = newMedia.address?.toString?.() || $mediaDBAddress;

      ;(window as any).settingsDB = newSettings;
      ;(window as any).postsDB = newPosts;
      ;(window as any).commentsDB = newComments;
      ;(window as any).mediaDB = newMedia;
      ;(window as any).remoteDBsDatabases = newRemoteDbs;

      // owner identity remains passkey DID; active runtime writer is delegated session DID.

      // Invalidate session identity traces once passkey writer mode is activated.
      sessionStorage.removeItem('sessionIdentityDid');
      sessionStorage.setItem('identityMode', 'passkey');
      sessionStorage.setItem('activeIdentityDid', writerIdentity.id);
      sessionStorage.setItem('activeIdentityType', writerIdentity.type || 'delegated-session');
      sessionStorage.setItem('passkeyIdentityDid', credential.did);
      identityMode = 'passkey';
      console.log('[LeSpaceBlog] activation success, switched to delegated writer-session mode in-place');
    } catch (err: any) {
      console.error('[LeSpaceBlog] activatePasskeyIdentity failed', err);
      error('Passkey identity activation failed', err);
      passkeyError = err?.message || 'Failed to activate passkey identity';
    } finally {
      isActivatingIdentity = false;
    }
  }

  function handleActivatePasskeyWriterFromSettings() {
    console.log('[LeSpaceBlog] received Settings activatePasskeyWriter event');
    activatePasskeyIdentity();
  }

	  async function initializeApp() {
	    
	    info('initializeApp')
	    
	    const _libp2p = await createLibp2p({ ...libp2pOptions })
	    $libp2p = _libp2p
	    ;(window as any).libp2p=_libp2p
    // for (const multiaddr of multiaddrs) { 
    //   try {
    //     info('dialing', multiaddr)
    //     const connection = await $libp2p.dial(multiaddr)
    //     info('connection', connection)
    //   } catch (err) {
    //     warn('error dialing', err)
    //   }
    // }
	    $helia = await createHelia({ libp2p: $libp2p, datastore, blockstore }) as any
	    //     const { valid, invalid, dialable, undialable } = await validateMultiaddrs(multiaddrs, $libp2p)
	    // info('valid', valid)
	    // info('invalid', invalid)
	    // info('dialable', dialable)
	    // info('undialable', undialable)
      if (identityMode === 'passkey') {
        const writerSeedB64 = sessionStorage.getItem(WRITER_SESSION_SEED_KEY);
        if (!writerSeedB64) {
          sessionStorage.removeItem('identityMode');
          identityMode = 'session';
          throw new Error('Writer session requested, but no delegated session seed was found. Unlock writer mode again.');
        }
        const writerSeed = base64ToBytes(writerSeedB64);
        const idProvider = await createIdentityProvider('ed25519', writerSeed, $helia);
        $identities = idProvider.identities;
        $identity = idProvider.identity;
        if (typeof window !== 'undefined' && idProvider?.identity?.id) {
          sessionStorage.setItem('activeIdentityDid', idProvider.identity.id);
          sessionStorage.setItem('activeIdentityType', 'delegated-session');
        }
      } else {
        const sessionSeed = crypto.getRandomValues(new Uint8Array(32));
        const idProvider = await createIdentityProvider('ed25519', sessionSeed, $helia);
        $identities = idProvider.identities;
        $identity = idProvider.identity;
        if (typeof window !== 'undefined' && idProvider?.identity?.id) {
          sessionStorage.setItem('activeIdentityDid', idProvider.identity.id);
          sessionStorage.setItem('activeIdentityType', idProvider.identity.type || 'ed25519');
          sessionStorage.setItem('sessionIdentityDid', idProvider.identity.id);
        }
      }
	    
	    $orbitdb = await createOrbitDB({
	      ipfs: $helia,
	      identity: $identity,
	      identities: $identities,
	      storage: blockstore,
	      directory: './orbitdb',
	    })
    setupPeerEventListeners($libp2p);

    if ($helia) {
      fs = unixfs($helia as any);
      info('UnixFS initialized');
    }

    // Initialize hash router first so remote-read mode can skip local DB creation.
    routerUnsubscribe = await initHashRouter();
    if (!$initialAddress) {
      await createDefaultDatabases();
    }
  }

  // Move the default database creation to a separate function
  async function createDefaultDatabases() {
    const LOCAL_DB_ADDRS_KEY = 'localBlogDbAddressesV1';
    const loadLocalDbAddrs = () => {
      if (typeof window === 'undefined') return {};
      try {
        return JSON.parse(localStorage.getItem(LOCAL_DB_ADDRS_KEY) || '{}') || {};
      } catch {
        return {};
      }
    };
    const saveLocalDbAddrs = (value: any) => {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(LOCAL_DB_ADDRS_KEY, JSON.stringify(value));
      } catch {}
    };
    const persistedAddrs = loadLocalDbAddrs();
    const openWithFallback = async (
      target: string,
      name: string,
      options: any,
      targetWasPersisted = false
    ) => {
      try {
        return await $orbitdb.open(target, {
          ...options,
          create: !targetWasPersisted
        });
      } catch (err) {
        if (target !== name) {
          warn(`Failed opening persisted ${name} address, trying name fallback`, { target, err });
          try {
            return await $orbitdb.open(name, { ...options, create: false });
          } catch {
            return await $orbitdb.open(name, { ...options, create: true });
          }
        }
        throw err;
      }
    };

    // IMPORTANT: This must await all opens. Otherwise, the `.then(...)` handlers can
    // run *after* `switchToRemoteDB()` and overwrite the global stores back to local DBs.
    try {
      const settingsTarget = persistedAddrs.settings || 'settings';
      const _db = await openWithFallback(settingsTarget, 'settings', {
        type: 'documents',
        overwrite: false,
        directory: './orbitdb/settings',
        identity: $identity,
        identities: $identities,
        AccessController: OrbitDBAccessController({ write: [$identity.id] }),
      }, Boolean(persistedAddrs.settings))
      $settingsDB = _db
      ;(window as any).settingsDB = _db

      // Persist the blog owner identity so remote viewers can reliably detect ownership.
      ownerIdentityId = $identity.id
      try {
        const entry = await _db.get('ownerIdentity')
        const existing = entry?.value?.value
        if (!existing) await _db.put({ _id: 'ownerIdentity', value: $identity.id })
      } catch {
        // best-effort only
      }
    } catch (err) {
      warn('Error opening settings DB:', err)
    }

    // Read linked db addresses from settings if available.
    let linkedPostsAddr = '';
    let linkedCommentsAddr = '';
    let linkedMediaAddr = '';
    try {
      const settingsDocs = await $settingsDB?.all?.();
      linkedPostsAddr = settingsDocs?.find((e: any) => e?.value?._id === 'postsDBAddress')?.value?.value || '';
      linkedCommentsAddr = settingsDocs?.find((e: any) => e?.value?._id === 'commentsDBAddress')?.value?.value || '';
      linkedMediaAddr = settingsDocs?.find((e: any) => e?.value?._id === 'mediaDBAddress')?.value?.value || '';
    } catch {}

    try {
      const postsTarget = linkedPostsAddr || persistedAddrs.posts || 'posts';
      const _db = await openWithFallback(postsTarget, 'posts', {
        type: 'documents',
        overwrite: false,
        directory: './orbitdb/posts',
        identity: $identity,
        identities: $identities,
        AccessController: OrbitDBAccessController({ write: [$identity.id] }),
      }, Boolean(linkedPostsAddr || persistedAddrs.posts))
      $postsDB = _db
      ;(window as any).postsDB = _db
      info('postsDB', _db.address.toString())
      $postsDBAddress = _db.address.toString()
    } catch (err) {
      warn('Error opening posts DB:', err)
    }

    try {
      const _db = await $orbitdb.open('remote-dbs', {
        type: 'documents',
        create: true,
        overwrite: false,
        identities: $identities,
        identity: $identity,
        AccessController: OrbitDBAccessController({ write: [$identity.id] }),
      })
      $remoteDBsDatabases = _db
      ;(window as any).remoteDBsDatabases = _db
    } catch (err) {
      warn('Error opening remote DBs database:', err)
    }

    try {
      const commentsTarget = linkedCommentsAddr || persistedAddrs.comments || 'comments';
      const _db = await openWithFallback(commentsTarget, 'comments', {
        type: 'documents',
        overwrite: false,
        directory: './orbitdb/comments',
        identity: $identity,
        identities: $identities,
        AccessController: OrbitDBAccessController({ write: ['*'] }),
      }, Boolean(linkedCommentsAddr || persistedAddrs.comments))
      $commentsDB = _db
      $commentsDBAddress = _db.address.toString()
      ;(window as any).commentsDB = _db
    } catch (err) {
      warn('Error opening comments DB:', err)
    }

    try {
      const mediaTarget = linkedMediaAddr || persistedAddrs.media || 'media';
      const _db = await openWithFallback(mediaTarget, 'media', {
        type: 'documents',
        overwrite: false,
        directory: './orbitdb/media',
        identity: $identity,
        identities: $identities,
        AccessController: OrbitDBAccessController({ write: [$identity.id] }),
      }, Boolean(linkedMediaAddr || persistedAddrs.media))
      $mediaDB = _db
      $mediaDBAddress = _db.address.toString()
      ;(window as any).mediaDB = _db
    } catch (err) {
      warn('Error opening media DB:', err)
    }

    // Persist actual addresses so reloads reopen the same local blog DB set.
    saveLocalDbAddrs({
      settings: $settingsDB?.address?.toString?.() || persistedAddrs.settings || '',
      posts: $postsDB?.address?.toString?.() || persistedAddrs.posts || '',
      comments: $commentsDB?.address?.toString?.() || persistedAddrs.comments || '',
      media: $mediaDB?.address?.toString?.() || persistedAddrs.media || ''
    });
  }

  $effect(() => {
    const credential = loadWebAuthnVarsigCredential();
    hasStoredPasskey = !!credential;
    canActivateWriterMode = Boolean(
      credential?.did &&
      ownerIdentityId &&
      credential.did === ownerIdentityId &&
      identityMode !== 'passkey'
    );
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    const credential = loadWebAuthnVarsigCredential();
    activeSignerDid = $identity?.id || sessionStorage.getItem('activeIdentityDid') || 'not available';
    passkeySignerDid =
      sessionStorage.getItem('passkeyIdentityDid') ||
      credential?.did ||
      'not available';
  });

  $effect(() => {
    if($initialAddress) {
      info('initialAddress', $initialAddress);
      sidebarVisible = false;
    }
  });
  
  /**
   * Check if the user has write access to the posts database
  */
  $effect(() => {
    if ($orbitdb && $postsDB && $identity) {
      const postsAddr = $postsDB.address?.toString?.() || String($postsDB.address || '');
      const writeAccess = $postsDB?.access?.write || [];
      canWrite = Boolean((writeAccess.includes($identity.id) || writeAccess.includes('*')) && (postsAddr === $postsDBAddress));
    }
  });

  onDestroy(async () => {
    if (routerUnsubscribe) routerUnsubscribe();
    
    // Clean up all event listeners
    if (settingsDBUpdateHandler) {
      $settingsDB?.events.removeListener('update', settingsDBUpdateHandler);
    }
    if (settingsDBUpdateListener) {
      $settingsDB?.events.removeListener('update', settingsDBUpdateListener);
    }
    if (postsDBUpdateListener) {
      $postsDB?.events.removeListener('update', postsDBUpdateListener);
    }
    
    try {
      await $settingsDB?.close();
      await $commentsDB?.close();
      await $postsDB?.close();
      await $mediaDB?.close();
    } catch (_error) {
      error('Error closing OrbitDB connections:', _error);
    }
  })

  // Databases are now only opened in createDefaultDatabases() or switchToRemoteDB()
  // This prevents duplicate protocol handler registration

  // Track the last settingsDB address to prevent duplicate loading
  let lastSettingsDBAddress = '';
  let lastOwnerIdentitySettingsAddr = '';
  // Persist sub-DB addresses into settings only once per (settingsAddr, subDbAddr) pair.
  let lastPersistedSettingsAddr = '';
  let lastPersistedPostsAddr = '';
  let lastPersistedCommentsAddr = '';
  let lastPersistedMediaAddr = '';

  // Load ownerIdentity from the current settings DB (local or remote).
  $effect(() => {
    if (!$settingsDB || !$identity) return;
    const settingsAddr = $settingsDB.address?.toString?.() || '';
    if (!settingsAddr || settingsAddr === lastOwnerIdentitySettingsAddr) return;
    lastOwnerIdentitySettingsAddr = settingsAddr;

    const loadOwner = async (retries = 10) => {
      try {
        const entry = await $settingsDB.get('ownerIdentity');
        const value = entry?.value?.value;
        if (value) {
          ownerIdentityId = value;
          return;
        }

        // If we're the settings writer (local blog), treat us as owner even if the entry isn't persisted yet.
        if ($settingsDB.access?.write?.includes($identity.id)) {
          ownerIdentityId = $identity.id;
        }

        if (retries > 0) {
          setTimeout(() => loadOwner(retries - 1), 300);
        }
      } catch {
        if (retries > 0) setTimeout(() => loadOwner(retries - 1), 300);
      }
    };

    loadOwner();
  });
  
  $effect(() => {
    if($settingsDB && $settingsDB.address.toString() !== lastSettingsDBAddress) {
    // Update the tracking variable
    lastSettingsDBAddress = $settingsDB.address.toString();
    info('Loading settings from new database:', lastSettingsDBAddress);
    
    // Initial load of settings - use .all() to get all documents first to avoid CID parsing errors on empty DBs
    $settingsDB.all().then(allSettings => {
      info('All settings from database:', allSettings);

      const canWriteSettings = $settingsDB?.access?.write?.includes?.($identity?.id);
      
      // Process each setting
      for (const entry of allSettings) {
        const setting = entry.value;
        switch(setting._id) {
          case 'blogName':
            if (setting.value !== undefined) blogName.set(setting.value);
            break;
          case 'blogDescription':
            if (setting.value !== undefined) blogDescription.set(setting.value);
            break;
          case 'categories':
            if (setting.value !== undefined) categories.set(setting.value);
            break;
          case 'postsDBAddress':
            if (setting.value !== undefined) postsDBAddress.set(setting.value);
            break;
          case 'commentsDBAddress':
            if (setting.value !== undefined) commentsDBAddress.set(setting.value);
            break;
          case 'mediaDBAddress':
            // Currently not storing this in a variable, but could be used later
            break;
          case 'profilePicture':
            if (setting.value !== undefined) {
              profilePictureCid.set(setting.value);
              info('Set profile picture CID from settings:', setting.value);
            }
            break;
        }
      }
      
      // If no postsDBAddress found but we have a postsDB, save it (only if we can write settings).
      if (canWriteSettings && !$postsDBAddress && $postsDB?.address) {
        const postsDBAddressValue = $postsDB.address.toString();
        try {
          $settingsDB?.put({ _id: 'postsDBAddress', value: postsDBAddressValue});
          postsDBAddress.set(postsDBAddressValue);
        } catch (err) {
          console.error('Failed to write postsDBAddress to DB:', err);
        }
      }
      
      // If no commentsDBAddress found but we have a commentsDB, save it (only if we can write settings).
      if (canWriteSettings && !$commentsDBAddress && $commentsDB?.address) {
        const commentsDBAddressValue = $commentsDB.address.toString();
        try {
          $settingsDB?.put({ _id: 'commentsDBAddress', value: commentsDBAddressValue});
          commentsDBAddress.set(commentsDBAddressValue);
        } catch (err) {
          console.error('Failed to write commentsDBAddress to DB:', err);
        }
      }
      
      // If no mediaDBAddress found but we have a mediaDB, save it (only if we can write settings).
      if (canWriteSettings && $mediaDB?.address) {
        const mediaDBAddress = $mediaDB.address.toString();
        try {
          $settingsDB?.put({ _id: 'mediaDBAddress', value: mediaDBAddress});
        } catch (err) {
          console.error('Failed to write mediaDBAddress to DB:', err);
        }
      }
    }).catch(err => {
      warn('Error loading settings from database:', err);
      // If database is completely empty or has issues, we can still continue
      // The settings will be created as needed when the user makes changes
    });

    // Clean up existing settingsDB event listener
    if (settingsDBUpdateListener) {
      $settingsDB?.events.removeListener('update', settingsDBUpdateListener);
    }
    
    // Create new event listener
    settingsDBUpdateListener = async (entry) => {
      info('Settings database update:', entry);
      if (entry?.payload?.op === 'PUT') {
        const { _id, ...rest } = entry.payload.value;
        info('settingsDB update:', rest);
        
        // Update the appropriate store based on the _id
        switch(_id) {
          case 'blogName':
            $blogName = rest.value;
            break;
          case 'blogDescription':
            $blogDescription = rest.value;
            break;
          case 'categories':
            $categories = rest.value;
            break;
          case 'profilePicture':
            $profilePictureCid = rest.value;
            break;
          // ... handle other settings ...
        }
      } else if (entry?.payload?.op === 'DEL') {
        info('settingsDB delete:', entry.payload.key);
        // Handle deletions if needed
      }
    };
    
    // Add the new event listener
    $settingsDB?.events.on('update', settingsDBUpdateListener);
    }
  });

  // Ensure settings DB contains pointers to the sub-databases. Without these,
  // other peers cannot discover which posts/comments/media DB to open.
  $effect(() => {
    if (!$settingsDB || !$identity) return;

    const canWriteSettings = $settingsDB?.access?.write?.includes($identity.id);
    if (!canWriteSettings) return;

    const settingsAddr = $settingsDB.address?.toString?.() || '';

    const postsAddr = $postsDB?.address?.toString?.() || '';
    if (postsAddr && (settingsAddr !== lastPersistedSettingsAddr || postsAddr !== lastPersistedPostsAddr)) {
      lastPersistedSettingsAddr = settingsAddr;
      lastPersistedPostsAddr = postsAddr;
      $settingsDB.put({ _id: 'postsDBAddress', value: postsAddr }).catch((err) => {
        console.error('Failed to persist postsDBAddress to settings:', err);
      });
    }

    const commentsAddr = $commentsDB?.address?.toString?.() || '';
    if (commentsAddr && (settingsAddr !== lastPersistedSettingsAddr || commentsAddr !== lastPersistedCommentsAddr)) {
      lastPersistedSettingsAddr = settingsAddr;
      lastPersistedCommentsAddr = commentsAddr;
      $settingsDB.put({ _id: 'commentsDBAddress', value: commentsAddr }).catch((err) => {
        console.error('Failed to persist commentsDBAddress to settings:', err);
      });
    }

    const mediaAddr = $mediaDB?.address?.toString?.() || '';
    if (mediaAddr && (settingsAddr !== lastPersistedSettingsAddr || mediaAddr !== lastPersistedMediaAddr)) {
      lastPersistedSettingsAddr = settingsAddr;
      lastPersistedMediaAddr = mediaAddr;
      $settingsDB.put({ _id: 'mediaDBAddress', value: mediaAddr }).catch((err) => {
        console.error('Failed to persist mediaDBAddress to settings:', err);
      });
    }
  });

  // Add logging for profilePictureCid changes
  $effect(() => {
    if ($profilePictureCid) {
      info('Profile picture CID changed:', $profilePictureCid);
    }
  });

  $effect(() => {
    if($postsDB){
    $postsDB.all().then(_posts => {
      // info('posts--', _posts);
      $posts = _posts.map(entry => ({
        ...entry.value,
        identity: entry.value.identity || entry.identity?.id // Use saved identity or fallback to entry identity ID
      }));
    }).catch(err => warn('Error opening posts database:', err));

    // Clean up existing postsDB event listener
    if (postsDBUpdateListener) {
      $postsDB?.events.removeListener('update', postsDBUpdateListener);
    }
    
    // Create new event listener
    postsDBUpdateListener = async (entry) => {
      info('Posts database update:', entry);
      try {
        // Re-read the full documents set to reliably reflect both local writes
        // and replicated remote writes.
        const allPosts = await $postsDB.all();
        $posts = allPosts.map(doc => ({
          ...doc.value,
          identity: doc.value.identity || doc.identity?.id
        }));
      } catch (err) {
        warn('Error refreshing posts after update event:', err);
      }
    };
    
    // Add the new event listener
    $postsDB.events.on('update', postsDBUpdateListener);
    }
  });

  $effect(() => {
    if($remoteDBsDatabases){
    info('Remote DBs database opened successfully:', $remoteDBsDatabases);
    
    const loadRemoteDBs = async () => {
      info('Starting to load remote DBs...');
      const savedDBs = await $remoteDBsDatabases.all();
      info("all of remoteDBsDatabases", savedDBs, new Date().toISOString());
      const _remoteDBs = savedDBs.map(entry => entry.value);
      info('Remote DBs list:', _remoteDBs);
      
      // Process each database
      _remoteDBs.forEach(async db => {
        // Load each database independently
      //   if (db.postsAddress) {
      //     console.log('loading postsDB', db.postsAddress)
      //     $orbitdb.open(db.postsAddress)
      //       .then(async postsDB => {
      //         console.log('postsDB loaded', postsDB)
      //         db.access = postsDB.access;
      //         const posts = await postsDB.all();
      //         db.postsCount = posts.length;
      //       })
      //       .catch(error => {
      //         console.info(`Posts database not available for ${db.name}:`, error);
      //         db.postsCount = 0;
      //       });

      //   if (db.commentsAddress) {
      //     console.log('loading commentsDB', db.commentsAddress)
      //     $orbitdb.open(db.commentsAddress)
      //       .then(async commentsDB => {
      //         console.log('commentsDB loaded', commentsDB)
      //         const comments = await commentsDB.all();
      //         db.commentsCount = comments.length;
      //       })
      //       .catch(error => {
      //         console.info(`Comments database not available for ${db.name}:`, error);
      //         db.commentsCount = 0;
      //       });
      //   }

      //   if (db.mediaAddress) {
      //     console.log('loading mediaDB', db.mediaAddress)
      //     $orbitdb.open(db.mediaAddress)
      //       .then(async mediaDB => {
      //         console.log('mediaDB loaded', mediaDB)
      //         const media = await mediaDB.all();
      //         db.mediaCount = media.length;
      //       })
      //       .catch(error => {
      //         console.info(`Media database not available for ${db.name}:`, error);
      //         db.mediaCount = 0;
      //       });
      //   }
      });

      $remoteDBs = _remoteDBs;
    };
    
    loadRemoteDBs() //.catch(err => console.error('Error loading remote DBs:', err));
    }
  });

  function handleTouchStart(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    touchStartX = clientX;
    info('Touch/Mouse start:', touchStartX);
  }

  function handleTouchMove(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    touchEndX = clientX;
  }

  function handleTouchEnd(e) {
    info('Touch/Mouse end:', 'startX:', touchStartX, 'endX:', touchEndX);
    const deltaX = touchStartX - touchEndX;
    const swipeDistance = Math.abs(deltaX);
    
    if (swipeDistance > SWIPE_THRESHOLD) {
      if (deltaX > 0 && sidebarVisible) {
        // Swipe left - hide sidebar
        info('Swiping left to hide sidebar');
        sidebarVisible = false;
        e?.preventDefault?.();
      } else if (deltaX < 0 && !sidebarVisible) {
        // Swipe right - show sidebar
        info('Swiping right to show sidebar');
        sidebarVisible = true;
        e?.preventDefault?.();
      }
    }
    
    // Reset values
    touchStartX = 0;
    touchEndX = 0;
  }

  // Add mouse-related functions
  function handleMouseEnter() {
    if (!sidebarVisible) {
      sidebarVisible = true;
    }
  }

  // Function to copy the settingsDB address to clipboard
  async function copySettingsDBAddress() {
    if ($settingsDB) {
      try {
        const address = $settingsDB.address.toString();
        await navigator.clipboard.writeText(address);
        showNotification = true;
        setTimeout(() => showNotification = false, 3000); // Hide notification after 3 seconds
      } catch (err) {
        error('Failed to copy address: ', err);
      }
    } else {
      alert('Settings database is not available.');
    }
  }

  function openEjectModal() {
    showEjectModal = true;
  }

  function closeEjectModal() {
    showEjectModal = false;
  }

  $effect(() => {
    if ($helia && !fs) {
      fs = unixfs($helia as any);
      info('LeSpaceBlog - UnixFS initialized');
    }
  });

  initializeApp().catch((err) => {
    error('App initialization failed', err);
    if (identityMode === 'passkey') {
      sessionStorage.removeItem('identityMode');
      window.location.reload();
    }
  });
</script>
<svelte:head>
  <title>{$blogName} {__APP_VERSION__}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
  <meta name="description" content="{$blogDescription}">
  <!-- <meta name="author" content="{$blogName}"> -->
  <meta name="keywords" content="{Array.isArray($categories) ? $categories.join(', ') : $categories}">
  <meta name="author" content="{$blogName}">
  <meta name="robots" content="index, follow">
  <meta name="googlebot" content="index, follow">
  <meta name="bingbot" content="index, follow">
  <meta name="alexa" content="index, follow">
  <meta name="yandex" content="index, follow">
  <meta name="sitemap" content="index, follow">
  <!--no cache-->
  <meta name="cache-control" content="no-cache, no-store, must-revalidate">
  <meta name="pragma" content="no-cache">
  <meta name="expires" content="0">
  <!-- <meta name="cache-busting" content="{$cacheBusting}"> -->
  <meta name="theme-color" content="#000000">
  <meta name="msapplication-navbutton-color" content="#000000">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="application-name" content="{$blogName}">
  <meta name="apple-mobile-web-app-title" content="{$blogName}">
  <meta name="msapplication-TileColor" content="#000000">
  <meta name="msapplication-TileImage" content="{$blogName}">
  <meta name="msapplication-config" content="{$blogName}">
  <meta name="msapplication-starturl" content="{$blogName}">
  <meta name="msapplication-navbutton-color" content="#000000">
  <meta name="msapplication-TileColor" content="#000000">
  <meta name="msapplication-TileImage" content="{$blogName}">
  <meta name="dir" content={$isRTL ? 'rtl' : 'ltr'}>
</svelte:head>

<!-- Capture swipe gestures globally instead of attaching listeners to a non-interactive element. -->
<svelte:window
  ontouchstart={handleTouchStart}
  ontouchmove={handleTouchMove}
  ontouchend={handleTouchEnd}
  onmousedown={handleTouchStart}
  onmousemove={handleTouchMove}
  onmouseup={handleTouchEnd}
/>

  <div class="flex min-h-screen transition-colors" style="background-color: var(--bg); color: var(--text);" role="main">
    
    {#if sidebarVisible}
      <!-- Backdrop -->
      <div 
        class="fixed inset-0 z-30"
        style="background-color: rgba(0, 0, 0, 0.4); backdrop-filter: blur(2px);"
        role="button"
        tabindex="0"
        onclick={() => sidebarVisible = false}
        ontouchend={(e) => {sidebarVisible = false; e.stopPropagation()}}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            sidebarVisible = false;
          }
        }}
        transition:fade
        aria-label={$_('close_sidebar')}
      ></div>
      
      <div 
        in:fly={{ x: $isRTL ? 280 : -280, duration: 250, easing: cubicOut }} 
        out:fly={{ x: $isRTL ? 280 : -280, duration: 200, easing: cubicOut }}
        class="fixed top-0 {sidebarPosition}-0 h-full z-40 max-w-[85vw]"
      >
        <Sidebar />
      </div>
      
      <!-- Close button -->
      <button
        class="fixed top-3 z-50 btn-icon"
        style="{sidebarButtonPosition}: 0.75rem;"
        onclick={(e) => {e.stopPropagation(); sidebarVisible = false;}}
        ontouchstart={(e) => {e.stopPropagation();}}
        ontouchend={(e) => {e.stopPropagation(); e.preventDefault(); sidebarVisible = false;}}
        onmousedown={(e) => {e.stopPropagation();}}
        onmouseup={(e) => {e.stopPropagation(); sidebarVisible = false;}}
        aria-label={$_('close')}
        data-testid="close-sidebar-button">
        <div class="w-4 h-4" style="color: var(--text-secondary);">
          <FaTimes />
        </div>
      </button>
    {:else}
      <!-- Sidebar toggle button -->
      <button
        class="fixed top-4 z-50 btn-icon"
        style="{sidebarButtonPosition}: 1rem; background-color: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 0.5rem; box-shadow: var(--shadow-sm);"
        onclick={() => sidebarVisible = true}
        ontouchend={(e) => {sidebarVisible = true; e.stopPropagation()}}
        aria-label={$_('show_editor')}
        data-testid="menu-button">
        <div class="w-4 h-4" style="color: var(--text-secondary);">
          <FaBars />
        </div>
      </button>
      
      <!-- Sidebar trigger area -->
      <div 
        class="w-6 h-full fixed top-0 z-10 cursor-pointer"
        style="{sidebarTriggerPosition}: 0;"
        role="button"
        tabindex="0"
        onclick={() => sidebarVisible = true}
        ontouchend={(e) => {sidebarVisible = true; e.stopPropagation()}}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            sidebarVisible = true;
          }
        }}
        onmouseenter={handleMouseEnter}
        onfocus={handleMouseEnter}
        aria-label={$_('show_sidebar')}>
      </div>
    {/if}
    
    <!-- Main Content -->
    <div class="flex-1 overflow-x-hidden">
      {#if $isLoadingRemoteBlog}
        <LoadingBlog loadingState={$loadingState} />
      {:else}
        <div class="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <!-- Masthead -->
          <header class="flex items-center gap-4 mb-10">
            <div class="w-12 h-12 rounded-full overflow-hidden flex-shrink-0" style="background-color: var(--bg-tertiary);">
              {#if $profilePictureCid}
                {#await getImageUrlFromHelia($profilePictureCid, fs as any)}
                  <div class="w-full h-full flex items-center justify-center"></div>
                {:then imageUrl}
                  {#if imageUrl}
                    <img 
                      src={imageUrl}
                      alt="Profile" 
                      class="w-full h-full object-cover"
                      onload={() => {
                        info('Image loaded successfully from Helia');
                      }}
                    />
                  {:else}
                    <div class="w-full h-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" style="color: var(--text-muted);" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                      </svg>
                    </div>
                  {/if}
                {:catch error}
                  <div class="w-full h-full flex items-center justify-center" style="color: var(--danger);">
                    <span class="text-xs">Error</span>
                  </div>
                {/await}
              {:else}
                <div class="w-full h-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" style="color: var(--text-muted);" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                  </svg>
                </div>
              {/if}
            </div>
            <div>
              <h1 class="text-xl font-semibold leading-tight" style="color: var(--text);" data-testid="blog-name">
                {$blogName}
              </h1>
              <p class="text-sm leading-snug mt-0.5" style="color: var(--text-secondary);" data-testid="blog-description">
                {$blogDescription}
              </p>
              <p class="text-xs mt-0.5" style="color: var(--text-muted);">{$reactiveVersionString}</p>
            </div>
          </header>

          <div class="divider mb-8"></div>

          {#if $showDBManager && canWrite}
            <DBManager />
          {/if}
          
          {#if $showPeers}
            <ConnectedPeers />
          {/if}

          {#if $showSettings}
            <Settings on:activatePasskeyWriter={handleActivatePasskeyWriterFromSettings} />
          {/if}

          {#if !canWrite && canActivateWriterMode}
            <div class="card p-4 mb-5">
              <p class="text-sm mb-2" style="color: var(--text-secondary);">
                You can unlock writer mode for this blog with your passkey.
              </p>
              <button class="btn-primary btn-sm" onclick={activatePasskeyIdentity} disabled={isActivatingIdentity}>
                {isActivatingIdentity ? 'Authenticating…' : 'Authenticate With Passkey'}
              </button>
              {#if passkeyError}
                <p class="text-xs mt-2" style="color: var(--danger);">{passkeyError}</p>
              {/if}
            </div>
          {/if}
          
          <div class="grid gap-8">
            <PostList />
            {#if canWrite}
              <PostForm />
            {/if}
            <!-- e2e/debug hook: lets tests verify write gating without relying on UI text -->
            <span
              data-testid="can-write-debug"
              class="hidden"
              >{canWrite ? '1' : '0'}|{ownerIdentityId || ''}|{$identity?.id || ''}|{$settingsDB?.address?.toString?.() || ''}|{$postsDB?.address?.toString?.() || ''}|{$postsDBAddress || ''}</span
            >
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Fixed controls toolbar -->
  <div class="fixed-controls">
    <div class="passkey-tooltip-wrap">
      <button
        class="control-button passkey-button"
        data-testid="passkey-toolbar-button"
        class:passkey-active={identityMode === 'passkey'}
        class:passkey-available={identityMode !== 'passkey' && hasStoredPasskey}
        class:passkey-session={identityMode !== 'passkey'}
        onclick={activatePasskeyIdentity}
        disabled={isActivatingIdentity || identityMode === 'passkey'}
        aria-label={identityMode === 'passkey' ? 'Passkey identity active' : 'Session identity active'}>
        <svg data-testid="passkey-toolbar-icon" class="w-5 h-5" style="color: {identityMode === 'passkey' ? 'var(--success)' : (hasStoredPasskey ? '#2563eb' : '#d97706')};" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.5 12.5a2.5 2.5 0 114.2 1.8l-1.1 1.1h2.4l1.1-1.1h1.7v-1.7h1.7v-1.7h-1.2a2.5 2.5 0 00-4.9-.7 2.5 2.5 0 00-4 2.3z"/>
        </svg>
      </button>
      <div class="passkey-tooltip" role="status" aria-live="polite">
        <div class="passkey-tooltip-title">
          {identityMode === 'passkey' ? 'Passkey writer session active' : (hasStoredPasskey ? 'Session identity active' : 'No passkey yet')}
        </div>
        <div class="passkey-tooltip-row">
          <span class="passkey-tooltip-label">Passkey DID</span>
          <div class="marquee-track">
            <span class="marquee-content">{shortDid(passkeySignerDid)} • {shortDid(passkeySignerDid)}</span>
          </div>
        </div>
        <div class="passkey-tooltip-row">
          <span class="passkey-tooltip-label">Session DID</span>
          <div class="marquee-track">
            <span class="marquee-content">{shortDid(activeSignerDid)} • {shortDid(activeSignerDid)}</span>
          </div>
        </div>
      </div>
    </div>
    <a
      href="https://github.com/Le-Space/le-space-blog"
      target="_blank"
      rel="noopener noreferrer"
      class="control-button"
      aria-label={$_('view_source_on_github')}>
      <svg class="w-4 h-4" style="color: var(--text-secondary);" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    </a>
    <LanguageSelector />
    <ThemeToggle />
    {#if canEjectPWA}
      <button
        class="control-button eject-button"
        onclick={openEjectModal}
        title={$_('eject_pwa_title')}
        aria-label={$_('eject_pwa_title')}>
        <svg class="w-4 h-4" style="color: var(--danger);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"/>
        </svg>
      </button>
    {/if}
  </div>

{#if showEjectModal}
  <PWAEjectModal on:close={closeEjectModal} />
{/if}

<style>
  /* Scoped button overrides for this component */
  button {
    color: inherit;
    border: none;
    cursor: pointer;
  }

  button:hover {
    opacity: 0.9;
  }

  /* Sidebar padding for toggle button clearance */
  :global(.sidebar) {
    padding-top: 3rem;
  }

  /* Fixed button positioning */
  button.fixed {
    position: fixed !important;
    transform: translateZ(0);
  }

  /* Share button override */
  .share-button {
    left: auto !important;
    right: 20px !important;
  }

  /* Fixed controls toolbar */
  :global(.fixed-controls) {
    position: fixed;
    top: 1rem;
    right: 1rem;
    display: flex;
    gap: 0.25rem;
    align-items: center;
    z-index: 50;
  }

  :global(.control-button) {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background-color: transparent;
    border: none;
    border-radius: 6px;
    transition: background-color 0.15s ease;
    cursor: pointer;
  }

  :global(.control-button:hover) {
    background-color: var(--bg-hover);
  }

  :global(.eject-button) {
    background-color: transparent !important;
  }

  :global(.eject-button:hover) {
    background-color: rgba(220, 38, 38, 0.1) !important;
  }

  :global(.passkey-button) {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-subtle);
  }

  :global(.passkey-button:hover) {
    background-color: var(--bg-hover);
  }

  :global(.passkey-button.passkey-active) {
    background-color: color-mix(in srgb, var(--success) 18%, var(--bg-secondary));
    border-color: color-mix(in srgb, var(--success) 45%, var(--border-subtle));
  }

  :global(.passkey-button.passkey-available) {
    background-color: color-mix(in srgb, #3b82f6 14%, var(--bg-secondary));
    border-color: color-mix(in srgb, #3b82f6 40%, var(--border-subtle));
  }

  :global(.passkey-button.passkey-session) {
    background-color: color-mix(in srgb, #f59e0b 14%, var(--bg-secondary));
    border-color: color-mix(in srgb, #f59e0b 40%, var(--border-subtle));
  }

  :global(.passkey-tooltip-wrap) {
    position: relative;
    display: flex;
  }

  :global(.passkey-tooltip) {
    position: absolute;
    top: calc(100% + 0.45rem);
    right: 0;
    width: 21rem;
    padding: 0.6rem 0.7rem;
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    background: color-mix(in srgb, var(--bg-secondary) 92%, black 8%);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
    opacity: 0;
    visibility: hidden;
    transform: translateY(-3px);
    transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
    pointer-events: none;
    z-index: 60;
  }

  :global(.passkey-tooltip-wrap:hover .passkey-tooltip),
  :global(.passkey-tooltip-wrap:focus-within .passkey-tooltip) {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  :global(.passkey-tooltip-title) {
    color: var(--text);
    font-size: 0.72rem;
    font-weight: 650;
    margin-bottom: 0.45rem;
  }

  :global(.passkey-tooltip-row) {
    display: grid;
    grid-template-columns: 5.9rem 1fr;
    gap: 0.4rem;
    align-items: center;
    margin-top: 0.2rem;
  }

  :global(.passkey-tooltip-label) {
    color: var(--text-secondary);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  :global(.marquee-track) {
    overflow: hidden;
    white-space: nowrap;
  }

  :global(.marquee-content) {
    display: inline-block;
    min-width: 200%;
    color: var(--text-muted);
    font-size: 0.68rem;
    animation: passkeyMarquee 9s linear infinite;
  }

  @keyframes passkeyMarquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  @media (max-width: 768px) {
    :global(.fixed-controls) {
      gap: 0.125rem;
    }

    :global(.passkey-button svg) {
      width: 1.35rem;
      height: 1.35rem;
    }

    :global(.passkey-tooltip) {
      right: -2.3rem;
      width: 17rem;
    }
  }
</style>
