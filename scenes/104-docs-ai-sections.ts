// Docs walkthrough: ask AI for a change to a view's structure. Select the view and ask it to split the form
// into two sections with headings. (Asked to "fix the paddings and spacing", it set what were mostly the
// defaults already: nothing to see.) The AI's answer varies: check the take. Copilot as it is, in the docs app's form; the
// change to ContactView.java is saved next to the take (source.diff). Step texts are in
// docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, askAI, docsScene } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');
const PROMPT = 'Split the form into two forms, each under an H3 heading: Name, and Contact details';

export default docsScene({
  name: '104-docs-ai-sections',
  route: '/contact',
  mode: 'edit',
  ai: true,

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    const label = copilot.badge.locator('[part="badge-label"]');
    const view = { x: 590, y: 240, zoom: 1.5 };
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('ask');
    await demo.zoom({ x: view.x, y: view.y }, view.zoom, { duration: 700 });
    // Beside the form is the view itself, a VerticalLayout.
    await demo.click({ x: 950, y: 150 }, { duration: 900 });
    await demo.waitFor(async () => ((await label.textContent()) ?? '').trim() === 'VerticalLayout', { timeout: 5000, minMs: 400 });
    await askAI(demo, copilot, PROMPT, view);
    // A heading inside the one form takes a cell of its grid, beside a field: that take is no good.
    if ((await page.locator('vaadin-form-layout').count()) < 2) throw new Error('The AI kept one form: retake');
    // A heading made with ViewTitle comes with a drawer toggle of its own.
    if ((await page.locator('vaadin-drawer-toggle').count()) > 1) throw new Error('The AI used ViewTitle for the headings: retake');
    // Click beside the form to close the prompt, which stays open over the view.
    await demo.click({ x: 950, y: 120 }, { duration: 700 });
    await demo.moveTo({ x: 900, y: 430 }, { duration: 600 });
    await demo.hold(END_HOLD + 1000);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
