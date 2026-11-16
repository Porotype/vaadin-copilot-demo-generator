// Docs walkthrough: ask AI for a UX detail on one field. Select Phone and ask for its format as a helper text,
// and for the field to accept only that. The AI's answer varies: check the take. Copilot as it is, in the docs
// app's form; the change to ContactView.java is saved next to the take (source.diff). Step texts are in
// docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, askAI, docsScene } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');
const PROMPT = 'Show the expected format as a helper text, and accept only phone numbers in that format';

export default docsScene({
  name: '103-docs-ai-format',
  route: '/contact',
  mode: 'edit',
  ai: true,

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    const phone = page.locator('vaadin-text-field').filter({ has: page.locator('label:text-is("Phone")') }).first();
    const view = { x: 620, y: 250, zoom: 1.8 };
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('ask');
    await demo.zoom({ x: view.x, y: view.y }, view.zoom, { duration: 700 });
    await demo.click(phone, { anchor: { x: 0.6, y: 0.75 }, duration: 900 });
    await demo.waitFor(copilot.badge, { minMs: 400 });
    await askAI(demo, copilot, PROMPT, view);
    await demo.waitFor(phone.locator('[slot="helper"]'), { timeout: 30_000 });
    // The field's badge covers its label: select the view beside the form instead.
    await demo.click({ x: 1000, y: 150 }, { duration: 700 });
    await demo.hold(500);
    demo.outline(phone, { padding: 6 });
    await demo.hold(END_HOLD + 600);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
