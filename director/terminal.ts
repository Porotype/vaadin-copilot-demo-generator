// A coding agent's terminal for concept scenes: a staged Claude Code session, drawn in its own page and
// captured next to the browser (see stage.ts). Scenes write to it on the Demo's timeline:
//
//   await term.type('address the UI annotations');   // into the prompt box, at a human pace
//   term.submit();
//   term.spin('Reading annotations');
//   await term.add(t.tool('Update', 'ProjectsView.java', ['Updated …']), 900);
//
// The terminal only shows what a scene tells it to; what an agent would *do* (edit files, apply) the
// scene does for real, so the browser shows the actual result.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CDPSession, Page } from 'playwright';
import type { Demo } from './dsl.ts';

const SPINNER = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];

export class Terminal {
  private blocks: string[] = [];
  private input = '';
  private placeholder = '';
  private spinner: { text: string; startMs: number } | null = null;
  private statusLeft = '';
  private statusRight = '';
  private demo!: Demo;
  private cdp!: CDPSession;
  private lastSig = '';
  private lastShot: Buffer | null = null;

  private constructor(readonly page: Page) {}

  static async open(page: Page) {
    const term = new Terminal(page);
    await page.setContent(await readFile(path.join(import.meta.dirname, 'page', 'terminal.page.html'), 'utf8'));
    await page.evaluate(() => document.fonts.ready);
    term.cdp = await page.context().newCDPSession(page);
    return term;
  }

  /** The terminal follows this demo's timeline (spinner time, cursor blink, typing pace). */
  attach(demo: Demo) {
    this.demo = demo;
  }

  // ------------------------------------------------------------ content

  /** Appends a block (see `t`), then holds for `ms`. */
  async add(block: string, ms = 0) {
    this.blocks.push(block);
    if (this.blocks.length > 80) this.blocks.shift();
    if (ms) await this.demo.hold(ms);
  }

  /** Replaces the last block, e.g. a running tool call with its result. */
  replaceLast(block: string) {
    this.blocks[this.blocks.length - 1] = block;
  }

  /** Appends blocks one after another, `perMs` apart. */
  async stream(blocks: string[], perMs = 140) {
    for (const b of blocks) await this.add(b, perMs);
  }

  clear() {
    this.blocks = [];
  }

  // ------------------------------------------------------------ prompt box

  async type(text: string, perChar = 55) {
    for (const ch of text) {
      this.input += ch;
      await this.demo.hold(perChar);
    }
  }

  /** Moves what was typed into the transcript, as Claude Code does on Enter. */
  submit() {
    if (this.input) this.blocks.push(t.user(this.input));
    this.input = '';
  }

  setPlaceholder(text: string) {
    this.placeholder = text;
  }

  // ------------------------------------------------------------ spinner and status line

  /** Shows the spinner; `elapsedMs` makes it look like it has been running that long already. */
  spin(text: string, elapsedMs = 0) {
    this.spinner = { text, startMs: this.demo.time - elapsedMs };
  }

  stopSpin() {
    this.spinner = null;
  }

  /** The status line under the prompt box (HTML; see `t.status*`). */
  status(left: string, right = this.statusRight) {
    this.statusLeft = left;
    this.statusRight = right;
  }

  // ------------------------------------------------------------ capture

  /** The terminal as it looks at output frame `index`, as a JPEG. Re-drawn only when it changed. */
  async frame(index: number, fps: number): Promise<Buffer> {
    const ms = (index * 1000) / fps;
    const state = {
      blocks: this.blocks,
      input: this.input,
      placeholder: this.placeholder,
      cursorOn: Math.floor(ms / 530) % 2 === 0,
      spinner: this.spinner
        ? { text: this.spinner.text, glyph: SPINNER[Math.floor(ms / 120) % SPINNER.length], secs: Math.max(0, Math.floor((ms - this.spinner.startMs) / 1000)) }
        : null,
      statusLeft: this.statusLeft,
      statusRight: this.statusRight,
    };
    const sig = JSON.stringify(state);
    if (sig !== this.lastSig || !this.lastShot) {
      await this.page.evaluate(s => (window as any).renderTerminal(s), state);
      const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
      this.lastShot = Buffer.from(data, 'base64');
      this.lastSig = sig;
    }
    return this.lastShot;
  }
}

// ------------------------------------------------------------ blocks

