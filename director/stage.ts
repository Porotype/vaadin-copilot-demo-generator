// The split stage: the browser on the left, a coding agent's terminal on the right, both as windows on
// a 1920×1200 (16:10) backdrop. Used by concept scenes, where Copilot works next to a coding agent.
//
// The backdrop (window chrome, the "Concept" label) is drawn once as an image; each output frame puts
// the browser's and the terminal's frames into their windows (see SplitCapture).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Browser } from 'playwright';
import type { Rect } from './callouts.ts';

export interface StageOptions {
  /** Address shown in the browser window's bar. */
  url: string;
  /** Title of the terminal window (or the editor's, with side: 'editor'). */
  terminalTitle: string;
  /** What sits next to the browser: a coding agent's terminal (default) or a developer's IDE (editor.ts). */
  side?: 'terminal' | 'editor';
  /** Label in the top-left corner, e.g. "Concept". Concept scenes must say they are one; empty leaves it out. */
  label: string;
  /** Line next to the label. */
  caption?: string;
  /** 'split' (default): browser and terminal side by side. 'terminal': only the terminal, full frame. */
  layout?: 'split' | 'terminal';
}

export interface StageLayout {
  size: { width: number; height: number };
  /** Where the browser's viewport and the terminal's page go on the backdrop. */
  browser: Rect;
  terminal: Rect;
}

const BAR = 34;
export const SPLIT: StageLayout = {
  size: { width: 1920, height: 1200 },
  browser: { x: 28, y: 64 + BAR, w: 1232, h: 1072 },
  terminal: { x: 1288, y: 64 + BAR, w: 604, h: 1072 },
};

/**
 * The terminal alone, 16:10, for an agent's session as the whole picture. The browser still records
 * (the capture needs it) but sits hidden under the terminal. The terminal renders at `scale`, so its
 * text is larger and still sharp.
 */
export const TERMINAL: StageLayout & { scale: number } = {
  size: { width: 1920, height: 1200 },
  browser: { x: 100, y: 100, w: 320, h: 200 },
  terminal: { x: 60, y: 44 + BAR, w: 1800, h: 1100 },
  scale: 1.5,
};

export function layoutOf(options: StageOptions): StageLayout & { scale?: number } {
  return options.layout === 'terminal' ? TERMINAL : SPLIT;
}

/** Draws the backdrop with both windows' chrome, as a PNG at `file`. */
export async function drawBackdrop(browser: Browser, layout: StageLayout, options: StageOptions, file: string) {
  const html = await readFile(path.join(import.meta.dirname, 'page', 'stage.page.html'), 'utf8');
  const context = await browser.newContext({ viewport: layout.size, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.setContent(html);
  await page.evaluate(([l, o, bar]) => (window as any).drawStage(l, o, bar), [layout, options, BAR] as const);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, type: 'png' });
  await context.close();
}
