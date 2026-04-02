<!-- @migration-task Error while migrating Svelte code: Cannot subscribe to stores that are not declared at the top level of the component
https://svelte.dev/e/store_invalid_scoped_subscription -->
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { _ } from 'svelte-i18n';

  import { createHelia } from 'helia';
  import { createLibp2p } from 'libp2p';
  import { createOrbitDB, Identities, useIdentityProvider } from '@orbitdb/core';
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
  import { derived, get as getStore } from 'svelte/store';
  import { locale } from 'svelte-i18n';

  import { libp2pOptions, multiaddrs } from '$lib/config.js';
  import { initHashRouter, isLoadingRemoteBlog } from '$lib/router.js';
  import { setupPeerEventListeners } from '$lib/peerConnections.js';
  import { getImageUrlFromHelia } from '$lib/utils/mediaUtils.js';
  import {
    OrbitDBWebAuthnIdentityProviderFunction,
    loadWebAuthnVarsigCredential
  } from '@le-space/orbitdb-identity-provider-webauthn-did';
  import {
    ConsentModal,
    WebAuthnSetup,
    OrbitDBFooter,
    setOnPasskeyPrompt,
    WEBAUTHN_AUTH_MODES,
    getPreferredWebAuthnMode,
    hasExistingCredentials,
    getStoredWebAuthnCredential,
    isWebAuthnAvailable,
    getOrCreateVarsigIdentity,
    createWebAuthnVarsigIdentities,
    createIpfsIdentityStorage,
    wrapWithVarsigVerification,
    authenticateWithWebAuthn
  } from '@le-space/orbitdb-ui';
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
  import { info, debug, warn, error } from '../utils/logger.js';
  import { canEject } from '../utils/pwaEject.js';

  useIdentityProvider(OrbitDBWebAuthnIdentityProviderFunction);
  setOnPasskeyPrompt((msg) => info(msg));

  const CONSENT_STORAGE_KEY = 'leSpaceBlog.consentAccepted.v1';

  /** Active Helia / OrbitDB blockstore (Level or in-memory); set during initializeApp */
  let activeBlockstore = $state<any>(undefined);
  let activeDatastore = $state<any>(undefined);

  type OnboardingPhase = 'checking' | 'consent' | 'webauthn' | 'booting' | 'ready';
  let onboardingPhase = $state<OnboardingPhase>('checking');
  let bootPreferences = $state({
    enablePersistentStorage: true,
    enableNetworkConnection: true,
    enablePeerConnections: true
  });
  let blogIdentityModeLabel = $state('—');
  let bootError = $state('');

  let identityMode = $state<'passkey'>('passkey');
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

  const shortDid = (value?: string | null) => {
    if (!value) return 'not available';
    if (value.length <= 24) return value;
    return `${value.slice(0, 12)}...${value.slice(-8)}`;
  };

  function getCurrentLocalDbEntries() {
    const globalObj = typeof window !== 'undefined' ? (window as any) : null;
    return [
      { name: 'settings', db: globalObj?.settingsDB || $settingsDB },
      { name: 'posts', db: globalObj?.postsDB || $postsDB },
      { name: 'comments', db: globalObj?.commentsDB || $commentsDB },
      { name: 'media', db: globalObj?.mediaDB || $mediaDB }
    ];
  }

  async function buildVarsigIdentitiesWithFallback(helia: any, varsigCredential: any) {
    const identity = await getOrCreateVarsigIdentity(varsigCredential);
    const identityStorage = createIpfsIdentityStorage(helia);
    const identities = createWebAuthnVarsigIdentities(identity, {}, identityStorage);
    const fallbackIdentities = wrapWithVarsigVerification(await Identities({ ipfs: helia }), helia);
    const originalVerify = identities.verify?.bind(identities);
    const originalGetIdentity = identities.getIdentity?.bind(identities);
    const originalVerifyIdentity = identities.verifyIdentity?.bind(identities);
    const unsupportedVarsigHeader = (err: unknown) =>
      String((err as Error)?.message || '')
        .toLowerCase()
        .includes('unsupported varsig header');

    identities.verify = async (signature: unknown, publicKey: unknown, data: unknown) => {
      if (originalVerify) {
        try {
          const result = await originalVerify(signature, publicKey, data);
          if (result) return true;
        } catch (e) {
          if (!unsupportedVarsigHeader(e)) {
            warn('Varsig verify failed, trying generic fallback', e);
          }
        }
      }
      try {
        return await fallbackIdentities.verify(signature, publicKey, data);
      } catch {
        return false;
      }
    };

    identities.getIdentity = async (hash: unknown) => {
      if (originalGetIdentity) {
        try {
          const resolved = await originalGetIdentity(hash);
          if (resolved) return resolved;
        } catch {
          /* fall through */
        }
      }
      return await fallbackIdentities.getIdentity(hash);
    };

    identities.verifyIdentity = async (identityToVerify: unknown) => {
      if (originalVerifyIdentity) {
        try {
          const result = await originalVerifyIdentity(identityToVerify);
          if (result) return true;
        } catch (e) {
          if (!unsupportedVarsigHeader(e)) {
            warn('Varsig verifyIdentity failed, trying generic fallback', e);
          }
        }
      }
      try {
        return await fallbackIdentities.verifyIdentity(identityToVerify);
      } catch {
        return false;
      }
    };

    (identities as any).verifyIdentityFallback = async (identityToVerify: any) => {
      if (
        identityToVerify?.type === 'webauthn' &&
        typeof OrbitDBWebAuthnIdentityProviderFunction.verifyIdentity === 'function'
      ) {
        const verified =
          await OrbitDBWebAuthnIdentityProviderFunction.verifyIdentity(identityToVerify);
        if (verified) return true;
      }
      return await fallbackIdentities.verifyIdentity(identityToVerify);
    };

    return { identity, identities };
  }

  async function swapToWriterIdentity(
    writerIdentity: any,
    writerIdentities: any,
    sessionPasskeyDid: string
  ) {
    const heliaSnap = getStore(helia);
    const storage = activeBlockstore ?? (heliaSnap as any)?.blockstore;

    const previousOrbitdb = getStore(orbitdb);
    const previousDbs = {
      settings: getStore(settingsDB),
      posts: getStore(postsDB),
      comments: getStore(commentsDB),
      media: getStore(mediaDB),
      remote: getStore(remoteDBsDatabases)
    };

    const settingsAddr = previousDbs.settings?.address?.toString?.();
    const postsAddr = previousDbs.posts?.address?.toString?.();
    const commentsAddr = previousDbs.comments?.address?.toString?.();
    const mediaAddr = previousDbs.media?.address?.toString?.();
    const remoteAddr = previousDbs.remote?.address?.toString?.();

    try { await previousDbs.settings?.close?.(); } catch {}
    try { await previousDbs.posts?.close?.(); } catch {}
    try { await previousDbs.comments?.close?.(); } catch {}
    try { await previousDbs.media?.close?.(); } catch {}
    try { await previousDbs.remote?.close?.(); } catch {}
    try { await previousOrbitdb?.stop?.(); } catch {}

    await new Promise((resolve) => setTimeout(resolve, 50));

    const newOrbitdb = await createOrbitDB({
      ipfs: heliaSnap,
      identity: writerIdentity,
      identities: writerIdentities as any,
      storage,
      directory: './orbitdb'
    });

    const newSettings = await newOrbitdb.open(settingsAddr || 'settings', {
      type: 'documents',
      create: true,
      overwrite: false,
      directory: './orbitdb/settings',
      identity: writerIdentity,
      identities: writerIdentities as any,
      AccessController: OrbitDBAccessController({ write: [writerIdentity.id] })
    });
    const newPosts = await newOrbitdb.open(postsAddr || 'posts', {
      type: 'documents',
      create: true,
      overwrite: false,
      directory: './orbitdb/posts',
      identity: writerIdentity,
      identities: writerIdentities as any,
      AccessController: OrbitDBAccessController({ write: [writerIdentity.id] })
    });
    const newComments = await newOrbitdb.open(commentsAddr || 'comments', {
      type: 'documents',
      create: true,
      overwrite: false,
      directory: './orbitdb/comments',
      identity: writerIdentity,
      identities: writerIdentities as any,
      AccessController: OrbitDBAccessController({ write: ['*'] })
    });
    const newMedia = await newOrbitdb.open(mediaAddr || 'media', {
      type: 'documents',
      create: true,
      overwrite: false,
      directory: './orbitdb/media',
      identity: writerIdentity,
      identities: writerIdentities as any,
      AccessController: OrbitDBAccessController({ write: [writerIdentity.id] })
    });
    const newRemoteDbs = await newOrbitdb.open(remoteAddr || 'remote-dbs', {
      type: 'documents',
      create: true,
      overwrite: false,
      identity: writerIdentity,
      identities: writerIdentities as any,
      AccessController: OrbitDBAccessController({ write: [writerIdentity.id] })
    });

    const prevPostsAddr = getStore(postsDBAddress);
    const prevCommentsAddr = getStore(commentsDBAddress);
    const prevMediaAddr = getStore(mediaDBAddress);

    orbitdb.set(newOrbitdb as any);
    identities.set(writerIdentities as any);
    identity.set(writerIdentity as any);
    settingsDB.set(newSettings as any);
    postsDB.set(newPosts as any);
    commentsDB.set(newComments as any);
    mediaDB.set(newMedia as any);
    remoteDBsDatabases.set(newRemoteDbs as any);
    postsDBAddress.set(newPosts.address?.toString?.() || prevPostsAddr);
    commentsDBAddress.set(newComments.address?.toString?.() || prevCommentsAddr);
    mediaDBAddress.set(newMedia.address?.toString?.() || prevMediaAddr);

    (window as any).settingsDB = newSettings;
    (window as any).postsDB = newPosts;
    (window as any).commentsDB = newComments;
    (window as any).mediaDB = newMedia;
    (window as any).remoteDBsDatabases = newRemoteDbs;

    sessionStorage.setItem('activeIdentityDid', writerIdentity.id);
    sessionStorage.setItem('activeIdentityType', writerIdentity.type || 'webauthn-varsig');
    sessionStorage.setItem('passkeyIdentityDid', sessionPasskeyDid);
    identityMode = 'passkey';
  }

  async function mutateLocalAclAsPasskeyAdmin(kind: 'grant' | 'revoke', didValue: string) {
    if (!$identity?.id || identityMode !== 'passkey') {
      throw new Error('ACL mutation requires active passkey writer identity.');
    }
    if ($identity.type === 'webauthn-varsig') {
      const credential = loadWebAuthnVarsigCredential();
      if (!credential?.did || credential.did !== $identity.id) {
        throw new Error('Active identity does not match the local passkey DID.');
      }
    } else if ($identity.type === 'webauthn') {
      const w = getStoredWebAuthnCredential('worker');
      const did = (w?.credentialInfo as { did?: string })?.did;
      if (!did || did !== $identity.id) {
        throw new Error('Active identity does not match the local worker passkey DID.');
      }
    } else {
      throw new Error('ACL mutation requires a WebAuthn writer identity (worker or varsig).');
    }

    const mutateEntries = async (entries: Array<{ name: string; db: any }>) => {
      const results: Array<{ name: string; address: string; status: string; error?: string }> = [];
      for (const { name, db } of entries) {
        const address = db?.address?.toString?.();
        if (!address) {
          results.push({ name, address: 'missing-address', status: 'skipped' });
          continue;
        }
        try {
          const actionFn = db?.access?.[kind];
          if (typeof actionFn !== 'function') {
            results.push({ name, address, status: 'unsupported-access-controller' });
            continue;
          }
          const writeSet =
            typeof db?.access?.get === 'function'
              ? await db.access.get('write')
              : new Set(Array.isArray(db?.access?.write) ? db.access.write : []);
          const writeList = Array.from(writeSet || []);
          if (kind === 'grant' && writeList.includes(didValue)) {
            results.push({ name, address, status: 'already-present' });
            continue;
          }
          if (kind === 'revoke' && !writeList.includes(didValue)) {
            results.push({ name, address, status: 'already-absent' });
            continue;
          }
          await actionFn.call(db.access, 'write', didValue);
          results.push({ name, address, status: 'ok' });
        } catch (err: any) {
          results.push({ name, address, status: 'error', error: err?.message || String(err) });
        }
      }
      return results;
    };

    const primaryEntries = getCurrentLocalDbEntries();
    const primaryResults = await mutateEntries(primaryEntries);
    const primaryError = primaryResults.find((r) => r.status === 'error') || null;
    if (!primaryError) {
      console.log('[LeSpaceBlog] ACL mutation result (passkey direct)', {
        kind,
        didValue,
        activeDid: $identity?.id,
        ownerIdentityId,
        results: primaryResults
      });
      return {
        kind,
        targetDid: didValue,
        activeDid: $identity?.id,
        method: 'passkey-direct',
        results: primaryResults
      };
    }

    throw new Error(`ACL ${kind} failed on ${primaryError.name}: ${primaryError.error || 'unknown error'}`);
  }

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
      const heliaLive = getStore(helia);
      if (!heliaLive) throw new Error('IPFS/Helia is not ready yet.');

      const preferred = getPreferredWebAuthnMode();
      const auth = await authenticateWithWebAuthn({ mode: preferred });

      let writerIdentity: any;
      let writerIdentities: any;
      let passkeyDidForSession: string;

      if (auth.authMode === 'varsig') {
        const built = await buildVarsigIdentitiesWithFallback(heliaLive, auth.credentialInfo);
        writerIdentity = built.identity;
        writerIdentities = built.identities;
        passkeyDidForSession =
          (auth.credentialInfo as { did?: string })?.did || writerIdentity.id;
        blogIdentityModeLabel = `hardware (${
          (auth.credentialInfo as { algorithm?: string })?.algorithm?.toLowerCase() === 'p-256'
            ? 'p-256'
            : 'ed25519'
        })`;
      } else {
        const identities = wrapWithVarsigVerification(
          await Identities({ ipfs: heliaLive }),
          heliaLive
        );
        writerIdentity = await identities.createIdentity({
          id: 'le-space-blog',
          provider: OrbitDBWebAuthnIdentityProviderFunction({
            webauthnCredential: auth.credentialInfo,
            keystore: identities.keystore,
            useKeystoreDID: true,
            encryptKeystore: true,
            keystoreKeyType: 'Ed25519',
            keystoreEncryptionMethod: 'prf'
          })
        });
        writerIdentities = identities;
        passkeyDidForSession =
          (auth.credentialInfo as { did?: string })?.did || writerIdentity.id;
        blogIdentityModeLabel = 'worker (ed25519)';
      }

      if (ownerIdentityId && passkeyDidForSession !== ownerIdentityId) {
        throw new Error('Stored passkey DID does not match current blog owner DID.');
      }

      await swapToWriterIdentity(writerIdentity, writerIdentities, passkeyDidForSession);
      console.log('[LeSpaceBlog] activation success, switched to passkey writer mode in-place');
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

  async function initializeApp(
    preferences: Partial<typeof bootPreferences> = {}
  ) {
    const prefs = { ...bootPreferences, ...preferences };
    bootPreferences = prefs;
    info('initializeApp', prefs);

    let heliaConfig: Record<string, unknown> = {};
    let actuallyPersistent = prefs.enablePersistentStorage;

    const _libp2p = await createLibp2p({ ...libp2pOptions });
    libp2p.set(_libp2p);
    (window as any).libp2p = _libp2p;

    if (actuallyPersistent) {
      try {
        activeBlockstore = new LevelBlockstore('./helia-blocks');
        activeDatastore = new LevelDatastore('./helia-data');
        heliaConfig = {
          libp2p: _libp2p,
          blockstore: activeBlockstore,
          datastore: activeDatastore
        };
      } catch (e) {
        warn('LevelDB init failed, using in-memory Helia storage', e);
        actuallyPersistent = false;
        activeBlockstore = undefined;
        activeDatastore = undefined;
        heliaConfig = { libp2p: _libp2p };
      }
    } else {
      activeBlockstore = undefined;
      activeDatastore = undefined;
      heliaConfig = { libp2p: _libp2p };
    }

    const heliaApi = (await createHelia(heliaConfig as any)) as any;
    helia.set(heliaApi);

    if (!actuallyPersistent) {
      activeBlockstore = (heliaApi as any).blockstore;
    }

    const orbitStorage = activeBlockstore ?? (heliaApi as any).blockstore;

    const configuredWebAuthnMode = getPreferredWebAuthnMode();
    let storedWebAuthn: ReturnType<typeof getStoredWebAuthnCredential> = null;
    if (isWebAuthnAvailable()) {
      try {
        storedWebAuthn = getStoredWebAuthnCredential(configuredWebAuthnMode);
      } catch (e) {
        warn('Failed to load stored WebAuthn credential', e);
      }
    }

    let orbitdbCreated = false;

    if (
      storedWebAuthn?.authMode === WEBAUTHN_AUTH_MODES.HARDWARE &&
      storedWebAuthn.credentialInfo
    ) {
      const { identity: varsigIdentity, identities: varsigIdentities } =
        await buildVarsigIdentitiesWithFallback(heliaApi, storedWebAuthn.credentialInfo);
      identities.set(varsigIdentities as any);
      identity.set(varsigIdentity as any);
      const cred = storedWebAuthn.credentialInfo as { did?: string; algorithm?: string };
      blogIdentityModeLabel = `hardware (${
        cred?.algorithm?.toLowerCase() === 'p-256' ? 'p-256' : 'ed25519'
      })`;
      orbitdb.set(
        await createOrbitDB({
          ipfs: heliaApi,
          identities: varsigIdentities,
          identity: varsigIdentity,
          storage: orbitStorage,
          directory: './orbitdb'
        })
      );
      orbitdbCreated = true;
    }

    if (
      !orbitdbCreated &&
      storedWebAuthn?.authMode === WEBAUTHN_AUTH_MODES.WORKER &&
      storedWebAuthn.credentialInfo
    ) {
      const wrappedIdentities = wrapWithVarsigVerification(
        await Identities({ ipfs: heliaApi }),
        heliaApi
      );
      const workerIdentity = await wrappedIdentities.createIdentity({
        id: 'le-space-blog',
        provider: OrbitDBWebAuthnIdentityProviderFunction({
          webauthnCredential: storedWebAuthn.credentialInfo,
          keystore: wrappedIdentities.keystore,
          useKeystoreDID: true,
          encryptKeystore: true,
          keystoreKeyType: 'Ed25519',
          keystoreEncryptionMethod: 'prf'
        })
      });
      identities.set(wrappedIdentities as any);
      identity.set(workerIdentity as any);
      blogIdentityModeLabel = 'worker (ed25519)';
      orbitdb.set(
        await createOrbitDB({
          ipfs: heliaApi,
          identities: wrappedIdentities,
          identity: workerIdentity,
          storage: orbitStorage,
          directory: './orbitdb'
        })
      );
      orbitdbCreated = true;
    }

    if (!orbitdbCreated) {
      throw new Error(
        'No usable WebAuthn identity found. Complete passkey setup or clear site data and try again.'
      );
    }

    if (typeof window !== 'undefined') {
      const idSnap = getStore(identity);
      if (idSnap?.id) {
        sessionStorage.setItem('activeIdentityDid', idSnap.id);
        sessionStorage.setItem('activeIdentityType', idSnap.type || '');
        const passDid =
          (storedWebAuthn?.credentialInfo as { did?: string })?.did || idSnap.id;
        sessionStorage.setItem('passkeyIdentityDid', passDid);
      }
    }

    setupPeerEventListeners(_libp2p, {
      enablePeerConnections: prefs.enablePeerConnections
    });

    const heliaSnap = getStore(helia);
    if (heliaSnap) {
      fs = unixfs(heliaSnap as any);
      info('UnixFS initialized');
    }

    routerUnsubscribe = await initHashRouter();
    const initialAddressValue = getStore(initialAddress);
    if (!initialAddressValue) {
      await createDefaultDatabases();
    }
  }

  async function runBootstrap(prefs?: Partial<typeof bootPreferences>) {
    bootError = '';
    onboardingPhase = 'booting';
    try {
      await initializeApp(prefs ?? {});
      onboardingPhase = 'ready';
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      bootError = msg;
      error('Bootstrap failed', e);
      onboardingPhase = 'consent';
    }
  }

  function handleConsentProceed(
    e: CustomEvent<{
      enablePersistentStorage: boolean;
      enableNetworkConnection: boolean;
      enablePeerConnections: boolean;
      rememberDecision: boolean;
    }>
  ) {
    const d = e.detail;
    bootPreferences = {
      enablePersistentStorage: d.enablePersistentStorage,
      enableNetworkConnection: d.enableNetworkConnection,
      enablePeerConnections: d.enablePeerConnections
    };
    if (d.rememberDecision) {
      try {
        localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
      } catch {
        /* ignore */
      }
    }
    if (!hasExistingCredentials()) {
      onboardingPhase = 'webauthn';
      return;
    }
    void runBootstrap(bootPreferences);
  }

  function handleWebAuthnCreated() {
    void runBootstrap(bootPreferences);
  }

  onMount(() => {
    if (typeof window === 'undefined') return;

    if ((window as any).__PLAYWRIGHT__) {
      try {
        localStorage.setItem(CONSENT_STORAGE_KEY, 'true');
      } catch {
        /* ignore */
      }
    }

    try {
      const remembered = localStorage.getItem(CONSENT_STORAGE_KEY) === 'true';
      if (!remembered) {
        onboardingPhase = 'consent';
        return;
      }
      if (!hasExistingCredentials()) {
        onboardingPhase = 'webauthn';
        return;
      }
      void runBootstrap();
    } catch {
      onboardingPhase = 'consent';
    }
  });

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

    // Ensure local owner identity has explicit write permission on owner-managed DBs.
    try {
      const ensureWriteGrant = async (db: any) => {
        if (!db || !$identity?.id || typeof db?.access?.grant !== 'function') return;
        const writeSet =
          typeof db?.access?.get === 'function'
            ? await db.access.get('write')
            : new Set(Array.isArray(db?.access?.write) ? db.access.write : []);
        const writeList = Array.from(writeSet || []);
        if (!writeList.includes('*') && !writeList.includes($identity.id)) {
          await db.access.grant('write', $identity.id);
        }
      };
      await ensureWriteGrant($settingsDB);
      await ensureWriteGrant($postsDB);
      await ensureWriteGrant($mediaDB);
      await ensureWriteGrant($remoteDBsDatabases);
    } catch (err) {
      warn('Failed to ensure owner write grants on local DBs:', err);
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
    hasStoredPasskey = hasExistingCredentials();
    const varsig = loadWebAuthnVarsigCredential();
    const worker = getStoredWebAuthnCredential('worker');
    const passkeyDid =
      varsig?.did ?? (worker?.credentialInfo as { did?: string })?.did ?? null;
    canActivateWriterMode = Boolean(
      ownerIdentityId && passkeyDid && passkeyDid === ownerIdentityId && !canWrite
    );
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    const credential = loadWebAuthnVarsigCredential();
    const worker = getStoredWebAuthnCredential('worker');
    activeSignerDid = $identity?.id || sessionStorage.getItem('activeIdentityDid') || 'not available';
    passkeySignerDid =
      sessionStorage.getItem('passkeyIdentityDid') ||
      credential?.did ||
      (worker?.credentialInfo as { did?: string })?.did ||
      'not available';
  });

  $effect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__leSpaceAclAdmin = {
      grantWriteDid: (didValue: string) => mutateLocalAclAsPasskeyAdmin('grant', didValue),
      revokeWriteDid: (didValue: string) => mutateLocalAclAsPasskeyAdmin('revoke', didValue)
    };
    return () => {
      try {
        delete (window as any).__leSpaceAclAdmin;
      } catch {}
    };
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
    let cancelled = false;
    (async () => {
      if (!$orbitdb || !$postsDB || !$identity) return;
      const postsAddr = $postsDB.address?.toString?.() || String($postsDB.address || '');
      const access = $postsDB?.access as { get?: (cap: string) => Promise<Set<unknown>>; write?: string[] };
      const writeSet =
        typeof access?.get === 'function'
          ? await access.get('write')
          : new Set(Array.isArray(access?.write) ? access.write : []);
      const writeAccess = Array.from(writeSet || []);
      const hasMatchingAddress =
        !$postsDBAddress ||
        postsAddr === $postsDBAddress ||
        $postsDBAddress === $postsDB?.address?.toString?.();
      const nextCanWrite = Boolean(
        (writeAccess.includes($identity.id) || writeAccess.includes('*')) && hasMatchingAddress
      );
      if (!cancelled) canWrite = nextCanWrite;
    })().catch((err) => {
      warn('Failed to compute canWrite from posts ACL:', err);
      if (!cancelled) canWrite = false;
    });
    return () => {
      cancelled = true;
    };
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

  const footerPeerId = $derived($libp2p?.peerId?.toString?.() ?? '');
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

