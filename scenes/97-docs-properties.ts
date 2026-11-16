// Docs walkthrough: change a component's properties. Select the Phone field, open Properties from its badge,
// and give it a helper text. Copilot as it is, in the docs app's form; the change to ContactView.java is saved
// next to the take (source.diff). Step texts are in docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene, zoomToFit } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');
const HELPER = 'With the country code';

export default docsScene({
  name: '97-docs-properties',
  route: '/contact',
  mode: 'edit',

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    const phone = page.locator('vaadin-text-field').filter({ has: page.locator('label:text-is("Phone")') }).first();
    const props = copilot.panel('copilot-component-properties');
    // The panel is a popover from the badge; its box is the popover's overlay.
    const panelBox = page.locator('vaadin-popover:has(copilot-component-properties)').locator('[part="overlay"]').first();
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('open');
    await demo.zoom({ x: 620, y: 260 }, 1.8, { duration: 700 });
    await demo.click(phone, { anchor: { x: 0.7, y: 0.75 }, duration: 900 });
    const button = copilot.badge.locator('#properties-panel-btn');
    await demo.waitFor(button, { minMs: 400 });
    await demo.click(button, { duration: 600 });
    await demo.waitFor(props, { minMs: 300 });
    await zoomToFit(demo, panelBox, 2.0);
    demo.outline(panelBox, { padding: 2 });
    await demo.hold(END_HOLD + 400);

    demo.step('edit');
    demo.clearOutline();
    const helper = props.locator('[data-test-prop-name="helperText"] input');
    await demo.click(helper, { anchor: { x: 0.3, y: 0.5 }, duration: 700 });
    await demo.type(HELPER, { perChar: 70 });
    await demo.press('Enter');
    await demo.waitFor(phone.locator('[slot="helper"]', { hasText: HELPER }), { timeout: 30_000 });
    await demo.waitFor(async () => !(await copilot.busy()), { timeout: 30_000, minMs: 600 });
    // Close the panel and click beside the form, so that the field's badge doesn't cover its label.
    await demo.hold(500);
    await demo.click(page.locator('vaadin-popover:has(copilot-component-properties) [aria-label="Close"]').first(), { duration: 600 });
    await demo.zoom({ x: 620, y: 230 }, 1.9, { duration: 800 });
    await demo.click({ x: 960, y: 300 }, { duration: 600 });
    await demo.hold(300);
    demo.outline(phone, { padding: 6 });
    await demo.hold(END_HOLD + 400);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
