// Docs walkthrough: Views & Routes. See the app's views, add one, and open it. Copilot as it is, in the docs
// app; the new view's class is removed after the take (docs-app.ts guardSources). Step texts are in
// docs-content/content.py.
import { END_HOLD, docsScene, zoomToFit } from './support/docs.ts';

export default docsScene({
  name: '106-docs-routes',
  route: '/contact',
  mode: 'edit',

  async run(demo, { page, copilot }) {
    const panel = page.locator('vaadin-dialog:has(copilot-routes-panel) [part="overlay"]').first();
    const row = (name: string) => page.locator('copilot-routes-panel').getByText(name, { exact: true }).first();
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('open');
    await demo.zoom({ x: 980, y: 560 }, 1.7, { duration: 800 });
    await demo.click(copilot.panelButton('copilot-routes-panel'), { duration: 900 });
    await demo.waitFor(row('ContactView.java'), { minMs: 400 });
    await zoomToFit(demo, panel, 2.0);
    demo.outline(panel, { padding: 2 });
    await demo.hold(END_HOLD + 400);

    demo.step('add');
    demo.clearOutline();
    const add = page.locator('vaadin-button:visible[aria-label*="Add"], vaadin-button:visible[title*="Add"]').first();
    await demo.click(add, { duration: 700 });
    // The Add View dialog opens at the top left, away from the panel.
    const dialog = page.locator('vaadin-dialog:has(copilot-new-route) [part="overlay"]').first();
    const titleField = page.locator('copilot-new-route vaadin-text-field:visible').filter({ has: page.locator('label:text-is("Title")') }).first();
    await demo.waitFor(titleField, { minMs: 300 });
    await zoomToFit(demo, dialog, 2.0, 800);
    await demo.click(titleField, { anchor: { x: 0.3, y: 0.5 }, duration: 600 });
    await demo.type('Contacts', { perChar: 110 });
    await demo.moveTo({ x: 300, y: 330 }, { duration: 500 });
    demo.outline(dialog, { padding: 2 });
    await demo.hold(END_HOLD + 400);

    demo.step('type');
    demo.clearOutline();
    // Scroll down past Flow or Hilla to the templates, a notch at a time so it shows as a scroll.
    await demo.moveTo({ x: 224, y: 330 }, { duration: 400 });
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 42);
      await demo.hold(45);
    }
    const templates = page.locator('copilot-new-route vaadin-radio-group').filter({ hasText: 'Hello World' }).first();
    await demo.waitFor(templates, { minMs: 400 });
    demo.outline(templates, { padding: 4 });
    await demo.hold(END_HOLD + 600);

    demo.step('create');
    demo.clearOutline();
    await demo.click(page.locator('vaadin-button:visible', { hasText: 'Create' }).last(), { duration: 700 });
    await demo.waitFor(row('Contacts.java'), { timeout: 60_000 });
    await demo.waitFor(async () => !(await copilot.busy()), { timeout: 30_000, minMs: 500 });
    // The dialog stays open after Create: close it while it's in the frame.
    await demo.click(page.locator('vaadin-button:visible', { hasText: 'Cancel' }).last(), { duration: 600 });
    await zoomToFit(demo, panel, 2.0, 800);
    demo.outline(row('Contacts.java').locator('xpath=../..'), { padding: 4 });
    await demo.hold(END_HOLD + 300);

    demo.step('go');
    demo.clearOutline();
    await demo.click(page.locator('copilot-routes-panel a', { hasText: '/contacts' }).first(), { duration: 700 });
    await demo.waitFor(page.getByText('This is Contacts').first(), { timeout: 30_000, minMs: 500 });
    await demo.unzoom({ duration: 700 });
    await demo.moveTo({ x: 600, y: 300 }, { duration: 600 });
    await demo.hold(END_HOLD + 500);
  },
});
