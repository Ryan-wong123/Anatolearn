import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

export default async function setup(config) {
  const origin = new URL(config.projects[0].use.baseURL);
  if (!['localhost', '127.0.0.1'].includes(origin.hostname)) {
    throw new Error('Disposable browser QA is restricted to the local Docker development app.');
  }
  const response = await fetch(new URL('/api/programs', origin));
  if (!response.ok) throw new Error('Start the local Docker app before browser QA.');
  const output = execFileSync('docker', ['compose', 'exec', '-T', 'backend', 'node', 'tests/browser-fixture.js'], { encoding: 'utf8' });
  const fixture = JSON.parse(output.trim().split(/\r?\n/).at(-1));
  mkdirSync('.playwright', { recursive: true });
  writeFileSync('.playwright/fixture.json', JSON.stringify(fixture));
  process.env.ANATOLEARN_QA_STAMP = fixture.stamp;
}
