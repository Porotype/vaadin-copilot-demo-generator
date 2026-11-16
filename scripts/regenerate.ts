// Regenerates the walkthroughs into a vaadin/docs checkout, from scratch:
//
//   npm run regenerate                     every scene
//   npm run regenerate -- 106 110          only these (by number or name)
//
//   --docs-branch <b>   the docs branch to start from (default main, which is "latest"; v25.3 for a versioned one,
//                       with a matching Vaadin version in apps/docs-app/pom.xml)
//   --push              commit, push and open a draft PR in vaadin/docs (needs gh, signed in)
//   --skip-ai           leave out the AI scenes (102–104)
//   --keep-apps         leave the apps running afterwards
//
// The docs checkout is DOCS_DIR, or a shallow clone in .work/docs. A branch is made there from the docs branch, the
// apps are started (scripts/apps.ts), each scene is recorded in light and dark, one take at a time, and cut into
// steps; the partials and clips are written into the docs checkout (docs-content/asciidoc.py) and a contact sheet
// to out/contact-sheet.html. A scene that fails is reported and left out; the docs keep its clips.
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { startApps, stopApps } from './apps.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOCS_REPO = 'https://github.com/vaadin/docs.git';
const DOCS_PATHS = ['articles/tools/copilot/features', 'src/main/resources/META-INF/resources/vaadin/videos/copilot'];
const execFileP = promisify(execFile);

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'docs-branch': { type: 'string', default: 'main' },
    push: { type: 'boolean', default: false },
    'skip-ai': { type: 'boolean', default: false },
    'keep-apps': { type: 'boolean', default: false },
  },
});
const base = values['docs-branch']!;

const git = async (dir: string, ...args: string[]) => (await execFileP('git', ['-C', dir, ...args], { maxBuffer: 64 << 20 })).stdout.trim();

/** Runs a command with its output on the console; resolves to its exit code. */
function sh(cmd: string, args: string[], env: Record<string, string> = {}) {
  return new Promise<number>((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
    p.on('error', reject);
    p.on('exit', (code, signal) => resolve(signal ? 130 : code ?? 1));
  });
}

let interrupted = false;
process.on('SIGINT', () => { interrupted = true; });

// ---- What to record

const all = (await readdir(path.join(ROOT, 'scenes'))).filter(f => /^\d+-docs-.*\.ts$/.test(f)).map(f => f.slice(0, -3))
  .sort((a, b) => parseInt(a) - parseInt(b));
const scenes = positionals.length
  ? all.filter(s => positionals.some(p => s === p || s.startsWith(`${p}-`)))
  : all;
const unknown = positionals.filter(p => !all.some(s => s === p || s.startsWith(`${p}-`)));
if (unknown.length) {
  console.error(`no such scene: ${unknown.join(', ')} (scenes/<NN>-docs-*.ts)`);
  process.exit(2);
}
const isAI = async (scene: string) => /\bai:\s*true\b/.test(await readFile(path.join(ROOT, 'scenes', `${scene}.ts`), 'utf8'));
const signedIn = existsSync(path.join(os.homedir(), '.vaadin', 'proKey'));
const skipped: string[] = [];
const toRecord: string[] = [];
for (const s of scenes) {
  if ((await isAI(s)) && (values['skip-ai'] || !signedIn)) skipped.push(s);
  else toRecord.push(s);
}
if (skipped.length && !values['skip-ai']) {
  console.log(`Copilot isn't signed in to a Vaadin account (no ~/.vaadin/proKey): skipping the AI scenes ${skipped.join(', ')}.`);
}

const pom = await readFile(path.join(ROOT, 'apps/docs-app/pom.xml'), 'utf8');
const vaadinVersion = pom.match(/<vaadin\.version>([^<]+)</)?.[1] ?? 'unknown';

// ---- 1. The docs checkout, on a new branch

const docs = process.env.DOCS_DIR ? path.resolve(process.env.DOCS_DIR) : path.join(ROOT, '.work/docs');
if (!existsSync(path.join(docs, '.git'))) {
  if (process.env.DOCS_DIR) throw new Error(`DOCS_DIR=${docs} is not a git checkout`);
  console.log(`cloning vaadin/docs (${base}) into ${path.relative(ROOT, docs)}…`);
  if (await sh('git', ['clone', '--depth', '1', '--branch', base, DOCS_REPO, docs])) throw new Error('git clone failed');
}
if (await git(docs, 'status', '--porcelain', '--', ...DOCS_PATHS)) {
  throw new Error(`${docs} has uncommitted changes under ${DOCS_PATHS.join(' or ')}: commit or discard them first`);
}
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
const branch = `copilot-walkthroughs-${vaadinVersion}-${stamp}`;
try {
  await git(docs, 'fetch', '--depth', '1', 'origin', base);
  await git(docs, 'switch', '-c', branch, 'FETCH_HEAD');
} catch (e) {
  console.log(`could not fetch ${base} from origin; branching from the local ${base}`);
  await git(docs, 'switch', '-c', branch, base);
}
console.log(`docs: ${docs}, branch ${branch} (from ${base})`);

