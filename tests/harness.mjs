// Minimal test harness (no dependencies). Each *.test.mjs imports { test, assert, done }.
import assert from 'node:assert/strict';

const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }
export { assert };

export async function done(label = '') {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ok   ${t.name}`);
    } catch (err) {
      failed++;
      console.log(`  FAIL ${t.name}\n       ${String(err?.stack ?? err).split('\n').slice(0, 6).join('\n       ')}`);
    }
  }
  console.log(`${label}: ${tests.length - failed}/${tests.length} passed`);
  if (failed) process.exitCode = 1;
}
