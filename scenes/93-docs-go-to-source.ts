// Docs walkthrough: Go to Source. Right-click a component, Go to Source, and the IDE opens at the line that
// creates it. Real: Copilot, its context menu and Go to Source. Staged: the IDE (director/editor.ts) beside
// the browser; it shows the real ContactView.java at the line Copilot points to, as the IDE plugin would.
// Step texts are in docs-content/content.py.
import { readFile } from 'node:fs/promises';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene } from './support/docs.ts';

const CRUMBS = 'my-app › src › main › java › com.example';

export default docsScene({
  name: '93-docs-go-to-source',
  route: '/contact',
  mode: 'edit',
  editsSources: false,
  ide: { terminalTitle: 'my-app – IDE' },

  async run(demo, { page, editor }) {
    const ide = editor!;
    ide.open('TaskListView.java', await app.read('examplefeature/ui/TaskListView.java'), { crumbs: `${CRUMBS}.examplefeature.ui` });
    const save = page.locator('vaadin-button', { hasText: 'Save' }).first();
    await demo.placeCursor({ x: 800, y: 600 });

    demo.step('context-menu');
    await demo.hold(500);
    // The browser is the smaller window here: zoom in on it for the menu (the IDE's side doesn't zoom).
    await demo.zoom({ x: 420, y: 380 }, 2.0, { duration: 700 });
    await demo.click(save, { button: 'right', duration: 900 });
    const item = (text: string) => page.locator('[role="menuitem"]:visible', { hasText: text }).first();
    await demo.waitFor(item('Go to Source'), { minMs: 400 });
    // Go to Source opens its submenu: where the component was created, and where it was attached.
    await demo.moveTo(item('Go to Source'), { anchor: { x: 0.35, y: 0.5 }, duration: 600 });
    await demo.waitFor(item('Instance created'), { minMs: 300 });
    await demo.moveTo(item('Instance created'), { anchor: { x: 0.3, y: 0.5 }, duration: 600 });
    await demo.hold(END_HOLD);

    // The IDE's text is small on the split stage: this step keeps the IDE's part of the frame (16:10), from
    // the browser's edge to the end of the code lines, around the line Go to Source lands on.
    demo.step('ide', { crop: { x: 1120, y: 560, w: 768, h: 480 } });
    await demo.click(item('Instance created'), { anchor: { x: 0.3, y: 0.5 }, duration: 150 });
    await demo.unzoom({ duration: 500 });
    // The IDE comes to the front at the line that creates the button.
    const source = await readFile(app.javaFile('contacts/ui/ContactView.java'), 'utf8');
    ide.open('ContactView.java', source, { crumbs: `${CRUMBS}.contacts.ui` });
    const line = ide.lineOf('new Button("Save"');
    ide.reveal(line);
    ide.caretAt(line, ide.text.split('\n')[line - 1].indexOf('new Button'));
    await demo.hold(END_HOLD + 1200);
  },
});
