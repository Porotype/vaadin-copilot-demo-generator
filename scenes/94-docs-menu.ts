// Docs clips: the ⋮ menu, one per item: App Info, App Log, Features, Feedback, Settings, each from the menu
// closed to the panel it opens (the menu itself is in 90-docs-toolbar). Copilot as it is, in the docs app (no
// Spring Security without the secure profile, so no Impersonate item); the signed-in account at the top is blurred. Step texts are in docs-content/content.py.
import { END_HOLD, docsScene, zoomToFit } from './support/docs.ts';

const ITEMS = [
  { step: 'app-info', item: 'App Info', panel: 'copilot-info-panel' },
  { step: 'app-log', item: 'App Log', panel: 'copilot-log-panel' },
  { step: 'features', item: 'Features', panel: 'copilot-features-panel' },
  { step: 'feedback', item: 'Feedback', panel: 'copilot-feedback-panel' },
  { step: 'settings', item: 'Settings', panel: 'copilot-settings-panel' },
];

export default docsScene({
  name: '94-docs-menu',
  route: '/',
  mode: 'play',
  editsSources: false,

  async run(demo, { page, copilot }) {
    const menuArea = { x: 1080, y: 560 };
    const rest = { x: 760, y: 420 };
    const dialog = (tag: string) => page.locator(`vaadin-dialog[data-panel-tag="${tag}"]`);
    const panelBox = (tag: string) => copilot.panel(tag).locator('xpath=..');
    await demo.placeCursor(rest);

    // One clip per item, each from the whole page with the menu closed: the docs show them in sections of
    // their own. Closing the panel and going back is between the clips, in none of them.
    for (const { step, item, panel } of ITEMS) {
      demo.step(step);
      await demo.hold(600);
      await demo.zoom(menuArea, 1.9, { duration: 800 });
      await demo.click(copilot.devtoolsButton, { duration: 900 });
      await demo.waitFor(copilot.devtoolsItem(item), { minMs: 500 });
      await demo.click(copilot.devtoolsItem(item), { anchor: { x: 0.3, y: 0.5 }, duration: 700 });
      await demo.waitFor(copilot.panel(panel), { timeout: 10_000, minMs: 400 });
      await zoomToFit(demo, panelBox(panel));
      await demo.moveTo(panelBox(panel), { anchor: { x: 0.75, y: 0.6 }, duration: 600 });
      await demo.hold(END_HOLD + 1000);

      demo.between();
      await demo.click(dialog(panel).locator('[aria-label="Close"]').first(), { duration: 400 });
      await demo.unzoom({ duration: 300 });
      await demo.placeCursor(rest);
      await demo.hold(300);
    }
  },
});
