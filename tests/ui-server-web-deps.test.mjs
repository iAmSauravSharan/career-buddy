// `npm run ui` on a checkout where the web app (frontend/ + backend/) has no
// dependencies installed must say so before printing a URL, and a server that
// dies on startup must not be blamed on the port.
//
// The launcher finds frontend/ and backend/ next to its own directory, so each
// test copies it and the modules it imports into a throwaway tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const COPIED = [
  'scripts/ui-server.mjs',
  'path-resolver.mjs',
  'frontend/src/lib/bind-host.mjs',
  'shared/src/origin-guard.mjs',
];

function launcherTree() {
  const dir = mkdtempSync(join(tmpdir(), 'co-ui-server-'));
  for (const rel of COPIED) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    cpSync(join(ROOT, rel), join(dir, rel));
  }
  mkdirSync(join(dir, 'frontend'), { recursive: true });
  mkdirSync(join(dir, 'backend'), { recursive: true });
  writeFileSync(join(dir, 'frontend', 'package.json'), JSON.stringify({ name: 'frontend', dependencies: { next: '^15.0.0' } }));
  writeFileSync(join(dir, 'backend', 'package.json'), JSON.stringify({ name: 'backend', dependencies: { tsx: '^4.0.0' } }));
  return dir;
}

/** A stub `tsx` whose CLI keeps the fake API server alive until it is stopped. */
function installStubApi(dir) {
  const tsxDir = join(dir, 'backend', 'node_modules', 'tsx');
  mkdirSync(join(tsxDir, 'dist'), { recursive: true });
  writeFileSync(join(tsxDir, 'package.json'), JSON.stringify({ name: 'tsx', version: '4.0.0' }));
  writeFileSync(join(tsxDir, 'dist', 'cli.mjs'), 'setInterval(() => {}, 1000);\n');
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function launch(dir) {
  const port = await freePort();
  const run = spawnSync(process.execPath, [join(dir, 'scripts', 'ui-server.mjs'), '--no-open', `--port=${port}`], {
    cwd: dir,
    encoding: 'utf-8',
    timeout: 30_000,
    env: { ...process.env, CAREER_OPS_ROOT: dir, CAREER_OPS_WEB_ALLOWED_HOSTS: '' },
  });
  return { ...run, port };
}

test('missing web dependencies are named, with the install command, before any URL', async () => {
  const dir = launcherTree();
  try {
    const run = await launch(dir);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Web UI dependencies are not installed/);
    assert.match(run.stderr, /npm --prefix frontend ci/);
    assert.doesNotMatch(run.stdout, /Web UI:/);
    assert.doesNotMatch(run.stderr, /Port may be occupied/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a server that exits during startup is not blamed on the port', async () => {
  const dir = launcherTree();
  try {
    installStubApi(dir);
    const nextDir = join(dir, 'frontend', 'node_modules', 'next');
    mkdirSync(nextDir, { recursive: true });
    writeFileSync(join(nextDir, 'package.json'), JSON.stringify({ name: 'next', version: '15.0.0', bin: { next: 'cli.js' } }));
    writeFileSync(join(dir, 'frontend', 'server.mjs'), 'process.exitCode = 3;\n');
    const run = await launch(dir);
    assert.equal(run.status, 3);
    assert.doesNotMatch(run.stderr, /Port may be occupied/);
    assert.match(run.stderr, /exited with code 3 before it was ready/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
