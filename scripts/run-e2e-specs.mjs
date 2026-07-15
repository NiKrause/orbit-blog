import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const testsDirectory = fileURLToPath(new URL('../tests/', import.meta.url));
const forwardedArguments = process.argv.slice(2).filter((argument) => argument !== '--');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const specs = readdirSync(testsDirectory)
  .filter((fileName) => fileName.endsWith('.spec.ts'))
  .sort();

for (const spec of specs) {
  console.log(`\n=== E2E: ${spec} ===`);

  // Each spec gets a fresh Playwright global setup/teardown. In particular,
  // this resets the relay's OrbitDB state and prevents independent suites
  // from accumulating subscriptions and pinning work in one long process.
  const result = spawnSync(
    pnpm,
    ['exec', 'playwright', 'test', `tests/${spec}`, ...forwardedArguments],
    { env: process.env, stdio: 'inherit' },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (process.env.GITHUB_ACTIONS === 'true') {
      console.error(`::error title=E2E spec failed::${spec} exited with status ${result.status ?? 1}`);
    }
    process.exit(result.status ?? 1);
  }
}
