// The docs app, twice, under the Vaadin Dev Loop: plain on :8084 (most walkthroughs) and with the `secure`
// profile on :8085 (a login, for 110-docs-impersonate). A project has one Dev Loop daemon, so the secure one runs
// from a copy, .work/docs-app-secure, synced from apps/docs-app before each start. Takes never edit that copy.
//
//   npm run apps -- start     start both (or bring a running one up to date)
//   npm run apps -- stop      stop both, and their daemons
//   npm run apps -- status
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const APP = path.join(ROOT, 'apps/docs-app');
const SECURE_COPY = path.join(ROOT, '.work/docs-app-secure');
const DEV = path.join(APP, '.vaadin/vaadin-dev');

interface Instance { name: string; dir: string; port: number; jvmArgs: string }

export const INSTANCES: Instance[] = [
  { name: 'docs app', dir: APP, port: 8084, jvmArgs: '-Dserver.port=8084' },
  { name: 'docs app (secure)', dir: SECURE_COPY, port: 8085, jvmArgs: '-Dserver.port=8085 -Dspring.profiles.active=secure' },
];

/** Build output, generated files and the daemon's state: not the app's sources. */
const SKIP = new Set(['target', 'node_modules', 'generated', 'bundles']);
const SKIP_FILES = /^daemon\./;

/** Makes `to` a copy of `from`'s sources, writing only what differs. Returns the number of files changed. */
async function sync(from: string, to: string): Promise<number> {
  let changed = 0;
  await mkdir(to, { recursive: true });
  const want = new Set<string>();
  for (const e of await readdir(from, { withFileTypes: true })) {
    if (SKIP.has(e.name) || SKIP_FILES.test(e.name)) continue;
    want.add(e.name);
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) changed += await sync(a, b);
    else if (e.isFile()) {
      const content = await readFile(a);
      if (!existsSync(b) || !content.equals(await readFile(b))) {
        await writeFile(b, content, { mode: e.name.startsWith('vaadin-dev') || e.name === 'mvnw' ? 0o755 : 0o644 });
        changed++;
      }
    }
  }
  for (const e of await readdir(to, { withFileTypes: true })) {
    if (want.has(e.name) || SKIP.has(e.name) || SKIP_FILES.test(e.name)) continue;
    await rm(path.join(to, e.name), { recursive: true, force: true });
    changed++;
  }
  return changed;
}

function dev(i: Instance, args: string[], quiet = false) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(DEV, ['--app', i.dir, ...args], { cwd: i.dir, stdio: quiet ? 'ignore' : ['ignore', 'inherit', 'inherit'] });
    p.on('error', reject);
    p.on('exit', code => (code === 0 ? resolve() : reject(new Error(`${i.name}: vaadin-dev ${args[0]} failed (exit ${code})`))));
  });
}

async function state(i: Instance): Promise<string> {
  if (!existsSync(path.join(i.dir, '.vaadin/daemon.properties'))) return 'stopped';
  try {
    const { stdout } = await run(DEV, ['--app', i.dir, 'status', '--json'], { cwd: i.dir });
    return JSON.parse(stdout).app.state;
  } catch {
    return 'unknown';
  }
}

const answers = (port: number) => fetch(`http://localhost:${port}/`, { redirect: 'manual' }).then(() => true, () => false);

/** Starts both instances, or updates and keeps running ones. Returns those it started. */
export async function startApps(): Promise<Instance[]> {
  const changed = await sync(APP, SECURE_COPY);
  const started: Instance[] = [];
  for (const i of INSTANCES) {
    if ((await state(i)) === 'running') {
      // The secure copy may be behind apps/docs-app (a Vaadin bump, a fix): apply compiles and reloads.
      if (i.dir === SECURE_COPY && changed) await dev(i, ['apply']);
      console.log(`${i.name}: running on :${i.port}`);
      continue;
    }
    if (await answers(i.port)) {
      throw new Error(`${i.name}: something else is answering on :${i.port}. Stop it (another checkout's app?) and retry.`);
    }
    console.log(`${i.name}: starting on :${i.port} (the first start resolves Maven dependencies, a few minutes)…`);
    await dev(i, ['start', '--jvm-args', i.jvmArgs]);
    started.push(i);
  }
  return started;
}

export async function stopApps(instances = INSTANCES) {
  for (const i of instances) {
    if ((await state(i)) === 'stopped') continue;
    await dev(i, ['shutdown'], true).catch(e => console.error(String(e)));
    console.log(`${i.name}: stopped`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  if (command === 'start') await startApps();
  else if (command === 'stop') await stopApps();
  else if (command === 'status') for (const i of INSTANCES) console.log(`${i.name}, :${i.port}: ${await state(i)}`);
  else {
    console.error('usage: npm run apps -- start | stop | status');
    process.exit(2);
  }
}
