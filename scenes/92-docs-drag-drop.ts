// Docs walkthrough: move components by drag and drop, in the view and in the Outline. Copilot as it is, in
// the docs app's form; the change to ContactView.java is saved next to the take (source.diff). Step texts
// are in docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');

export default docsScene({
  name: '92-docs-drag-drop',
  route: '/contact',
  mode: 'edit',

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    const field = (label: string) => page.locator('vaadin-text-field, vaadin-email-field, vaadin-date-picker, vaadin-combo-box').filter({ has: page.locator(`label:text-is("${label}")`) }).first();
    const phone = field('Phone'), email = field('Email');
    await demo.placeCursor({ x: 900, y: 500 });

    demo.step('select');
    await demo.zoom({ x: 530, y: 190 }, 1.7, { duration: 700 });
    await demo.click(phone, { anchor: { x: 0.7, y: 0.75 }, duration: 900 });
    const handle = copilot.badge.locator('[part="badge-label"]');
    await demo.waitFor(handle, { minMs: 500 });
    demo.outline(handle, { padding: 5 });
    await demo.hold(END_HOLD + 300);

    demo.step('drag');
    demo.clearOutline();
    const x0 = (await phone.boundingBox())!.x;
    await demo.dragStart(handle, { ghostFrom: phone });
    // In a FormLayout, the drop points are 10 px strips just inside each field's left edge: this one is "before
    // Email". Left of it is the view (a "Place component" dialog), right of it the field's own slots.
    // Below the last field, a drop lands outside the form, in the view (docs/findings.md).
    await demo.dragTo(email, { anchor: { x: 0, y: 0.6 }, offset: { x: 5, y: 0 }, duration: 1600 });
    await demo.hold(900);
    await demo.drop();
    await demo.waitFor(async () => ((await phone.boundingBox())?.x ?? x0) < x0 - 100, { timeout: 30_000 });
    if (!(await phone.evaluate(e => e.parentElement?.localName === 'vaadin-form-layout'))) throw new Error('Phone was dropped outside the form');
    await demo.moveTo({ x: 900, y: 420 }, { duration: 600 });
    await demo.hold(END_HOLD);

    demo.step('outline-open');
    await demo.unzoom({ duration: 600 });
    await demo.click(copilot.panelButton('copilot-outline-panel'), { duration: 900 });
    const outline = copilot.panel('copilot-outline-panel');
    // The panel element itself has no box (display: contents); its parent has.
    const outlineBox = outline.locator('xpath=..');
    const row = (text: string) => outline.locator('vaadin-grid-tree-toggle', { hasText: text }).first();
    await demo.waitFor(row('Birthday'), { minMs: 500 });
    await demo.moveTo(outlineBox, { anchor: { x: 0.5, y: 0.4 }, duration: 700 });
    demo.outline(outlineBox, { padding: 2 });
    await demo.hold(END_HOLD + 300);

    demo.step('outline-drag');
    demo.clearOutline();
    await demo.zoom(outlineBox, 1.8, { duration: 700 });
    await demo.dragStart(row('Birthday'), { anchor: { x: 0.4, y: 0.5 } });
    await demo.dragTo(row('First name'), { anchor: { x: 0.4, y: 0.15 }, duration: 1100 });
    await demo.hold(800);
    const first = field('Birthday');
    const b0 = (await first.boundingBox())!.y;
    await demo.drop();
    await demo.waitFor(async () => ((await first.boundingBox())?.y ?? b0) < b0 - 40, { timeout: 30_000 });
    await demo.zoom({ x: 530, y: 190 }, 1.5, { duration: 800 });
    await demo.hold(END_HOLD);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
