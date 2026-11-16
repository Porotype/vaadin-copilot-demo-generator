// The docs walkthroughs' app (apps/docs-app): a fresh start.vaadin.com project with one form view added.
// Where it runs, how a take leaves it as it found it, and the part an IDE plays (compile and hot-swap on
// save). `npm run regenerate` starts it; by hand, under the Dev Loop on :8084, and with a login (the secure
// profile, from a copy, see scripts/apps.ts) on :8085:
//   npm run apps -- start
import { execFile } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export const APP_DIR = path.resolve(import.meta.dirname, '../../apps/docs-app');
export const BASE_URL = process.env.DOCS_APP_URL ?? 'http://localhost:8084';
export const URL_LABEL = 'localhost:8084';
/** The same app with the secure profile: a login, and admin-only views (for 110-docs-impersonate). */
export const SECURE_URL = process.env.DOCS_SECURE_APP_URL ?? 'http://localhost:8085';
const DEV = path.join(APP_DIR, '.vaadin', 'vaadin-dev');
export const JAVA = path.join(APP_DIR, 'src/main/java/com/example');
/** Build output and generated files: a take may change them, and they aren't the app's sources. */
const SKIP = new Set(['target', 'node_modules', '.vaadin', 'generated', 'bundles', '.git']);

export async function assertRunning(url = BASE_URL) {
  try {
    await fetch(url, { redirect: 'manual' });
  } catch {
    throw new Error(`the docs app is not answering at ${url}. Start it with: npm run apps -- start`);
  }
}

export async function apply() {
  const { stdout } = await run(DEV, ['apply'], { cwd: APP_DIR });
  return stdout.trim();
}

/** Restarts the app (≈20 s): a new JVM, and an empty in-memory task list. */
export async function restart() {
  console.log('docs app: restarting (≈20 s)…');
  await run(DEV, ['restart'], { cwd: APP_DIR });
}

async function snapshot(dir = APP_DIR, files = new Map<string, string>()) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await snapshot(p, files);
    else if (e.isFile()) files.set(p, await readFile(p, 'utf8'));
  }
  return files;
}

/**
 * Remembers the app's files (sources, and the project files Copilot writes, like vaadin-copilot.json) and
 * puts them back after the take: changed ones restored, new ones removed, then compiled and hot-swapped.
 * Before the take, whatever is pending is compiled, and the app restarted if anything was, so a take
 * starts in a JVM where nothing was redefined.
 */
export async function guardSources(): Promise<() => Promise<void>> {
  const before = await snapshot();
  const out = await apply();
  if (!/^no changes/m.test(out)) await restart();
  return async () => {
    const after = await snapshot();
    const changed: string[] = [];
    for (const [file, content] of before) {
      if (after.get(file) === content) continue;
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content);
      changed.push(path.relative(APP_DIR, file));
    }
    for (const file of after.keys()) {
      if (before.has(file)) continue;
      await rm(file, { force: true });
      changed.push(`${path.relative(APP_DIR, file)} (removed)`);
    }
    if (!changed.length) return;
    console.log(`docs app: restored ${changed.join(', ')}`);
    console.log(`docs app: ${(await apply()).split('\n').at(-1)}`);
  };
}

/** The view a file defines, e.g. 'contacts/ui/ContactView.java'. */
export const javaFile = (rel: string) => path.join(JAVA, rel);
export const exists = (rel: string) => existsSync(javaFile(rel));
export const read = (rel: string) => readFile(javaFile(rel), 'utf8');

/** `git diff`-style text of one file's change, for the page's code step. */
export async function diffOf(file: string, original: string) {
  const tmp = path.join(APP_DIR, 'target', 'docs-diff-original');
  await mkdir(path.dirname(tmp), { recursive: true });
  await writeFile(tmp, original);
  try {
    await run('git', ['diff', '--no-index', '--no-color', '-U3', tmp, file]);
    return '';
  } catch (e: any) {
    // git diff --no-index exits 1 when the files differ. Name the file as a repo diff would.
    const rel = path.relative(APP_DIR, file);
    return String(e.stdout).replace(/^--- .*$/m, `--- a/${rel}`).replace(/^\+\+\+ .*$/m, `+++ b/${rel}`);
  }
}

/**
 * The part an IDE with hot reload plays: after Copilot (or the scene, as the developer) saves a Java or CSS
 * file, compile and hot-swap it. The Dev Loop has no watch mode.
 */
export function applyOnChange(log = (msg: string) => console.log(msg)) {
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<unknown> = Promise.resolve();
  let pending = 0;
  const onChange = (_event: string, file: string | null) => {
    if (file && !/\.(java|css)$/.test(file)) return;
    if (!timer) pending++;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      running = running.then(async () => {
        const t0 = performance.now();
        try {
          log(`vaadin-dev apply (${Math.round(performance.now() - t0)} ms): ${(await apply()).split('\n').at(-1)}`);
        } catch (e: any) {
          log(`vaadin-dev apply failed: ${e.stdout ?? e}`);
        } finally {
          pending--;
        }
      });
    }, 250);
  };
  const watchers = ['src/main/java', 'src/main/resources/META-INF/resources'].map(dir => watch(path.join(APP_DIR, dir), { recursive: true }, onChange));
  return {
    /** True when no saved change is waiting to be compiled and hot-swapped. */
    settled: () => pending === 0,
    close: () => {
      clearTimeout(timer);
      watchers.forEach(w => w.close());
    },
  };
}
