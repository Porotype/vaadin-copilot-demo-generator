// Docs walkthrough: edit text in place. Edit mode, the file Copilot edits, double-click and type. Copilot
// as it is, in the docs app's form; the change to ContactView.java is saved next to the take (source.diff)
// for the page's code step. The step texts are in docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');

export default docsScene({
  name: '91-docs-edit-text',
  route: '/contact',

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    await demo.placeCursor({ x: 760, y: 420 });

    demo.step('edit-mode');
    await demo.hold(500);
    await demo.zoom({ x: 1050, y: 680 }, 2.2, { duration: 800 });
    await demo.click(copilot.modeButton('edit'), { duration: 1000 });
    await demo.hold(900);
    await demo.moveTo({ x: 900, y: 520 }, { duration: 700 });
    await demo.unzoom({ duration: 800 });
    await demo.hold(END_HOLD);

    demo.step('context', { still: true });
    const editing = page.locator('copilot-drill-highlighter-component > div', { hasText: 'Editing' }).first();
    demo.outline(editing, { padding: 4, fadeMs: 1 });
    await demo.hold(400);

    demo.step('double-click');
    demo.clearOutline();
    const save = page.locator('vaadin-button', { hasText: 'Save' }).first();
    await demo.zoom({ x: 420, y: 230 }, 2.0, { duration: 700 });
    await demo.moveTo(save, { anchor: { x: 0.5, y: 0.55 }, duration: 800 });
    await demo.hold(300);
    await page.mouse.dblclick(demo.cursorPosition.x, demo.cursorPosition.y);
    await demo.waitFor(page.locator('copilot-label-editor #textarea'), { timeout: 5000, minMs: 400 });
    await page.keyboard.press('ControlOrMeta+A');
    await demo.type('Save contact', { perChar: 100 });
    await demo.hold(400);
    await demo.press('Enter');
    await demo.waitFor(page.locator('vaadin-button', { hasText: 'Save contact' }), { timeout: 30_000 });
    await demo.moveTo({ x: 640, y: 380 }, { duration: 600 });
    await demo.hold(END_HOLD + 400);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
