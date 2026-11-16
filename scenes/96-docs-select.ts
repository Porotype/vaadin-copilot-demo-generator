// Docs walkthrough: select components. Click one, then its parent from the context menu's Select submenu, a
// sibling with the arrow keys, and several at once with Ctrl-click. Copilot as it is, in the docs app's form.
// Step texts are in docs-content/content.py.
import { END_HOLD, docsScene } from './support/docs.ts';

export default docsScene({
  name: '96-docs-select',
  route: '/contact',
  mode: 'edit',
  editsSources: false,

  async run(demo, { page, copilot }) {
    const save = page.locator('vaadin-button', { hasText: 'Save' }).first();
    const cancel = page.locator('vaadin-button', { hasText: 'Cancel' }).first();
    const label = copilot.badge.locator('[part="badge-label"]');
    const selected = async (name: string) => ((await label.textContent().catch(() => '')) ?? '').trim().toLowerCase() === name.toLowerCase();
    const area = { x: 520, y: 240 };
    await demo.placeCursor({ x: 760, y: 520 });

    demo.step('click');
    await demo.zoom(area, 1.9, { duration: 700 });
    await demo.click(save, { anchor: { x: 0.6, y: 0.6 }, duration: 900 });
    await demo.waitFor(label, { minMs: 500 });
    demo.outline(label, { padding: 5 });
    await demo.hold(END_HOLD + 300);

    demo.step('parent');
    demo.clearOutline();
    await demo.click(save, { button: 'right', anchor: { x: 0.6, y: 0.6 }, duration: 500 });
    const select = page.getByRole('menuitem', { name: 'Select', exact: true }).first();
    await demo.waitFor(select, { minMs: 300 });
    await demo.moveTo(select, { anchor: { x: 0.3, y: 0.5 }, duration: 600 });
    const parent = page.getByRole('menuitem').filter({ hasText: /^Parent/ }).first();
    await demo.waitFor(parent, { minMs: 600 });
    await demo.moveTo(parent, { anchor: { x: 0.3, y: 0.5 }, duration: 500 });
    await demo.hold(500);
    await demo.click(parent, { anchor: { x: 0.3, y: 0.5 }, duration: 200 });
    await demo.waitFor(() => selected('HorizontalLayout'), { timeout: 5000, minMs: 400 });
    demo.outline(label, { padding: 5 });
    await demo.hold(END_HOLD + 300);

    demo.step('keys');
    demo.clearOutline();
    await demo.hold(500);
    // ↓ selects the first child, then its next sibling: Save, then Cancel.
    await demo.press('ArrowDown');
    await demo.waitFor(() => selected('Button'), { timeout: 5000, minMs: 700 });
    await demo.press('ArrowDown');
    await demo.hold(700);
    demo.outline(label, { padding: 5 });
    await demo.hold(END_HOLD + 300);

    demo.step('several');
    demo.clearOutline();
    await demo.click(save, { anchor: { x: 0.6, y: 0.6 }, duration: 800 });
    await demo.waitFor(() => selected('Button'), { timeout: 5000, minMs: 300 });
    await demo.click(cancel, { anchor: { x: 0.6, y: 0.6 }, modifiers: ['ControlOrMeta'], duration: 700 });
    await demo.hold(600);
    await demo.moveTo({ x: 560, y: 380 }, { duration: 600 });
    await demo.hold(END_HOLD + 300);
  },
});
