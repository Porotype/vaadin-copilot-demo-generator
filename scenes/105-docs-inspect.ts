// Docs walkthrough: Inspect mode. Look at the components of a view and their properties without changing
// anything. Copilot as it is, in the docs app's form. Step texts are in docs-content/content.py.
import { END_HOLD, docsScene, zoomToFit } from './support/docs.ts';

export default docsScene({
  name: '105-docs-inspect',
  route: '/contact',
  mode: 'play',
  editsSources: false,

  async run(demo, { page, copilot }) {
    const email = page.locator('vaadin-email-field').first();
    const props = copilot.panel('copilot-component-properties');
    const panelBox = page.locator('vaadin-popover:has(copilot-component-properties)').locator('[part="overlay"]').first();
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('mode');
    await demo.zoom({ x: 1080, y: 600 }, 2.0, { duration: 800 });
    await demo.click(copilot.modeButton('inspect'), { duration: 900 });
    await demo.waitFor(async () => (await copilot.mode()) === 'inspect', { timeout: 5000, minMs: 500 });
    demo.outline(copilot.modeButton('inspect'), { padding: 4 });
    await demo.hold(END_HOLD + 300);

    demo.step('select');
    demo.clearOutline();
    await demo.zoom({ x: 560, y: 230 }, 1.8, { duration: 700 });
    await demo.moveTo(email, { anchor: { x: 0.5, y: 0.75 }, duration: 900 });
    await demo.hold(600);
    await demo.click(email, { anchor: { x: 0.5, y: 0.75 }, duration: 200 });
    await demo.waitFor(copilot.badge, { minMs: 400 });
    demo.outline(copilot.badge, { padding: 3 });
    await demo.hold(END_HOLD + 300);

    demo.step('properties');
    demo.clearOutline();
    await demo.click(copilot.badge.locator('#properties-panel-btn'), { duration: 700 });
    await demo.waitFor(props, { minMs: 300 });
    await zoomToFit(demo, panelBox, 2.0);
    demo.outline(panelBox, { padding: 2 });
    await demo.hold(END_HOLD + 600);
  },
});
