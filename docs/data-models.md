# Data Models — OrbitDB and TypeScript

This app does **not** use SQL or Prisma. Persistent structured data is stored in **OrbitDB document databases**; domain shapes are defined in **`src/lib/types.ts`** and used across components and `dbUtils.ts`.

## OrbitDB databases (conceptual)

| Database | Role | Typical keys / documents |
| --- | --- | --- |
| **settings** | Blog metadata and pointers | `blogName`, `blogDescription`, `postsDBAddress`, `commentsDBAddress`, `mediaDBAddress`, **`aiDBAddress`** (AI Manager jobs / config replica), categories, profile picture CID, etc. |
| **posts** | Blog posts | One document per post (`Post` / `BlogPost` fields) |
| **comments** | Comments | Documents keyed by convention used in app (`Comment`) |
| **media** | Media metadata | CID, name, type, size (`Media`) |
| **ai** | AI Manager (Epic 2+) | Jobs, manifests, and **per-model credential** rows (`credential:…` document ids). |
| **remote-dbs** (subscription list) | Remote blogs to follow | Entries tracking addresses, fetch state (`RemoteDB`) |

Replication uses libp2p pubsub under OrbitDB’s sync model (see `docs/AI_AGENTS.md` for file-level detail).

### AI credential documents (Epic 2.2–2.3)

The **ai** database is opened from Epic 2.1; **per-model credential rows, encryption, list, and delete** are implemented in `src/lib/ai/aiCredentialStore.ts` and `src/lib/ai/aiCredentialCrypto.ts`.

Each provider/model credential is stored as a document in the **ai** database with a stable `_id` (`credential:` + encoded model id). Multiple models mean multiple documents; updating one does not overwrite another. Use **`listAiCredentialModelIds`** / **`deleteAiCredential`** to enumerate or remove rows. Fields include plaintext `baseUrl` and `modelId`, while the **API key is encrypted at rest** (AES-256-GCM with a key derived from the blog identity seed via HKDF). The translation feature’s `aiApiKey` / `aiApiUrl` in `store.ts` (localStorage) are **not** used for AI Manager credentials.

## Core TypeScript interfaces

Defined in **`src/lib/types.ts`** (abbreviated):

- **`Post` / `BlogPost`:** `_id`, `title`, `content`, `category`, timestamps, `identity`, `mediaIds`, `language`, translation fields, `published`, encryption flags, optional `categories[]`.
- **`Comment`:** `_id`, `postId`, `content`, `author`, `createdAt`.
- **`Media`:** `cid`, `name`, `type`, `size`, optional `url`.
- **`RemoteDB`:** `id`, optional `name`/`address`, `postsAddress`, `commentsAddress`, `mediaAddress`, `fetchLater`, counts, optional `access` for write ACL hints.
- **`DatabaseEntry<T>` / `DatabaseUpdate`:** Generic wrappers for OrbitDB document operations.

## Helia / OrbitDB typing

`types.ts` includes **structural** interfaces for **`Helia`**, **`Libp2p`**, **`OrbitDB`**, etc., for typing without pulling full lib types everywhere. When changing lib versions, align these if compile errors appear.

## Migration note

There is **no migrations folder**. Schema evolution is **application-level**: read defensively when opening old databases and when syncing from peers.

Last updated: 2026-04-02
