# Data Models — OrbitDB and TypeScript

This app does **not** use SQL or Prisma. Persistent structured data is stored in **OrbitDB document databases**; domain shapes are defined in **`src/lib/types.ts`** and used across components and `dbUtils.ts`.

## OrbitDB databases (conceptual)

| Database | Role | Typical keys / documents |
| --- | --- | --- |
| **settings** | Blog metadata and pointers | `blogName`, `blogDescription`, `postsDBAddress`, `commentsDBAddress`, `mediaDBAddress`, categories, profile picture CID, etc. |
| **posts** | Blog posts | One document per post (`Post` / `BlogPost` fields) |
| **comments** | Comments | Documents keyed by convention used in app (`Comment`) |
| **media** | Media metadata | CID, name, type, size (`Media`) |
| **remote-dbs** (subscription list) | Remote blogs to follow | Entries tracking addresses, fetch state (`RemoteDB`) |

Replication uses libp2p pubsub under OrbitDB’s sync model (see `docs/AI_AGENTS.md` for file-level detail).

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
