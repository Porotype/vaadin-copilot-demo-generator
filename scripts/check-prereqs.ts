// Checks what a recording needs besides the Node packages, and says what's missing. Runs after npm install;
// never fails it.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const javaWanted = Number(readFileSync(path.join(ROOT, 'apps/docs-app/pom.xml'), 'utf8').match(/<java\.version>(\d+)</)?.[1] ?? 0);

function version(cmd: string, args: string[]): string | null {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  // java -version writes to stderr.
  return r.status === 0 ? r.stdout + r.stderr : null;
}

const problems: string[] = [];
const notes: string[] = [];

const java = version('java', ['-version']);
const javaMajor = Number(java?.match(/version "(\d+)/)?.[1] ?? 0);
if (!java) problems.push(`Java ${javaWanted}: not found (the docs app is built and run with it)`);
else if (javaMajor < javaWanted) problems.push(`Java ${javaWanted}: found Java ${javaMajor}`);

if (!version('ffmpeg', ['-version']) || !version('ffprobe', ['-version'])) problems.push('ffmpeg and ffprobe: not found (they encode and cut the clips)');
const python = version('python3', ['--version']);
if (!python) problems.push('Python 3: not found (it writes the docs partials)');
if (!version('git', ['--version'])) problems.push('git: not found');
if (!version('gh', ['--version'])) notes.push('gh (GitHub CLI) not found: needed only for `npm run regenerate -- --push`');
if (!existsSync(path.join(os.homedir(), '.vaadin', 'proKey'))) {
  notes.push('Copilot is not signed in to a Vaadin account (no ~/.vaadin/proKey). Open a Vaadin app in dev mode and sign in from '
    + "Copilot: edits need it, and the AI scenes (102–104) need an account that may use AI. Without it, regenerate skips the AI scenes.");
}

if (problems.length) {
  console.log(`\nMissing for recording:\n${problems.map(p => `  - ${p}`).join('\n')}`);
}
if (notes.length) console.log(`\n${notes.map(n => `  - ${n}`).join('\n')}`);
if (!problems.length) console.log(`\nPrerequisites OK (Java ${javaMajor}, ffmpeg, ${python?.trim()}). Next: npm run regenerate`);
