# OpLog Monitoring & Database Compaction Strategy

## Overview

This document explains the oplog monitoring system and database rotation strategy to maintain fast replication times in OrbitDB.

## The Problem

As a blog accumulates posts and edits, the OrbitDB oplog (operation log) grows with every database write operation. Each edit to a post creates a new oplog entry, even though only the latest version matters. This causes:

- **Slow initial sync** for new peers (must replay entire oplog)
- **High bandwidth usage** during replication
- **Longer connection times** to join the network

## The Solution: Monitoring + Rotation

### 1. Oplog Health Monitoring

The system now monitors the **Posts Database oplog size** and provides visual feedback:

**Health Indicators:**
- 🟢 **Green** (< 1,000 entries): Healthy, fast replication
- 🟡 **Yellow** (1,000 - 5,000 entries): Growing, replication slowing
- 🟠 **Orange** (5,000 - 10,000 entries): Large, compaction recommended
- 🔴 **Red** (> 10,000 entries): Critical, compaction strongly recommended

### 2. Why SettingsDB is Safe

The **SettingsDB is NOT at risk** of growing uncontrollably because:

- Only stores ~10-20 settings (blog name, description, categories, DB addresses)
- Uses **last-write-wins** semantics (no history accumulation)
- Rarely updated (only when settings change)
- Even with 100 updates per setting = only ~1,000-2,000 oplog entries

### 3. Database Rotation Strategy

When oplog becomes too large, the blog owner can:

#### Create a Fresh Posts Database:
1. Create new postsDB with date suffix (e.g., `blog-posts-2025-10-23`)
2. Copy **only latest versions** of all posts (no edit history)
3. Update settingsDB with new postsDB address
4. All peers automatically discover and switch to new DB

#### Discovery Mechanism:
- **SettingsDB address stays fixed** (never changes)
- All peers replicate settingsDB
- SettingsDB contains `postsDBAddress` field
- When owner updates this field, all connected peers see the update event
- Peers automatically open the new postsDB

#### Implementation Flow:
```
Owner                          Peers
  |                             |
  |-- Create fresh postsDB      |
  |   (copy latest versions)    |
  |                             |
  |-- Update settingsDB ------->|-- Receive update event
  |   postsDBAddress field      |
  |                             |
  |                             |-- Open new postsDB
  |                             |-- Sync quickly (small oplog)
```

## Location of Monitoring

The oplog health indicator appears in the **DBManager** component:

- Shows current oplog size
- Color-coded health status
- Replication impact message
- "Compact Database" button (when recommended)

## Monitoring Implementation

### Files:
- `src/lib/utils/oplogUtils.ts` - Utility functions
- `src/lib/components/DBManager.svelte` - UI display

### Key Functions:
- `getOplogLength(db)` - Counts oplog entries
- `analyzeOplogHealth(length)` - Determines health status
- `formatOplogLength(length)` - Formats for display

### Auto-refresh:
- Stats refresh every **30 seconds**
- Also refreshes when postsDB changes

## Future Enhancements

### Automatic Compaction Function:
```typescript
async function compactPostsDatabase() {
  // 1. Create new postsDB
  const newPostsDb = await orbitdb.open(`posts-${Date.now()}`, {...});
  
  // 2. Copy only latest versions
  const allPosts = await currentPostsDb.all();
  for (const post of allPosts) {
    await newPostsDb.put(post.value); // Only latest version
  }
  
  // 3. Update settingsDB
  await settingsDB.put({ 
    _id: 'postsDBAddress', 
    value: newPostsDb.address.toString() 
  });
  
  // 4. Archive old database (optional)
  // Keep for historical reference, but don't sync by default
}
```

### UI Improvements:
- Progress bar during compaction
- Archive management (view old database versions)
- One-click "Compact Now" button
- Schedule automatic compaction at specific thresholds

## FAQ

**Q: What happens to old posts after compaction?**  
A: The latest version of every post is copied to the new database. Edit history is lost, but all current content is preserved.

**Q: Will readers lose access during rotation?**  
A: No. They'll automatically discover and switch to the new postsDB through the settingsDB update mechanism.

**Q: Can I access old database versions?**  
A: Yes, the old database addresses remain valid. You could keep them in an "archive" list for historical reference.

**Q: How often should I compact?**  
A: Monitor the health indicator. Compact when it reaches orange/red (> 5,000 entries), or when you notice slow replication.

**Q: Does compaction affect the settingsDB?**  
A: No. Only the postsDB is rotated. SettingsDB address remains constant for discovery.

## Testing the Monitor

To test different oplog sizes:

1. Start with a fresh database (green)
2. Create/edit many posts to grow oplog
3. Watch the color indicator change
4. Note the "Compact Database" button appearing at 5K+ entries

## Benefits

✅ **Fast initial sync** - New peers only sync compact database  
✅ **Lower bandwidth** - Less data to transfer  
✅ **Better UX** - Faster page loads for readers  
✅ **Scalable** - Works for blogs with thousands of posts  
✅ **Automatic discovery** - No manual coordination needed  
✅ **Backward compatible** - Old databases still accessible  

## Considerations

⚠️ **Edit history lost** - After compaction, post edit history is not preserved  
⚠️ **Owner-only action** - Only blog owner can initiate compaction  
⚠️ **Storage doubles temporarily** - During compaction, both DBs exist  
⚠️ **Network notification delay** - Peers discover new DB after next settingsDB sync
