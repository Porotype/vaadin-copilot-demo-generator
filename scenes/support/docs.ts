// Walkthroughs for the Copilot docs: short clips, one per step, that a reader steps through at their own
// pace, with the step's text beside the clip in the page rather than on it (docs-content/).
// So no cards or callouts here: at most an outline (demo.outline) where the text says to look, and the
// camera zoomed in so that Copilot's UI reads at a docs column's width.
//
// Recorded in the docs app (apps/docs-app, a fresh start.vaadin.com project; see docs-app.ts), in light and
// dark: DOCS_THEME=dark records the same scene as <name>-dark, with the browser preferring dark (the app and
// Copilot both follow it).
//
//   npm run scene -- scenes/91-docs-edit-text.ts && DOCS_THEME=dark npm run scene -- scenes/91-docs-edit-text.ts
//   npm run walkthrough -- 91-docs-edit-text 91-docs-edit-text-dark
//
// A walkthrough scene marks each step with demo.step(name). Each step loops on its own: start it from a
// state that reads at a glance, and end it on a hold with its outline still on (clear the outline at the
// start of the next step). That last frame is also the step's poster.
import path from 'node:path';
import { Copilot, cacheCopilotPlugins, useDemoMachineConfig } from '../../director/copilot.ts';
import type { Rect } from '../../director/callouts.ts';
import type { Demo, Target } from '../../director/dsl.ts';
import { type Scene, type SceneContext, defineScene } from '../../director/scene.ts';
import type { StageOptions } from '../../director/stage.ts';
import * as app from './docs-app.ts';

const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';

export const THEME: 'light' | 'dark' = process.env.DOCS_THEME === 'dark' ? 'dark' : 'light';

/**
 * 16:10 at 1280×800: a small window, so Copilot's UI is larger in the frame. Recorded at
 * 1440×900 and 30 fps; a step's zoom re-rasterizes, so zoomed text stays sharp.
 */
export const DOCS = { viewport: { width: 1280, height: 800 }, size: { width: 1440, height: 900 }, fps: 30 };

/** Hold at the end of a step before it loops. */
export const END_HOLD = 1400;

/** Zooms so that `target` fills most of the 1280×800 frame, at most `max`×. */
export async function zoomToFit(demo: Demo, target: Target, max = 2.2, duration = 700) {
  const r = (await demo.rectOf(target)) as Rect;
  await demo.zoom(target, Math.min(max, DOCS.viewport.width / (r.w + 160), DOCS.viewport.height / (r.h + 120)), { duration });
}

export interface DocsScene {
  name: string;
  /** Path in the app, e.g. '/contact'. */
  route?: string;
  /** Another app than the docs app, e.g. app.SECURE_URL (the app with a login); it must be running. */
  baseUrl?: string;
  mode?: 'play' | 'inspect' | 'edit' | 'test';
  /** False for walkthroughs that never change the app's files. */
  editsSources?: boolean;
  /** Browser and IDE side by side (director/stage.ts, side 'editor'), for Go to Source. */
  ide?: Pick<StageOptions, 'terminalTitle'>;
  /** Copilot may use AI (the machine's "allow AI usage" answer), for the AI prompt walkthroughs. */
  ai?: boolean;
  /** More of Copilot's machine-wide state for the take, e.g. { recentSwitchedUsernames: [] }. */
  machineState?: Record<string, unknown>;
  setup?(ctx: SceneContext & { copilot: Copilot }): Promise<void>;
  run(demo: Demo, ctx: SceneContext & { copilot: Copilot }): Promise<void>;
}

