// Records one scene:  npm run scene -- scenes/91-docs-edit-text.ts [--mode stepped|video] [--fps 60]
//                                       [--headed] [--gif]
// → out/<scene>/scene.mp4, and steps.json with the scene's step marks (for director/walkthrough.ts).
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { SplitCapture, createCapture, toGif, type CaptureMode, type FrameSink } from './capture.ts';
import { Demo } from './dsl.ts';
import type { Scene, SceneContext } from './scene.ts';
import { SPLIT, drawBackdrop, layoutOf } from './stage.ts';
import { Editor } from './editor.ts';
import { Terminal } from './terminal.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  allowNegative: true,
  options: {
    mode: { type: 'string', default: 'stepped' },
    fps: { type: 'string' },
    headed: { type: 'boolean', default: false },
    // A GIF of the take, for places that take images rather than videos.
    gif: { type: 'boolean', default: false },
  },
});

if (positionals.length !== 1) {
  console.error('usage: npm run scene -- <scene file> [--mode stepped|video] [--fps N] [--headed] [--gif]');
  process.exit(2);
}

const scene: Scene = (await import(pathToFileURL(path.resolve(positionals[0])).href)).default;
const mode = values.mode as CaptureMode;
const layout: ReturnType<typeof layoutOf> = scene.stage ? layoutOf(scene.stage) : SPLIT;
// 16:10 by default.
const viewport = scene.stage ? { width: layout.browser.w, height: layout.browser.h } : scene.viewport ?? { width: 1600, height: 1000 };
const size = scene.stage ? layout.size : scene.size ?? { width: 1920, height: 1200 };
if (scene.stage && mode !== 'stepped') {
  console.error('a split-stage scene needs the stepped capture');
  process.exit(2);
}
const fps = Number(values.fps ?? scene.fps ?? 60);
const outDir = path.join(ROOT, 'out', scene.name);
await mkdir(outDir, { recursive: true });

const cleanups: Array<() => Promise<void> | void> = [];
const defer = (fn: () => Promise<void> | void) => cleanups.push(fn);
// One cleanup, awaited by every exit path: a signal closes the browser, which makes the scene throw,
// and the main path must not exit before the signal's cleanup has restored everything.
let cleaning: Promise<void> | null = null;
function cleanup() {
  cleaning ??= (async () => {
    // Each step gets a time limit: a hung browser must not keep the machine config or the app
    // sources from being restored.
    for (const fn of cleanups.reverse()) {
      try {
        await Promise.race([
          fn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timed out after 60 s')), 60_000).unref()),
        ]);
      } catch (e) {
        console.error('cleanup failed:', e);
      }
    }
  })();
  return cleaning;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => cleanup().finally(() => process.exit(130)));
}

const started = performance.now();
try {
  await scene.prepare?.({ outDir, defer });

  // The sandbox and some corporate networks only reach the internet through a proxy, which Chromium
  // does not pick up from the environment. Copilot fetches its edit-mode plugins from a CDN.
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({
    headless: !values.headed,
    proxy: proxy ? { server: proxy, bypass: 'localhost,127.0.0.1,::1' } : undefined,
  });
  defer(async () => { await Promise.race([browser.close(), new Promise(r => setTimeout(r, 10_000).unref())]); });

  let capture: FrameSink;
  let terminal: Terminal | undefined;
  let editor: Editor | undefined;
  if (scene.stage) {
    const backdrop = path.join(outDir, 'stage.png');
    await drawBackdrop(browser, layout, scene.stage, backdrop);
    // A larger terminal renders at a scale: bigger text, the same pixels.
    const scale = layout.scale ?? 1;
    const termContext = await browser.newContext({ viewport: { width: Math.round(layout.terminal.w / scale), height: Math.round(layout.terminal.h / scale) }, deviceScaleFactor: scale });
    const sidePage = await termContext.newPage();
    if (scene.stage.side === 'editor') editor = await Editor.open(sidePage);
    else terminal = await Terminal.open(sidePage);
    // The browser's frames stay at viewport size; the stage composites them at 1:1.
    capture = new SplitCapture({ outDir, fps, viewport, size: viewport }, (editor ?? terminal)!, { backdrop, ...layout });
  } else {
    capture = createCapture(mode, { outDir, fps, viewport, size });
  }
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: scene.colorScheme ?? 'light', ...capture.contextOptions() });
  await context.addInitScript({ path: path.join(import.meta.dirname, 'page', 'overlay.page.js') });
  const page = await context.newPage();
  if (process.env.DEBUG) {
    page.on('console', m => ['error', 'warning'].includes(m.type()) && console.log(`[page ${m.type()}]`, m.text().slice(0, 300)));
    page.on('requestfailed', r => console.log('[request failed]', r.url().slice(0, 200), r.failure()?.errorText));
  }
  const ctx: SceneContext = { browser, context, page, outDir, defer, terminal, editor };

  await scene.setup?.(ctx);

  const demo = new Demo(page, capture, viewport, fps);
  terminal?.attach(demo);
  editor?.attach(demo);
  await capture.start(page);
  await scene.run(demo, ctx);
  console.log(`recorded ${(demo.time / 1000).toFixed(1)} s of video in ${((performance.now() - started) / 1000).toFixed(0)} s; encoding…`);
  const mp4 = await capture.finish();
  console.log(path.relative(process.cwd(), mp4));
  // A walkthrough's step marks, for director/walkthrough.ts.
  if (demo.steps.length) await writeFile(path.join(outDir, 'steps.json'), JSON.stringify({ duration: demo.time / 1000, steps: demo.steps }, null, 2));
  if (values.gif) for (const gif of Object.values(await toGif(mp4))) console.log(path.relative(process.cwd(), gif));
} finally {
  await cleanup();
}
