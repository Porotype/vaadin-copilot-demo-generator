// Docs walkthrough: the Copilot toolbar. Where it is, its modes and its ⋮ menu. Copilot as it is, in the docs
// app's task list; the step texts are in docs-content/content.py (no text on the clips).
import { END_HOLD, docsScene } from './support/docs.ts';

export default docsScene({
  name: '90-docs-toolbar',
  route: '/',
  mode: 'play',
  editsSources: false,

  async run(demo, { page, copilot }) {
    const toolbar = page.locator('copilot-toolbar').first();
    await demo.placeCursor({ x: 760, y: 420 });

    demo.step('where');
    await demo.hold(700);
    await demo.zoom({ x: 1050, y: 680 }, 2.2, { duration: 900 });
    await demo.moveTo(copilot.devtoolsButton, { duration: 1100, anchor: { x: -2.5, y: 0.5 } });
    await demo.hold(500);
    demo.outline(toolbar, { padding: 6 });
    await demo.hold(END_HOLD + 400);

    demo.step('modes');
    demo.clearOutline();
    await demo.zoom(page.locator('#mode-icon-container').first(), 2.4, { duration: 600 });
    for (const mode of ['inspect', 'edit', 'test', 'play'] as const) {
      await demo.click(copilot.modeButton(mode), { duration: 550 });
      await demo.hold(900);
    }
    await demo.hold(END_HOLD - 600);

    demo.step('menu');
    await demo.zoom({ x: 1080, y: 590 }, 1.9, { duration: 600 });
    await demo.click(copilot.devtoolsButton);
    const menu = page.locator('#devtools-popover').first();
    await demo.waitFor(copilot.devtoolsItem('Features'), { minMs: 500 });
    // No outline: the menu is a popover, drawn over the director's overlay. It stays open to the step's end.
    await demo.moveTo(copilot.devtoolsItem('App Info'), { anchor: { x: 0.3, y: 0.5 }, duration: 700 });
    await demo.hold(END_HOLD + 600);
  },
});
