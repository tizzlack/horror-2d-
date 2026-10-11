// Runs every tests/*.test.mjs in its own node process. Exit code != 0 if any file fails.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.test.mjs')).sort();
let failed = 0;
for (const f of files) {
  console.log(`\n# ${f}`);
  const r = spawnSync(process.execPath, ['--no-warnings', join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log(`# ${f} FAILED (exit ${r.status})`); }
}
console.log(failed ? `\n${failed} test file(s) failed` : `\nAll ${files.length} test files passed`);
process.exit(failed ? 1 : 0);
