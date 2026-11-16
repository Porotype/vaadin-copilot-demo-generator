// Docs walkthrough: spacing and alignment from a layout's badge. Select the buttons' HorizontalLayout, turn its
// padding on, then select the view and center its contents. Copilot as it is, in the docs app's form; the change to
// ContactView.java is saved next to the take (source.diff). Step texts are in docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');

export default docsScene({
  name: '98-docs-layout',
  route: '/contact',
  mode: 'edit',

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    const save = page.locator('vaadin-button', { hasText: 'Save' }).first();
    const label = copilot.badge.locator('[part="badge-label"]');
    const selected = async (name: string) => ((await label.textContent().catch(() => '')) ?? '').trim().toLowerCase() === name.toLowerCase();
    const settled = () => demo.waitFor(async () => !(await copilot.busy()), { timeout: 30_000, minMs: 600 });
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('select');
    await demo.zoom({ x: 520, y: 260 }, 1.9, { duration: 700 });
    await demo.click(save, { anchor: { x: 0.6, y: 0.6 }, duration: 900 });
    await demo.waitFor(label, { minMs: 400 });
    await demo.press('ArrowLeft');
    await demo.waitFor(() => selected('HorizontalLayout'), { timeout: 5000, minMs: 500 });
    demo.outline(copilot.badge, { padding: 3 });
    await demo.hold(END_HOLD + 300);

    demo.step('padding');
    demo.clearOutline();
    const pad = copilot.badge.locator('button[role="switch"]:visible').first();
    const y0 = (await save.boundingBox())!.y;
    await demo.click(pad, { duration: 700 });
    await demo.waitFor(async () => ((await save.boundingBox())?.y ?? y0) > y0 + 5, { timeout: 30_000 });
    await settled();
    // The layout's badge now covers its buttons. Beside the form is the view itself, a VerticalLayout, whose
    // badge is at its top: select it, and outline the buttons' layout, padding and all.
    await demo.click({ x: 1000, y: 150 }, { duration: 700 });
    await demo.waitFor(() => selected('VerticalLayout'), { timeout: 5000, minMs: 300 });
    demo.outline(page.locator('vaadin-horizontal-layout').filter({ has: save }).first(), { padding: 0 });
    await demo.hold(END_HOLD + 300);

    demo.step('align');
    demo.clearOutline();
    await demo.zoom({ x: 752, y: 230 }, 1.27, { duration: 700 });
    await demo.click(copilot.badge.locator('#alignment-btn'), { duration: 700 });
    const center = page.locator('vaadin-radio-button[value="center"]:visible').first();
    await demo.waitFor(center, { minMs: 400 });
    const x0 = (await save.boundingBox())!.x;
    await demo.click(center, { duration: 600 });
    await demo.waitFor(async () => ((await save.boundingBox())?.x ?? x0) > x0 + 50, { timeout: 30_000 });
    await settled();
    await demo.press('Escape');
    await demo.moveTo({ x: 1000, y: 420 }, { duration: 600 });
    await demo.hold(END_HOLD + 400);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
