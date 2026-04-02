# @le-space/orbitdb-ui Implementation Plan

Shared OrbitDB UI components for ConsentModal, WebAuthnSetup, and identity utilities. Used by simple-todo and bolt-orbitdb-blog.

## Package Version Requirements

- **@le-space/orbitdb-identity-provider-webauthn-did**: `^0.2.10` (latest as of Mar 2026)
- **Svelte**: `^5.0.0` (both consuming apps use Svelte 5)

---

## 1. Package Structure

```
@le-space/orbitdb-ui/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── index.ts                    # Main exports
│   ├── components/
│   │   ├── ConsentModal.svelte     # Storage/Network/Peer toggles + Accept
│   │   └── WebAuthnSetup.svelte   # WebAuthn identity setup modal
│   ├── identity/
│   │   ├── webauthn-identity.ts   # createWebAuthnIdentity, useExisting, etc.
│   │   └── varsig-identity.ts     # getOrCreateVarsigIdentity, caching
│   └── styles/
│       └── index.css               # Optional shared styles
├── dist/                            # Built output
└── README.md
```

---

## 2. ConsentModal Component

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `show` | `boolean` | `true` | Whether modal is visible |
| `enablePersistentStorage` | `boolean` | `true` | Storage toggle initial state |
| `enableNetworkConnection` | `boolean` | `true` | Network toggle initial state |
| `enablePeerConnections` | `boolean` | `true` | P2P peer toggle initial state |
| `proceedButtonText` | `string` | `'Accept & Continue'` | Primary button label |
| `rememberLabel` | `string` | `"Don't show this again"` | Remember checkbox label |
| `appName` | `string` | `''` | App name for logo alt text |
| `logoUrl` | `string` | `''` | Optional logo image URL |
| `versionString` | `string` | `''` | Version/build info (e.g. `v0.4.12 [dev]`) |
| `showWebAuthnBadge` | `boolean` | `true` | Show HW Auth badge when available |

### Events

- `proceed` – `{ enablePersistentStorage, enableNetworkConnection, enablePeerConnections }`

### WebAuthn Check

ConsentModal needs `isWebAuthnAvailable` and `isPlatformAuthenticatorAvailable`. These will be exported from the package's `webauthn-identity` module (thin wrappers around `@le-space/orbitdb-identity-provider-webauthn-did`).

### Migration from simple-todo

- Remove `$lib/identity/webauthn-identity.js` import; use package export
- Replace local ConsentModal with package component
- Pass `versionString` from `__APP_VERSION__` / `__BUILD_DATE__` if available

---

## 3. WebAuthnSetup Component

### Mode Configuration Prop

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modeConfig` | `'choice' \| 'worker' \| 'varsig'` | `'choice'` | **choice**: show radio for worker vs varsig. **worker**: ed25519 keystore only. **varsig**: p-256 hardware varsig only. |
| `defaultMode` | `'worker' \| 'varsig'` | `'worker'` | When `modeConfig='choice'`, which mode is pre-selected. Also used when modeConfig is fixed. |
| `optional` | `boolean` | `true` | Show "Skip for Now" button |
| `appName` | `string` | `'App'` | Passkey display name (e.g. "Simple Todo", "Le Space Blog") |
| `show` | `boolean` | `true` | Modal visibility |

### Mode Mapping

- **worker** = Ed25519 keystore (WebAuthnDIDProvider, PRF-encrypted keystore)
- **varsig** = P-256 hardware varsig (WebAuthnVarsigProvider, sign per write)

### Events

- `created` – `{ identity?, credentialInfo, type, authMode, recoveredFrom? }`
- `skip` – when user skips (only when `optional=true`)

### Behavior by modeConfig

| modeConfig | UI | Allowed modes |
|------------|-----|---------------|
| `choice` | Radio: Worker (ed25519) / Hardware (varsig) | Both |
| `worker` | No mode selector; fixed worker | worker only |
| `varsig` | No mode selector; fixed varsig | varsig only |

### Orbit-blog Default

- `modeConfig: 'choice'`
- `defaultMode: 'worker'` (same as simple-todo)
- `optional: false` for blog (passkey required for writer mode)

### simple-todo Default

- `modeConfig: 'choice'`
- `defaultMode: 'worker'`
- `optional: true`

---

## 4. webauthn-identity Module (Package Export)

Export from `@le-space/orbitdb-ui`:

```ts
// Core API
export async function createWebAuthnIdentity(userName: string, options?: { mode?: 'worker' | 'varsig' }): Promise<...>
export async function useExistingWebAuthnCredential(options?: { mode?: 'worker' | 'varsig' }): Promise<...>
export async function authenticateWithWebAuthn(options?: { mode?: 'worker' | 'varsig' }): Promise<...>

