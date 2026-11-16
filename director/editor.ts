// A developer's IDE for split-stage scenes: one Java file in an editor, drawn in its own page and
// captured next to the browser in place of the terminal (stage.side = 'editor', see stage.ts). Scenes
// drive it on the Demo's timeline:
//
//   editor.open('TaskListView.java', source, { line: 52 });   // Go to Source landed here
//   editor.select(52, 'Create');                               // the caption, as a double-click selects it
//   await editor.type('Add task');                             // replaces the selection, at a human pace
//   await editor.save(() => writeFile(file, editor.text));     // the dirty dot goes; the scene writes the file
//   editor.reload(textOnDisk, 52);                             // someone else changed the file; flashes the line
//
// The editor only shows what a scene tells it to; saving the file and hot-swapping it are the scene's.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CDPSession, Page } from 'playwright';
import type { Demo } from './dsl.ts';

const ROW = 20.8;

export class Editor {
  private lines: string[] = [];
  private file = '';
  private crumbs = '';
  private dirty = false;
  private caret: { line: number; col: number } | null = null;
  private sel: { line: number; from: number; to: number } | null = null;
  private statusHtml = '';
  private scroll = { from: 0, to: 0, startMs: 0 };
  private flash: { line: number; startMs: number } | null = null;
  private toast: { text: string; startMs: number; ms: number } | null = null;
  private demo!: Demo;
  private cdp!: CDPSession;
  private lastSig = '';
  private lastShot: Buffer | null = null;
  private visibleRows = 40;

  private constructor(readonly page: Page) {}

  static async open(page: Page) {
    const editor = new Editor(page);
    await page.setContent(await readFile(path.join(import.meta.dirname, 'page', 'editor.page.html'), 'utf8'));
    await page.evaluate(() => document.fonts.ready);
    editor.visibleRows = Math.floor((page.viewportSize()!.height - 34 - 26 - 26) / ROW);
    editor.cdp = await page.context().newCDPSession(page);
    return editor;
  }

  /** The editor follows this demo's timeline (caret blink, typing pace, scrolling). */
  attach(demo: Demo) {
    this.demo = demo;
  }

  get text() {
    return this.lines.join('\n');
  }

  private get now() {
    return this.demo?.time ?? 0;
  }

  // ------------------------------------------------------------ content

  /** Opens `file` with `text`; with `line`, scrolls there and puts the caret at its first non-blank. */
  open(file: string, text: string, options: { line?: number; crumbs?: string } = {}) {
    this.file = file;
    this.crumbs = options.crumbs ?? '';
    this.lines = text.replace(/\n$/, '').split('\n');
    this.dirty = false;
    this.sel = null;
    if (options.line) {
      this.reveal(options.line, false);
      this.caret = { line: options.line, col: this.lines[options.line - 1].search(/\S|$/) };
    } else {
      this.caret = null;
    }
  }

  /** The file changed on disk (another tool saved it): shows the new text and flashes `line`. */
  reload(text: string, line?: number) {
    this.lines = text.replace(/\n$/, '').split('\n');
    this.dirty = false;
    this.sel = null;
    if (line) {
      this.reveal(line);
      this.flash = { line, startMs: this.now };
    }
  }

  /** The 1-based line holding `needle`. */
  lineOf(needle: string) {
    const i = this.lines.findIndex(l => l.includes(needle));
    if (i < 0) throw new Error(`editor: no line with ${needle}`);
    return i + 1;
  }

  /** Scrolls so `line` sits about a third of the way down. */
  reveal(line: number, animate = true) {
    const to = Math.max(0, Math.min(line - Math.floor(this.visibleRows / 3), this.lines.length - this.visibleRows + 4));
    const from = animate ? this.currentScroll() : to;
    this.scroll = { from, to, startMs: this.now };
  }

  private currentScroll() {
    const t = Math.min(1, (this.now - this.scroll.startMs) / 450);
    const e = 1 - Math.pow(1 - t, 3);
    return this.scroll.from + (this.scroll.to - this.scroll.from) * e;
  }