export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** `code` and **bold** in otherwise plain text. */
const md = (s: string) => esc(s).replace(/`([^`]+)`/g, '<span class="code">$1</span>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

export interface DiffLine {
  n?: number;
  type: '+' | '-' | ' ' | '~';
  text: string;
}

export const t = {
  welcome(cwd: string) {
    return `<div class="welcome"><span class="star">✻</span> Welcome to <b>Claude Code</b>!<br><br><span class="d">  /help for help, /status for your current setup<br><br>  cwd: ${esc(cwd)}</span></div>`;
  },
  /** A prompt in the transcript; `from` notes who sent it when it wasn't typed here. */
  user(text: string, from?: string) {
    return `<div class="user">&gt; <b>${esc(text)}</b>${from ? `<div class="from">↳ ${esc(from)}</div>` : ''}</div>`;
  },
  /** The agent speaking. Text may use `code` and **bold**; '\n' breaks lines. */
  say(text: string) {
    return `<div class="msg"><span class="dot">⏺</span><div>${md(text).replace(/\n/g, '<br>')}</div></div>`;
  },
  /** A tool call; `result` lines go under it (⎿). `running` draws it before its result arrives. */
  tool(name: string, arg: string, result: string[] = [], options: { running?: boolean; html?: boolean } = {}) {
    const head = `<div class="msg"><span class="dot ${options.running ? 'run' : 'ok'}">⏺</span><div><b>${esc(name)}</b>${arg ? `(${esc(arg)})` : ''}</div></div>`;
    return head + (result.length ? t.result(result, options.html) : '');
  },
  result(lines: string[], html = false) {
    return `<div class="res"><span class="el">⎿</span><div class="body">${lines.map(l => `<div>${html ? l : md(l)}</div>`).join('')}</div></div>`;
  },
  /** Output of a hook, e.g. the Dev Loop's briefing at the next prompt. */
  hook(title: string, lines: string[]) {
    return `<div class="res"><span class="el">⎿</span><div class="body"><div class="accent">${esc(title)}</div>${lines.map(l => `<div class="hl">${l}</div>`).join('')}</div></div>`;
  },
  /** A file change as Claude Code shows it; past `maxLines` it folds the rest, as Claude Code does. */
  diff(summary: string, lines: DiffLine[], maxLines = 18) {
    // Drop the indentation all shown lines share, so the change fits the narrow window.
    const indents = lines.filter(l => l.type !== '~' && l.text.trim()).map(l => l.text.match(/^ */)![0].length);
    const cut = indents.length ? Math.min(...indents) : 0;
    const row = (l: DiffLine) => {
      if (l.type === '~') return `<div class="gap">     ⋯</div>`;
      const cls = l.type === '+' ? 'add' : l.type === '-' ? 'del' : '';
      return `<div class="${cls}"><span class="n">${l.n ?? ''}</span>${l.type === ' ' ? ' ' : l.type} ${esc(l.text.slice(cut))}</div>`;
    };
    const shown = lines.slice(0, maxLines);
    const more = lines.length - shown.length;
    const fold = more > 0 ? `<div class="gap">     … +${more} lines (ctrl+r to expand)</div>` : '';
    return `<div class="res"><span class="el">⎿</span><div class="body"><div>${md(summary)}</div><div class="diff">${shown.map(row).join('')}${fold}</div></div></div>`;
  },
};

/** Parses a unified diff of one file into numbered lines for t.diff, keeping `context` lines around changes. */
export function diffLines(diff: string, context = 1): { lines: DiffLine[]; added: number; removed: number } {
  const all: DiffLine[] = [];
  let oldN = 0, newN = 0, added = 0, removed = 0;
  for (const line of diff.split('\n')) {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)/);
    if (hunk) {
      if (all.length) all.push({ type: '~', text: '' });
      oldN = Number(hunk[1]);
      newN = Number(hunk[2]);
      continue;
    }
    if (/^(diff|index|---|\+\+\+) /.test(line) || line.startsWith('\\')) continue;
    if (line.startsWith('+')) { all.push({ n: newN++, type: '+', text: line.slice(1) }); added++; }
    else if (line.startsWith('-')) { all.push({ n: oldN++, type: '-', text: line.slice(1) }); removed++; }
    else if (line.startsWith(' ')) { all.push({ n: newN++, type: ' ', text: line.slice(1) }); oldN++; }
  }
  // Keep changed lines and `context` lines around them.
  const keep = all.map((l, i) => l.type === '+' || l.type === '-' || all.slice(Math.max(0, i - context), i + context + 1).some(n => n.type === '+' || n.type === '-'));
  const lines: DiffLine[] = [];
  all.forEach((l, i) => {
    if (keep[i]) lines.push(l);
    else if (lines.length && lines.at(-1)!.type !== '~') lines.push({ type: '~', text: '' });
  });
  while (lines.at(-1)?.type === '~') lines.pop();
  return { lines, added, removed };
}
