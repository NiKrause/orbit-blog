# Component Inventory — Svelte UI

Location: **`src/lib/components/`**. All are **Svelte 5** components unless noted.

## Shell / blog

| Component | Role |
| --- | --- |
| `LeSpaceBlog.svelte` | Main orchestrator: Helia, OrbitDB, routing, replication |
| `LoadingBlog.svelte` | Loading state |
| `Sidebar.svelte` | Navigation / sidebar |
| `BlogPost.svelte` | Single post view |
| `PostList.svelte` | Post listing |
| `PostForm.svelte` | Create/edit post |
| `ContentEditor.svelte` | Editing surface |

## Data / DB

| Component | Role |
| --- | --- |
| `DBManager.svelte` | Database / remote blog management |
| `CommentSection.svelte` | Comments on a post |

## Peers / P2P

| Component | Role |
| --- | --- |
| `ConnectedPeers.svelte` | Connection UI |
| `PeersList.svelte` | Peer list |
| `WebRTCTester.svelte` | WebRTC testing |
| `WebRTCCelebration.svelte` | WebRTC success UI |

## Media

| Component | Role |
| --- | --- |
| `MediaUploader.svelte` | Upload |
| `MediaManager.svelte` | Media management |

## Settings / account

| Component | Role |
| --- | --- |
| `Settings.svelte` | Blog settings |
| `PasswordModal.svelte` / `PostPasswordPrompt.svelte` | Password / encryption flows |
| `ThemeToggle.svelte` | Theme |

## Modals / UX

| Component | Role |
| --- | --- |
| `Modal.svelte` | Base modal |
| `ConfirmModal.svelte` | Confirm dialogs |
| `PWAEjectModal.svelte` | PWA uninstall / eject flow |
| `MarkdownHelp.svelte` | Markdown help |

## i18n

| Component | Role |
| --- | --- |
| `LanguageSelector.svelte` | Language choice |
| `LanguageStatusLED.svelte` | Language status indicator |

## Shared controls

| Component | Role |
| --- | --- |
| `MultiSelect.svelte` | Multi-select UI |

## Package exports

Public components are re-exported from **`src/lib/index.ts`** for the **library** build.

Last updated: 2026-04-02
