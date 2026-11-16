// Docs walkthrough: Extract to Inner Component. Select the form and extract it into a component class of its
// own, inside the view's class; Copilot then selects it, as one component. Copilot as it is, in the docs app; the
// change to ContactView.java is saved next to the take (source.diff). Step texts are in docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');

export default docsScene({
  name: '109-docs-extract',
  route: '/contact',
  mode: 'edit',

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    const field = (label: string) => page.locator('vaadin-text-field').filter({ has: page.locator(`label:text-is("${label}")`) }).first();
    const label = copilot.badge.locator('[part="badge-label"]');
    const labelIs = (text: string) => async () => ((await label.textContent().catch(() => '')) ?? '').trim() === text;
    const entry = page.locator('[role=menuitem]:visible').filter({ hasText: 'Extract to Inner Component' }).first();
    await demo.placeCursor({ x: 900, y: 520 });

    demo.step('extract');
    await demo.zoom({ x: 600, y: 285 }, 1.45, { duration: 700 });
    await demo.click(field('First name'), { anchor: { x: 0.6, y: 0.6 }, duration: 800 });
    await demo.hold(300);
    await demo.press('ArrowLeft');
    await demo.waitFor(labelIs('FormLayout'), { timeout: 5000, minMs: 400 });
    await demo.click(copilot.badge.locator('#open-context-menu-btn'), { duration: 600 });
    await demo.waitFor(entry, { minMs: 300 });
    await demo.moveTo(entry, { anchor: { x: 0.3, y: 0.5 }, duration: 600 });
    await demo.hold(END_HOLD);

    demo.step('result');
    await demo.click(entry, { anchor: { x: 0.3, y: 0.5 }, duration: 150 });
    // Wide enough for Copilot's notice at the top right, which closes by itself after a few seconds.
    await demo.zoom({ x: 760, y: 230 }, 1.15, { duration: 700 });
    await demo.moveTo({ x: 900, y: 420 }, { duration: 500 });
    await demo.waitFor(labelIs('ContactView$MyComponent'), { timeout: 30_000 });
    await demo.waitFor(async () => !(await copilot.busy()), { timeout: 30_000, minMs: 1200 });
    demo.outline(copilot.badge, { padding: 3 });
    await demo.hold(END_HOLD + 1200);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