// ---- 2. The apps

const started = await startApps();
const copilotVersion = (await readFile(path.join(ROOT, 'apps/docs-app/target/devloop/cp.txt'), 'utf8').catch(() => ''))
  .match(/com[/\\]vaadin[/\\]copilot[/\\]([^/\\]+)[/\\]/)?.[1] ?? 'unknown';
console.log(`Vaadin ${vaadinVersion}, Copilot ${copilotVersion}`);

// ---- 3. Record and cut, one take at a time

const failed: string[] = [];
const cut: string[] = [];
const t0 = performance.now();
try {
  for (const [n, scene] of toRecord.entries()) {
    if (interrupted) break;
    console.log(`\n=== ${scene} (${n + 1}/${toRecord.length})`);
    const file = `scenes/${scene}.ts`;
    const tsx = path.join(ROOT, 'node_modules/.bin/tsx');
    const ok = !(await sh(tsx, ['director/run.ts', file]))
      && !interrupted
      && !(await sh(tsx, ['director/run.ts', file], { DOCS_THEME: 'dark' }))
      && !interrupted
      && !(await sh(tsx, ['director/walkthrough.ts', scene, `${scene}-dark`]));
    if (ok) cut.push(scene);
    else if (!interrupted) failed.push(scene);
  }
} finally {
  if (!values['keep-apps']) await stopApps(started);
}
if (interrupted) {
  console.log('\ninterrupted');
  process.exit(130);
}

// ---- 4. Docs output and contact sheet

if (cut.length) {
  if (await sh('python3', ['-I', 'docs-content/asciidoc.py', '.', docs, ...cut])) throw new Error('asciidoc.py failed');
}
const sheet = path.join(ROOT, 'out/contact-sheet.html');
await sh('python3', ['-I', 'docs-content/contact_sheet.py', '.', sheet, ...scenes]);

// ---- 5. Report, and maybe push

const minutes = ((performance.now() - t0) / 60000).toFixed(0);
console.log(`\nRecorded ${cut.length} of ${scenes.length} scenes in ${minutes} min (Vaadin ${vaadinVersion}, Copilot ${copilotVersion}).`);
if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`);
if (failed.length) {
  console.log(`FAILED: ${failed.join(', ')}. Their clips in the docs are unchanged. Re-run one with: npm run regenerate -- ${failed.map(s => parseInt(s)).join(' ')}`);
  if ((await Promise.all(failed.map(isAI))).some(Boolean)) {
    console.log('The AI scenes need Copilot signed in to a Vaadin account that may use AI, and the answer varies: a retry often passes.');
  }
}
await git(docs, 'add', '--intent-to-add', '--', ...DOCS_PATHS);
const stat = await git(docs, 'diff', '--stat', '--', ...DOCS_PATHS);
console.log(`\nIn ${docs}:\n${stat || '(no changes)'}`);
console.log(`\nContact sheet: ${sheet}`);

const title = `docs: re-record the Copilot walkthroughs (Vaadin ${vaadinVersion})`;
const body = [
  `Re-recorded with Vaadin ${vaadinVersion} and Copilot ${copilotVersion} by vaadin-copilot-demo-generator (\`npm run regenerate\`).`,
  '',
  `Scenes: ${cut.join(', ') || 'none'}.`,
  ...(failed.length ? [`Failed, clips unchanged: ${failed.join(', ')}.`] : []),
  ...(skipped.length ? [`Skipped: ${skipped.join(', ')}.`] : []),
].join('\n');
if (!stat) {
  // Nothing to commit.
} else if (values.push) {
  await git(docs, 'add', '--', ...DOCS_PATHS);
  await git(docs, 'commit', '-m', title, '-m', body);
  if (await sh('git', ['-C', docs, 'push', '-u', 'origin', branch])) throw new Error('git push failed');
  await sh('gh', ['pr', 'create', '--repo', 'vaadin/docs', '--draft', '--base', base, '--head', branch, '--title', title, '--body', body]);
} else {
  console.log(`
To make the docs PR:
  cd ${docs}
  git add ${DOCS_PATHS.join(' ')}
  git commit -m "${title}"
  git push -u origin ${branch}
  gh pr create --repo vaadin/docs --draft --base ${base} --fill
(or run again with --push)`);
}
process.exit(failed.length ? 1 : 0);