// Capabilities & state
export function isWebAuthnAvailable(): boolean
export async function isPlatformAuthenticatorAvailable(): Promise<boolean>
export function getPreferredWebAuthnMode(): 'worker' | 'varsig'
export function setPreferredWebAuthnMode(mode: 'worker' | 'varsig'): void
export function hasExistingCredentials(): boolean
export function getStoredCredentialInfo(): {...} | null
export function getStoredCredentialInfos(): Array<...>
export function getStoredWebAuthnCredential(mode?: 'worker' | 'varsig'): {...} | null
export async function getWebAuthnCapabilities(): Promise<...>

// Cleanup
export function clearWebAuthnCredentials(mode?: 'worker' | 'varsig' | null): void

// Constants
export const WEBAUTHN_AUTH_MODES = { WORKER: 'worker', HARDWARE: 'varsig' }
```

Note: Use `varsig` as the canonical name for hardware mode in the public API (alias for `hardware`).

---

## 5. varsig-identity Module (Package Export)

Export from `@le-space/orbitdb-ui`:

```ts
export function loadCachedVarsigIdentity(): Identity | null
export function storeCachedVarsigIdentity(identity: Identity): void
export function clearCachedVarsigIdentity(): void
export async function getOrCreateVarsigIdentity(credential: VarsigCredential): Promise<Identity>

