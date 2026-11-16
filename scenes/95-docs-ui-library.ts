// Docs walkthrough: add a component from the UI Library. Open it, search, and drag a Checkbox in between the
// form and its buttons. Copilot as it is, in the docs app's form; the change to ContactView.java is saved
// next to the take (source.diff). Step texts are in docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene, zoomToFit } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');

export default docsScene({
  name: '95-docs-ui-library',
  route: '/contact',
  mode: 'edit',

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    const checkbox = page.locator('vaadin-checkbox').first();
    // The whole panel, its header included: the dialog's overlay.
    const library = page.locator('#copilot-palette-dialog [part="overlay"]').first();
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('open');
    await demo.zoom({ x: 980, y: 560 }, 1.7, { duration: 800 });
    await demo.click(copilot.paletteButton, { duration: 900 });
    await demo.waitFor(copilot.palette, { minMs: 300 });
    await zoomToFit(demo, library);
    demo.outline(library, { padding: 2 });
    await demo.hold(END_HOLD + 400);

    demo.step('search');
    demo.clearOutline();
    await demo.zoom(copilot.paletteSearch, 2.2, { duration: 700 });
    await demo.click(copilot.paletteSearch, { anchor: { x: 0.3, y: 0.5 }, duration: 700 });
    await demo.type('check', { perChar: 110 });
    const item = copilot.paletteItem('Checkbox').first();
    await demo.waitFor(item, { minMs: 500 });
    demo.outline(item, { padding: 4 });
    await demo.hold(END_HOLD);

    demo.step('drag');
    demo.clearOutline();
    await demo.zoom({ x: 560, y: 330 }, 1.5, { duration: 700 });
    await demo.dragStart(item, { anchor: { x: 0.3, y: 0.5 } });
    // The strip between the form and its buttons: a drop there goes into the view, between the two.
    await demo.dragTo({ x: 420, y: 281 }, { duration: 1500 });
    await demo.hold(1100);
    await demo.drop();
    await demo.waitFor(checkbox, { timeout: 30_000 });
    await demo.waitFor(async () => !(await copilot.busy()), { timeout: 30_000, minMs: 800 });
    // The UI Library opens again after a drop, and the checkbox's badge covers the buttons: close the one and
    // click beside the form, which selects the view, whose badge is at its top right, outside the frame.
    await demo.hold(500);
    // Its × isn't inside the dialog's DOM; it's the visible Close button within the panel's box.
    const box = (await library.boundingBox())!;
    const close = page.locator('vaadin-button[aria-label="Close"]:visible').filter({ visible: true });
    let closeButton = close.first();
    for (const c of await close.all()) {
      const b = await c.boundingBox();
      if (b && b.x > box.x && b.x < box.x + box.width && b.y > box.y && b.y < box.y + 60) closeButton = c;
    }
    await demo.click(closeButton, { duration: 700 });
    await demo.zoom({ x: 530, y: 225 }, 2.2, { duration: 700 });
    await demo.click({ x: 760, y: 318 }, { duration: 600 });
    await demo.hold(END_HOLD + 300);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
