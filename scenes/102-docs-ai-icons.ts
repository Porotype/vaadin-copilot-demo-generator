// Docs walkthrough: ask AI about the selection, a change to many components at once. Select the form and ask
// for an icon at the start of every field. The AI's answer varies: check the take. Copilot as it is, in the
// docs app's form; the change to ContactView.java is saved next to the take (source.diff). Step texts are in
// docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, askAI, docsScene } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');
const PROMPT = 'Add a fitting icon to the start of every field';

export default docsScene({
  name: '102-docs-ai-icons',
  route: '/contact',
  mode: 'edit',
  ai: true,

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    const firstName = page.locator('vaadin-text-field').filter({ has: page.locator('label:text-is("First name")') }).first();
    const form = page.locator('vaadin-form-layout').first();
    const label = copilot.badge.locator('[part="badge-label"]');
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('select');
    await demo.zoom({ x: 600, y: 285 }, 1.45, { duration: 700 });
    await demo.click(firstName, { anchor: { x: 0.6, y: 0.75 }, duration: 900 });
    await demo.waitFor(label, { minMs: 300 });
    await demo.press('ArrowLeft');
    await demo.waitFor(async () => ((await label.textContent()) ?? '').trim() === 'FormLayout', { timeout: 5000, minMs: 500 });
    demo.outline(label, { padding: 5 });
    await demo.hold(END_HOLD + 300);

    demo.step('ask');
    demo.clearOutline();
    await askAI(demo, copilot, PROMPT, { x: 600, y: 285, zoom: 1.45 });
    await demo.waitFor(async () => (await form.locator('vaadin-icon, [slot="prefix"]').count()) >= 4, { timeout: 30_000 });
    // The form is selected, and its badge covers the first fields: select the view beside it instead.
    await demo.click({ x: 1000, y: 150 }, { duration: 700 });
    await demo.hold(500);
    demo.outline(form, { padding: 6 });
    await demo.hold(END_HOLD + 600);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
