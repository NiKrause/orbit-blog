/**
 * Copy built @le-space/orbitdb-ui dist into node_modules after `pnpm run build`
 * in the sibling orbitdb-ui repo (file: deps are not always re-copied on every build).
 */
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, '..', 'orbitdb-ui', 'dist');
const dest = join(root, 'node_modules', '@le-space', 'orbitdb-ui', 'dist');

if (!existsSync(src)) {
  console.warn('[sync-orbitdb-ui] Skipping: no dist at', src);
  process.exit(0);
}

cpSync(src, dest, { recursive: true });
console.log('[sync-orbitdb-ui] Updated', dest);
