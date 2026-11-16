// Docs walkthrough: impersonate a user. In an app with a login (the docs app's secure profile, on :8085), sign in as
// `user` from the login page without a password, then switch to `admin`: the side nav gains the admin-only
// views (both steps end on it, in the same view). Copilot as it is; the app's users and views are in apps/docs-app/README.md. Step texts are in docs-content/content.py.
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene, hideAccount } from './support/docs.ts';

export default docsScene({
  name: '110-docs-impersonate',
  baseUrl: app.SECURE_URL,
  route: '/',
  mode: 'play',
  editsSources: false,
  // Copilot lists the usernames switched to before, machine-wide: start with none.
  machineState: { recentSwitchedUsernames: [] },

  async run(demo, { page, copilot }) {
    const panel = page.locator('copilot-impersonator').first();
    const username = panel.locator('vaadin-text-field input').first();
    const nav = page.locator('vaadin-side-nav').first();
    const footer = page.locator('.app-footer').first();
    const open = async () => {
      await demo.click(copilot.devtoolsButton, { duration: 800 });
      await demo.waitFor(copilot.devtoolsItem('Impersonate'), { minMs: 300 });
      await demo.click(copilot.devtoolsItem('Impersonate'), { duration: 600 });
      await demo.waitFor(username, { minMs: 300 });
    };
    /** Switches to `name`; the page reloads, with the panel open again. */
    const switchTo = async (name: string) => {
      await demo.click(username, { anchor: { x: 0.4, y: 0.5 }, duration: 600 });
      await demo.type(name, { perChar: 110 });
      await demo.hold(400);
      await demo.click(panel.locator('vaadin-button', { hasText: 'Switch User' }).first(), { duration: 600 });
      await demo.waitFor(async () => (await footer.textContent().catch(() => ''))?.includes(name) ?? false, { timeout: 30_000 });
      await copilot.ready();
      // The reload brings back the Vaadin account in the ⋮ menu.
      await hideAccount(page);
      await demo.waitFor(username, { minMs: 600 });
    };
    /** The panel's ×, which isn't inside its DOM: the visible Close button level with its heading. */
    const close = async () => {
      const heading = (await page.getByText('Impersonate User', { exact: true }).first().boundingBox())!;
      let target = null;
      for (const c of await page.locator('vaadin-button[aria-label="Close"]:visible').all()) {
        const b = await c.boundingBox();
        if (b && b.x > heading.x && Math.abs(b.y + b.height / 2 - (heading.y + heading.height / 2)) < 20) target = c;
      }
      await demo.click(target!, { duration: 700 });
    };
    /**
     * The panel's box. Its element is display: contents, and the first ancestor with a box is the content under
     * the header: that, from the top of the header.
     */
    const panelBox = async () => {
      const content = await panel.evaluate((el) => {
        let e: Element | null = el;
        while (e) {
          const r = e.getBoundingClientRect();
          if (r.width > 300 && r.height > 300) return { x: r.x, y: r.y, w: r.width, h: r.height };
          e = e.parentElement ?? ((e.getRootNode() as ShadowRoot).host ?? null);
        }
        return null;
      });
      const heading = await page.getByText('Impersonate User', { exact: true }).first().boundingBox();
      if (!content || !heading) return null;
      const top = heading.y - 14;
      return { x: content.x, y: top, w: content.w, h: content.y + content.h - top };
    };
    await demo.placeCursor({ x: 900, y: 600 });

    demo.step('open');
    await demo.hold(600);
    await open();
    // The panel and the login form, side by side.
    await demo.zoom({ x: 410, y: 270 }, 1.4, { duration: 700 });
    await demo.click(username, { anchor: { x: 0.4, y: 0.5 }, duration: 600 });
    await demo.type('user', { perChar: 110 });
    await demo.moveTo({ x: 600, y: 560 }, { duration: 500 });
    demo.outline(panelBox, { padding: 2 });
    await demo.hold(END_HOLD + 300);

    demo.step('in');
    demo.clearOutline();
    await demo.click(panel.locator('vaadin-button', { hasText: 'Switch User' }).first(), { duration: 600 });
    await demo.waitFor(async () => (await footer.textContent().catch(() => ''))?.includes('user') ?? false, { timeout: 30_000 });
    await copilot.ready();
    await hideAccount(page);
    await demo.waitFor(username, { minMs: 600 });
    await demo.unzoom({ duration: 600 });
    await close();
    // The same view as the next step's end: the side nav, with the views this user may open.
    await demo.zoom({ x: 200, y: 150 }, 2.0, { duration: 700 });
    await demo.moveTo({ x: 450, y: 300 }, { duration: 500 });
    demo.outline(nav, { padding: 4 });
    await demo.hold(END_HOLD + 600);

    demo.step('switch');
    demo.clearOutline();
    await demo.unzoom({ duration: 600 });
    await open();
    await switchTo('admin');
    await close();
    await demo.zoom({ x: 200, y: 150 }, 2.0, { duration: 700 });
    await demo.moveTo({ x: 450, y: 300 }, { duration: 500 });
    demo.outline(nav, { padding: 4 });
    await demo.hold(END_HOLD + 900);
  },
});
