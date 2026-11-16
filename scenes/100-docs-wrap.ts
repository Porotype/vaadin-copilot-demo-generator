// Docs walkthrough: wrap components with a layout. Select First name and Last name, and wrap them with a
// Horizontal Layout from the context menu. Copilot as it is, in the docs app's form; the change to
// ContactView.java is saved next to the take (source.diff). Step texts are in docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');

export default docsScene({
  name: '100-docs-wrap',
  route: '/contact',
  mode: 'edit',

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    const field = (label: string) => page.locator('vaadin-text-field').filter({ has: page.locator(`label:text-is("${label}")`) }).first();
    const first = field('First name'), last = field('Last name');
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('select');
    await demo.zoom({ x: 600, y: 285 }, 1.45, { duration: 700 });
    await demo.click(first, { anchor: { x: 0.6, y: 0.75 }, duration: 900 });
    await demo.hold(300);
    await demo.click(last, { anchor: { x: 0.6, y: 0.75 }, modifiers: ['ControlOrMeta'], duration: 700 });
    await demo.waitFor(async () => (await page.locator('copilot-component-info-badge:visible').count()) >= 2, { timeout: 5000, minMs: 400 });
    await demo.moveTo({ x: 700, y: 420 }, { duration: 600 });
    await demo.hold(END_HOLD + 300);

    demo.step('wrap');
    const more = page.locator('copilot-component-info-badge:visible #open-context-menu-btn').last();
    await demo.click(more, { duration: 700 });
    const wrapWith = page.locator('[role=menuitem]:visible').filter({ hasText: 'Wrap with' }).first();
    await demo.waitFor(wrapWith, { minMs: 300 });
    await demo.moveTo(wrapWith, { anchor: { x: 0.3, y: 0.5 }, duration: 600 });
    const horizontal = page.locator('[role=menuitem]:visible').filter({ hasText: 'Horizontal Layout' }).first();
    await demo.waitFor(horizontal, { minMs: 500 });
    await demo.moveTo(horizontal, { anchor: { x: 0.3, y: 0.5 }, duration: 500 });
    await demo.hold(500);
    const w0 = (await first.boundingBox())!.width;
    await demo.click(horizontal, { anchor: { x: 0.3, y: 0.5 }, duration: 150 });
    await demo.waitFor(async () => ((await first.boundingBox())?.width ?? w0) < w0 - 20, { timeout: 30_000 });
    await demo.waitFor(async () => !(await copilot.busy()), { timeout: 30_000, minMs: 600 });
    // The new layout is selected, and its badge covers the fields: select the view beside the form instead.
    await demo.click({ x: 1000, y: 150 }, { duration: 700 });
    await demo.hold(800);
    demo.outline(page.locator('vaadin-horizontal-layout').filter({ has: first }).first(), { padding: 4 });
    await demo.hold(END_HOLD + 400);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
