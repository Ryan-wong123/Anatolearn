import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';

export default function teardown(config) {
  if (!existsSync('.playwright/fixture.json')) return;
  const fixture = JSON.parse(readFileSync('.playwright/fixture.json', 'utf8'));
  // A second runner whose setup failed must not remove the active run's data.
  // A direct manual invocation (without config) is explicit recovery cleanup.
  if (config && process.env.ANATOLEARN_QA_STAMP !== fixture.stamp) return;
  execFileSync('docker', ['compose', 'exec', '-T', 'backend', 'node', 'tests/browser-fixture.js', 'cleanup', fixture.stamp], { stdio: 'inherit' });
  unlinkSync('.playwright/fixture.json');
}
