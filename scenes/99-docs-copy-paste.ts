// Docs walkthrough: duplicate, delete, copy and paste, from the context menu (the ⋮ in a badge). Duplicate the Cancel button,
// delete the copy, then copy the Phone field and paste it after Country. Copilot as it is, in the docs app's
// form; the change to ContactView.java is saved next to the take (source.diff). Step texts are in
// docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Locator } from 'playwright';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');

export default docsScene({
  name: '99-docs-copy-paste',
  route: '/contact',
  mode: 'edit',
  // Copy and Paste go through the browser's clipboard.
  async setup({ context }) {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: app.BASE_URL });
  },

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactView.java');
    const cancels = page.locator('vaadin-button', { hasText: 'Cancel' });
    const field = (label: string) => page.locator('vaadin-text-field, vaadin-combo-box').filter({ has: page.locator(`label:text-is("${label}")`) });
    const settled = () => demo.waitFor(async () => !(await copilot.busy()), { timeout: 30_000, minMs: 600 });
    /**
     * Selects `target` and picks `item` from its context menu, opened from the ⋮ in its badge: a field's badge
     * sits over the field, so a right-click there would land on the badge.
     */
    const point = async (target: Locator, item: string) => {
      await demo.click(target, { anchor: { x: 0.6, y: 0.6 }, duration: 700 });
      const more = copilot.badge.locator('#open-context-menu-btn');
      await demo.waitFor(more, { minMs: 300 });
      await demo.click(more, { duration: 500 });
      const entry = page.locator('[role=menuitem]:visible').filter({ hasText: item }).first();
      await demo.waitFor(entry, { minMs: 300 });
      await demo.moveTo(entry, { anchor: { x: 0.3, y: 0.5 }, duration: 600 });
      return entry;
    };
    const menu = async (target: Locator, item: string) => {
      const entry = await point(target, item);
      await demo.hold(500);
      await demo.click(entry, { anchor: { x: 0.3, y: 0.5 }, duration: 150 });
    };
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('duplicate');
    // Wide enough for the context menus, which open below and beside the badge.
    await demo.zoom({ x: 620, y: 330 }, 1.45, { duration: 700 });
    await menu(cancels.first(), 'Duplicate');
    await demo.waitFor(async () => (await cancels.count()) === 2, { timeout: 30_000 });
    await settled();
    demo.outline(cancels.nth(1), { padding: 4 });
    await demo.hold(END_HOLD + 300);

    demo.step('delete');
    demo.clearOutline();
    await menu(cancels.nth(1), 'Delete');
    await demo.waitFor(async () => (await cancels.count()) === 1, { timeout: 30_000 });
    await settled();
    await demo.moveTo({ x: 560, y: 420 }, { duration: 600 });
    await demo.hold(END_HOLD + 300);

    // Copying shows nothing: the step ends on the menu, and the next one starts with the click.
    demo.step('copy');
    const copy = await point(field('Phone').first(), 'Copy');
    await demo.hold(END_HOLD);

    demo.step('paste');
    await demo.click(copy, { anchor: { x: 0.3, y: 0.5 }, duration: 150 });
    await demo.hold(400);
    await menu(field('Country').first(), 'Paste');
    await demo.waitFor(async () => (await field('Phone').count()) === 2, { timeout: 30_000 });
    await settled();
    // The copy is selected, and its badge covers it: select the view beside the form instead.
    await demo.click({ x: 1000, y: 150 }, { duration: 700 });
    await demo.hold(300);
    demo.outline(field('Phone').nth(1), { padding: 4 });
    await demo.hold(END_HOLD + 400);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(VIEW, original));
  },
});
