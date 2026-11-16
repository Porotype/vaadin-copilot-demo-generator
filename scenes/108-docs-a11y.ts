// Docs walkthrough: the Accessibility Checker, in Test mode. Run a check on the view and look at an issue.
// Copilot as it is, in the docs app's form. Step texts are in docs-content/content.py.
import { END_HOLD, docsScene, zoomToFit } from './support/docs.ts';

export default docsScene({
  name: '108-docs-a11y',
  route: '/contact',
  mode: 'play',
  editsSources: false,

  async run(demo, { page, copilot }) {
    const panel = page.locator('#copilot-a11y-checker-dialog [part="overlay"]').first();
    const title = page.getByText('Accessibility Checker', { exact: true });
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('open');
    await demo.zoom({ x: 1080, y: 600 }, 2.0, { duration: 800 });
    await demo.click(copilot.modeButton('test'), { duration: 900 });
    await demo.waitFor(async () => (await copilot.mode()) === 'test', { timeout: 5000, minMs: 300 });
    // Copilot remembers open panels: open the checker only if it isn't.
    if (!(await title.isVisible())) await demo.click(copilot.panelButton('copilot-a11y-checker'), { duration: 700 });
    await demo.waitFor(title, { minMs: 300 });
    await zoomToFit(demo, panel, 2.0);
    demo.outline(panel, { padding: 2 });
    await demo.hold(END_HOLD + 300);

    demo.step('check');
    demo.clearOutline();
    const check = page.locator('vaadin-button:visible').filter({ hasText: /^\s*Check\s*$/ }).last();
    await demo.click(check, { duration: 700 });
    // The panel's content isn't inside the dialog element. Each issue is a button in an li.issue.
    const issue = page.locator('li.issue vaadin-button:visible').filter({ hasText: 'H1 "New Contact"' }).first();
    await demo.waitFor(issue, { timeout: 30_000, minMs: 600 });
    await demo.moveTo({ x: 1000, y: 300 }, { duration: 600 });
    await demo.hold(END_HOLD + 600);

    demo.step('issue');
    await demo.click(issue, { duration: 800 });
    await demo.hold(600);
    await demo.moveTo({ x: 1000, y: 300 }, { duration: 600 });
    await demo.hold(END_HOLD + 1000);
  },
});