// Re-exports from @le-space/orbitdb-identity-provider-webauthn-did
export { verifyVarsigIdentity, createIpfsIdentityStorage, createWebAuthnVarsigIdentities, wrapWithVarsigVerification }
```

The varsig module depends on `showToast`-style feedback. Accept an optional `onPasskeyPrompt` callback to avoid hard dependency on a toast library.

---

## 6. Package Exports (package.json)

```json
{
  "name": "@le-space/orbitdb-ui",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "svelte": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "svelte": "./dist/index.js",
      "import": "./dist/index.js"
    },
    "./identity": {
      "types": "./dist/identity/index.d.ts",
      "import": "./dist/identity/index.js"
    }
  },
  "peerDependencies": {
    "svelte": "^5.0.0",
    "@le-space/orbitdb-identity-provider-webauthn-did": "^0.2.10"
  },
  "devDependencies": {
    "svelte": "^5.0.0",
    "vite": "^5.0.0",
    "typescript": "^5.0.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0"
  }
}
```

---

## 7. Implementation Phases

### Phase 1: Package Scaffold (Day 1)

1. Create repo `orbitdb-ui` (or `le-space-orbitdb-ui`)
2. Initialize package.json, tsconfig, vite.config
3. Set up Svelte 5 + Vite library build
4. Add `@le-space/orbitdb-identity-provider-webauthn-did@^0.2.10` as peer dep

### Phase 2: Identity Modules (Day 2)

1. Port `webauthn-identity.js` → `src/identity/webauthn-identity.ts`
   - Replace `./varsig-identity.js` with local `./varsig-identity`
   - Use `varsig` as alias for `hardware` in exports
2. Port `varsig-identity.js` → `src/identity/varsig-identity.ts`
   - Add optional `onPasskeyPrompt?: (message: string) => void` to avoid toast coupling
   - Default: `console.log` or no-op

### Phase 3: ConsentModal (Day 3)

1. Port `ConsentModal.svelte` from simple-todo
2. Replace webauthn imports with package identity module
3. Add props: `appName`, `logoUrl`, `versionString`, `showWebAuthnBadge`
4. Ensure Svelte 5 runes compatibility (`$state`, `$effect` if needed)

### Phase 4: WebAuthnSetup (Day 4)

1. Port `WebAuthnSetup.svelte` from simple-todo
2. Add `modeConfig`: `'choice' | 'worker' | 'varsig'`
3. Add `defaultMode`: `'worker' | 'varsig'`
4. When `modeConfig='worker'`: hide mode radio, use worker only
5. When `modeConfig='varsig'`: hide mode radio, use varsig only
6. When `modeConfig='choice'`: show both options, default to `defaultMode`
7. Update labels: "Worker mode: Ed25519 keystore" / "Hardware mode: varsig (p-256)"

### Phase 5: simple-todo Integration (Day 5)

1. Add `@le-space/orbitdb-ui` dependency (or `file:../orbitdb-ui` for local dev)
2. Replace `ConsentModal` import with package
3. Replace `WebAuthnSetup` import with package
4. Replace `$lib/identity/webauthn-identity.js` with package `identity` export
5. Replace `$lib/identity/varsig-identity.js` with package `identity` export
6. Update `p2p.js` to use package identity exports
7. Run e2e tests (webauthn.spec.js, simple-todo.spec.js)

### Phase 6: bolt-orbitdb-blog Integration (Day 6)

1. Add `@le-space/orbitdb-ui` dependency
2. Bump `@le-space/orbitdb-identity-provider-webauthn-did` to `^0.2.10`
3. Add ConsentModal to blog startup flow (before/after Helia init)
   - Storage/Network/Peer toggles – wire to libp2p/blockstore preferences if applicable
   - Or use as informational only initially
4. Replace inline WebAuthn creation in `LeSpaceBlog.svelte` with WebAuthnSetup modal
   - `modeConfig: 'choice'`, `defaultMode: 'worker'`, `optional: false`
   - On `created`: use identity for OrbitDB
   - On mount: if no credential, show WebAuthnSetup; else create identity as today
5. Port varsig usage from `LeSpaceBlog.svelte` to use package `getOrCreateVarsigIdentity`
6. Update Settings.svelte to use package `loadWebAuthnVarsigCredential`, `clearWebAuthnVarsigCredential`
7. Run e2e tests (BlogSharing.spec.ts, WriterModePasskey.spec.ts)

### Phase 7: Polish & Publish (Day 7)

1. Add README with usage examples
2. Add CHANGELOG
3. Publish to npm (or private registry)
4. Update both apps to use published version

---

## Implementation Status (Mar 2026)

**Package created at:** `/Users/nandi/Documents/projekte/DecentraSol/orbitdb-ui`

- [x] Package scaffold (package.json, vite.config, tsconfig, svelte.config)
- [x] `webauthn-identity.ts` – full port with worker + varsig
- [x] `varsig-identity.ts` – getOrCreateVarsigIdentity, caching, setOnPasskeyPrompt
- [x] `ConsentModal.svelte` – Storage/Network/Peer toggles, WebAuthn badge
- [x] `WebAuthnSetup.svelte` – modeConfig: choice | worker | varsig, defaultMode
- [x] Main index.ts exports
- [ ] `pnpm install` and `pnpm run build` (run locally)
- [x] simple-todo integration (ConsentModal, WebAuthnSetup, identity imports)
- [x] bolt-orbitdb-blog integration (package added, webauthn-did ^0.2.10, setOnPasskeyPrompt)

**Local dev:** Use `"@le-space/orbitdb-ui": "file:../orbitdb-ui"` in consuming apps until published.

---

## 8. Open Questions

1. **ConsentModal in blog**: Does the blog need storage/network toggles, or is it always persistent + networked? If not needed, we can still include the component and the blog can hide it or use a minimal variant.
2. **i18n**: ConsentModal and WebAuthnSetup use hardcoded English. Add optional `labels` prop object for future i18n?
3. **Toast in varsig-identity**: simple-todo uses `showToast`. Package will use optional callback. Confirm callback signature: `(message: string, type?: string, duration?: number) => void`?

---

## 9. File Checklist

### New Package Files

- [ ] `package.json`
- [ ] `tsconfig.json`
- [ ] `vite.config.ts`
- [ ] `src/index.ts`
- [ ] `src/identity/webauthn-identity.ts`
- [ ] `src/identity/varsig-identity.ts`
- [ ] `src/identity/index.ts`
- [ ] `src/components/ConsentModal.svelte`
- [ ] `src/components/WebAuthnSetup.svelte`
- [ ] `README.md`

### simple-todo Changes

- [ ] `package.json` – add `@le-space/orbitdb-ui`
- [ ] `src/routes/+page.svelte` – use package ConsentModal, WebAuthnSetup
- [ ] `src/lib/p2p.js` – use package identity exports
- [ ] Remove or deprecate `src/lib/components/ui/ConsentModal.svelte`
- [ ] Remove or deprecate `src/lib/components/identity/WebAuthnSetup.svelte`
- [ ] Remove or deprecate `src/lib/identity/webauthn-identity.js`
- [ ] Remove or deprecate `src/lib/identity/varsig-identity.js`
- [ ] Update all imports from webauthn-identity / varsig-identity

### bolt-orbitdb-blog Changes

- [ ] `package.json` – add `@le-space/orbitdb-ui`, bump webauthn-did to ^0.2.10
- [ ] `src/lib/components/LeSpaceBlog.svelte` – use WebAuthnSetup, package identity
- [ ] `src/lib/components/Settings.svelte` – use package exports
- [ ] Add ConsentModal to app flow (if desired)
- [ ] Update PostForm, other consumers of webauthn/varsig