{#if onboardingPhase === 'checking' || onboardingPhase === 'booting'}
  <LoadingBlog
    message={onboardingPhase === 'checking'
      ? 'Checking privacy and passkey setup…'
      : 'Starting blog…'}
    loadingState={{ step: 'initializing', detail: bootError || '', progress: 0 }}
  />
{/if}

{#if onboardingPhase === 'consent'}
  {#if bootError}
    <div
      class="fixed top-4 left-1/2 z-[60] max-w-lg -translate-x-1/2 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 shadow-md dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      role="alert"
    >
      {bootError}
    </div>
  {/if}
  <ConsentModal
    show={true}
    appName={$blogName}
    versionString={getLocaleVersionString()}
    onproceed={handleConsentProceed}
  />
{/if}

{#if onboardingPhase === 'webauthn'}
  <WebAuthnSetup
    show={true}
    optional={false}
    modeConfig="choice"
    defaultMode="worker"
    appName={$blogName}
    oncreated={handleWebAuthnCreated}
  />
{/if}

{#if onboardingPhase === 'ready'}
  <div
    class="flex min-h-screen pb-16 transition-colors"
    style="background-color: var(--bg); color: var(--text);"
    role="main"
  >
    
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
            <Settings
              on:activatePasskeyWriter={handleActivatePasskeyWriterFromSettings}
              aclAdminMutate={mutateLocalAclAsPasskeyAdmin}
            />
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
  <div class="fixed-controls z-[45]">
    <div class="passkey-tooltip-wrap">
      <button
        class="control-button passkey-button"
        data-testid="passkey-toolbar-button"
        class:passkey-active={hasStoredPasskey}
        class:passkey-available={!hasStoredPasskey}
        onclick={activatePasskeyIdentity}
        disabled={isActivatingIdentity}
        aria-label={hasStoredPasskey ? 'Passkey identity active' : 'No passkey credential yet'}>
        <svg data-testid="passkey-toolbar-icon" class="w-5 h-5" style="color: {hasStoredPasskey ? 'var(--success)' : '#d97706'};" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.5 12.5a2.5 2.5 0 114.2 1.8l-1.1 1.1h2.4l1.1-1.1h1.7v-1.7h1.7v-1.7h-1.2a2.5 2.5 0 00-4.9-.7 2.5 2.5 0 00-4 2.3z"/>
        </svg>
      </button>
      <div class="passkey-tooltip" role="status" aria-live="polite">
        <div class="passkey-tooltip-title">
          {hasStoredPasskey ? 'Passkey identity active' : 'No passkey yet'}
        </div>
        <div class="passkey-tooltip-row">
          <span class="passkey-tooltip-label">Passkey DID</span>
          <div class="marquee-track">
            <span class="marquee-content">{shortDid(passkeySignerDid)} • {shortDid(passkeySignerDid)}</span>
          </div>
        </div>
        <div class="passkey-tooltip-row">
          <span class="passkey-tooltip-label">Active DID</span>
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
{/if}

{#if onboardingPhase === 'ready' && $libp2p && $identity}
  <OrbitDBFooter
    libp2p={$libp2p}
    peerId={footerPeerId}
    identityId={$identity?.id}
    identityModeLabel={blogIdentityModeLabel}
    showDelegatedAuth={false}
    onNotify={(msg, variant) => {
      if (variant === 'error') error(msg);
      else info(msg);
    }}
  />
{/if}

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