  // ------------------------------------------------------------ caret, selection, typing

  caretAt(line: number, col: number) {
    this.caret = { line, col };
    this.sel = null;
  }

  /** Selects `what` on `line` (its first occurrence) and puts the caret at its end. */
  select(line: number, what: string) {
    const from = this.lines[line - 1].indexOf(what);
    if (from < 0) throw new Error(`editor: line ${line} has no ${what}`);
    this.sel = { line, from, to: from + what.length };
    this.caret = { line, col: from + what.length };
  }

  /** Types at the caret (a '\n' starts a new line), replacing the selection first, at a human pace. */
  async type(text: string, perChar = 85) {
    if (!this.caret) throw new Error('editor: no caret');
    if (this.sel) {
      const l = this.lines[this.sel.line - 1];
      this.lines[this.sel.line - 1] = l.slice(0, this.sel.from) + l.slice(this.sel.to);
      this.caret = { line: this.sel.line, col: this.sel.from };
      this.sel = null;
      this.dirty = true;
      await this.demo.hold(perChar);
    }
    for (const ch of text) {
      const l = this.lines[this.caret.line - 1];
      if (ch === '\n') {
        this.lines.splice(this.caret.line - 1, 1, l.slice(0, this.caret.col), l.slice(this.caret.col));
        this.caret = { line: this.caret.line + 1, col: 0 };
      } else {
        this.lines[this.caret.line - 1] = l.slice(0, this.caret.col) + ch + l.slice(this.caret.col);
        this.caret.col++;
      }
      this.dirty = true;
      await this.demo.hold(perChar);
    }
  }

  /** Saves: `write` puts the text on disk, then the dirty dot goes. */
  async save(write?: (text: string) => Promise<void> | void) {
    await write?.(this.text);
    this.dirty = false;
  }

  // ------------------------------------------------------------ chrome

  /** The status bar's right side (HTML). */
  status(html: string) {
    this.statusHtml = html;
  }

  /** A small notification in the editor's corner, for `ms`. */
  notify(text: string, ms = 2500) {
    this.toast = { text, startMs: this.now, ms };
  }

  // ------------------------------------------------------------ capture

  /** The editor as it looks at output frame `index`, as a JPEG. Re-drawn only when it changed. */
  async frame(index: number, fps: number): Promise<Buffer> {
    const ms = (index * 1000) / fps;
    const flashAlpha = this.flash ? Math.max(0, 1 - (ms - this.flash.startMs) / 1800) : 0;
    const toastAlpha = this.toast ? Math.max(0, Math.min(1, (ms - this.toast.startMs) / 200, (this.toast.startMs + this.toast.ms - ms) / 250)) : 0;
    const state = {
      tabs: [{ name: this.file, on: true }],
      crumbs: this.crumbs,
      dirty: this.dirty,
      lines: this.lines,
      caret: this.caret,
      sel: this.sel,
      caretOn: this.sel ? false : Math.floor(ms / 530) % 2 === 0,
      scroll: Math.round(this.currentScroll() * 100) / 100,
      flash: flashAlpha > 0 ? { line: this.flash!.line, alpha: Math.round(flashAlpha * 40) / 40 } : null,
      toast: toastAlpha > 0 ? { text: this.toast!.text, alpha: Math.round(toastAlpha * 20) / 20 } : null,
      status: this.statusHtml,
      sig: '',
    };
    state.sig = JSON.stringify({ ...state, caretOn: undefined, scroll: undefined, toast: undefined });
    const sig = JSON.stringify(state);
    if (sig !== this.lastSig || !this.lastShot) {
      await this.page.evaluate(s => (window as any).renderEditor(s), state);
      const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
      this.lastShot = Buffer.from(data, 'base64');
      this.lastSig = sig;
    }
    return this.lastShot;
  }
}