export function docsScene(s: DocsScene): Scene {
  const editsSources = s.editsSources ?? true;
  return defineScene({
    name: THEME === 'dark' ? `${s.name}-dark` : s.name,
    ...(s.ide
      ? { fps: DOCS.fps, stage: { url: app.URL_LABEL, side: 'editor', label: '', ...s.ide } }
      : DOCS),
    colorScheme: THEME,
    async prepare({ outDir, defer }) {
      await app.assertRunning(s.baseUrl);
      if (editsSources) {
        defer(await app.guardSources());
        const hotReload = app.applyOnChange();
        defer(() => hotReload.close());
      }
      // Copilot doesn't see the Dev Loop's hot swap and would warn that every edit "will feel slow".
      defer(await useDemoMachineConfig({
        dismissNotifications: ['java-modification-no-hotswap'],
        clearPaletteFilter: true,
        set: { ...(s.ai ? { aiUsageAllowed: 'yes' } : {}), ...s.machineState },
      }, outDir));
    },
    async setup(ctx) {
      const { context, page } = ctx;
      await cacheCopilotPlugins(context, path.resolve(import.meta.dirname, '../../.cache/copilot-cdn'));
      await page.addInitScript('window.__name = window.__name || (f => f)');
      // Copilot's App Info shows the browser: a reader's Chrome, not the recorder's headless one.
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.setUserAgentOverride', { userAgent: CHROME_UA, platform: 'MacIntel' });
      await page.goto((s.baseUrl ?? app.BASE_URL) + (s.route ?? '/'));
      const copilot = new Copilot(page);
      await copilot.ready();
      // Copilot's own notices (a new version, tips) aren't part of any walkthrough.
      await page.waitForTimeout(1500);
      for (const close of await page.locator('copilot-notifications-container vaadin-button').all()) await close.click({ force: true }).catch(() => {});
      // Edit mode loads its plugins on first use: load them now, so a switch on camera is instant.
      await copilot.setMode('edit');
      await copilot.setMode(s.mode ?? 'play');
      await hideAccount(page);
      await s.setup?.({ ...ctx, copilot });
      await page.mouse.move(700, 500);
      await page.waitForTimeout(800);
    },
    async run(demo, ctx) {
      await s.run(demo, { ...ctx, copilot: new Copilot(ctx.page) });
    },
  });
}

/**
 * Blurs the signed-in vaadin.com account (name and picture) at the top of Copilot's ⋮ menu. The style
 * goes in before the menu ever opens, so no frame shows it. A page reload drops it: apply it again.
 */
export async function hideAccount(page: import('playwright').Page) {
  await page.evaluate(() => {
    const roots: Array<Document | ShadowRoot> = [document];
    for (let i = 0; i < roots.length; i++) {
      for (const el of roots[i].querySelectorAll('*')) if (el.shadowRoot) roots.push(el.shadowRoot);
    }
    for (const root of roots) {
      const style = document.createElement('style');
      style.textContent = '#user-button { filter: blur(9px); }';
      (root instanceof Document ? root.head : root).append(style);
    }
  });
}

/**
 * Asks Copilot's AI about the selection: opens the prompt from the badge, types `prompt` and sends it. The wait
 * for the answer plays at 10× (it varies from 10 s to a minute); then the camera goes to `view`. Returns once
 * Copilot is idle again and the change it wrote has been applied.
 */
export async function askAI(demo: Demo, copilot: Copilot, prompt: string, view: { x: number; y: number; zoom: number }) {
  const button = copilot.badge.locator('vaadin-button[aria-label="AI prompt"]');
  await demo.click(button, { duration: 600 });
  const input = copilot.page.locator('#prompt-field input').first();
  await demo.waitFor(input, { minMs: 300 });
  // Close enough to read the prompt as it's typed; back to `view` for the answer.
  await demo.zoom(input, 2.4, { duration: 600 });
  await demo.type(prompt, { perChar: 45 });
  await demo.hold(400);
  // The prompt field is a combo box of earlier prompts: Enter would pick from it, the arrow sends.
  await demo.click(copilot.page.locator('vaadin-button#send-btn:visible, vaadin-button[aria-label="Send prompt"]:visible').first(), { duration: 500 });
  let wasBusy = false;
  await demo.waitFor(async () => {
    const busy = await copilot.busy();
    wasBusy ||= busy;
    return wasBusy && !busy;
  }, { timeout: 240_000, speed: 10 });
  // The Dev Loop applies the change after Copilot has written it.
  await demo.zoom({ x: view.x, y: view.y }, view.zoom, { duration: 700 });
  await demo.waitFor(async () => !(await copilot.busy()), { timeout: 30_000, minMs: 1500 });
}
