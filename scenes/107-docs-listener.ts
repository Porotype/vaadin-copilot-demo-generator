// Docs walkthrough: Add Listener. Add a click listener to the Cancel button; Copilot writes the stub, and the
// IDE opens at it. Real: Copilot, its context menu and the code it writes. Staged: the IDE (director/editor.ts)
// beside the browser, showing the changed ContactView.java at the new listener, as the IDE plugin would.
// The change is saved next to the take (source.diff). Step texts are in docs-content/content.py.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene } from './support/docs.ts';

const CRUMBS = 'my-app › src › main › java › com.example';
const VIEW = app.javaFile('contacts/ui/ContactView.java');

export default docsScene({
  name: '107-docs-listener',
  route: '/contact',
  mode: 'edit',
  ide: { terminalTitle: 'my-app – IDE' },

  async run(demo, { page, copilot, editor, outDir }) {
    const ide = editor!;
    const original = await app.read('contacts/ui/ContactView.java');
    ide.open('ContactView.java', original, { crumbs: `${CRUMBS}.contacts.ui` });
    const cancel = page.locator('vaadin-button', { hasText: 'Cancel' }).first();
    const item = (text: string) => page.locator('[role="menuitem"]:visible', { hasText: text }).first();
    await demo.placeCursor({ x: 800, y: 600 });

    demo.step('menu');
    await demo.hold(500);
    // The browser is the smaller window here: zoom in on it for the menu (the IDE's side doesn't zoom).
    await demo.zoom({ x: 460, y: 400 }, 2.0, { duration: 700 });
    await demo.click(cancel, { duration: 800 });
    await demo.hold(300);
    await demo.click(cancel, { button: 'right', duration: 200 });
    await demo.waitFor(item('Add Listener'), { minMs: 400 });
    await demo.moveTo(item('Add Listener'), { anchor: { x: 0.35, y: 0.5 }, duration: 600 });
    await demo.waitFor(item('Add Click Listener'), { minMs: 300 });
    await demo.moveTo(item('Add Click Listener'), { anchor: { x: 0.3, y: 0.5 }, duration: 600 });
    await demo.hold(END_HOLD);

    // The IDE's text is small on the split stage: this step keeps the IDE's part of the frame (16:10).
    demo.step('ide', { crop: { x: 1120, y: 560, w: 768, h: 480 } });
    await demo.click(item('Add Click Listener'), { anchor: { x: 0.3, y: 0.5 }, duration: 150 });
    await demo.waitFor(async () => (await readFile(VIEW, 'utf8')) !== original, { timeout: 30_000 });
    await demo.waitFor(async () => !(await copilot.busy()), { timeout: 30_000, minMs: 300 });
    await demo.unzoom({ duration: 500 });
    const source = await readFile(VIEW, 'utf8');
    ide.open('ContactView.java', source, { crumbs: `${CRUMBS}.contacts.ui` });
    const line = ide.lineOf('addClickListener');
    ide.reveal(line);
    ide.caretAt(line + 1, 0);
    await demo.hold(END_HOLD + 1200);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
