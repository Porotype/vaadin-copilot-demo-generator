// Docs walkthrough: edit inside a component class. The view's form is a ContactForm, a class of its own (written
// for the take, as if extracted with Extract to Inner Component and moved to its own file in the IDE): enter it,
// give its Phone field a helper text there, and go back up. Copilot as it is, in the docs app; the change to
// ContactForm.java is saved next to the take (source.diff), and both files are put back afterwards. Step texts
// are in docs-content/content.py.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as app from './support/docs-app.ts';
import { END_HOLD, docsScene } from './support/docs.ts';

const VIEW = app.javaFile('contacts/ui/ContactView.java');
const FORM = app.javaFile('contacts/ui/ContactForm.java');
const HELPER = 'With the country code';

const CONTACT_FORM = `package com.example.contacts.ui;

import com.vaadin.flow.component.Composite;
import com.vaadin.flow.component.combobox.ComboBox;
import com.vaadin.flow.component.datepicker.DatePicker;
import com.vaadin.flow.component.formlayout.FormLayout;
import com.vaadin.flow.component.textfield.EmailField;
import com.vaadin.flow.component.textfield.TextField;

class ContactForm extends Composite<FormLayout> {

    ContactForm() {
        var firstName = new TextField("First name");
        var lastName = new TextField("Last name");
        var email = new EmailField("Email");
        var phone = new TextField("Phone");
        var birthday = new DatePicker("Birthday");
        var country = new ComboBox<String>("Country");
        country.setItems("Finland", "Germany", "Sweden", "United Kingdom", "United States");

        var form = getContent();
        form.add(firstName, lastName, email, phone, birthday, country);
        form.setMaxWidth("40em");
    }
}
`;

/** ContactView, with its form made a ContactForm. */
function useContactForm(view: string) {
  const form = /        var form = new FormLayout\(\);\n        form\.add\([^)]*\);\n        form\.setMaxWidth\("40em"\);\n/;
  const fields = /        var firstName[\s\S]*?country\.setItems\([^)]*\);\n\n/;
  if (!form.test(view) || !fields.test(view)) throw new Error('ContactView.java has changed: update 101-docs-component');
  return view
    .replace(fields, '')
    .replace(form, '        var form = new ContactForm();\n')
    .replace(/import com\.vaadin\.flow\.component\.(combobox\.ComboBox|datepicker\.DatePicker|formlayout\.FormLayout|textfield\.EmailField|textfield\.TextField);\n/g, '');
}

export default docsScene({
  name: '101-docs-component',
  route: '/contact',
  mode: 'edit',

  async setup({ page, copilot }) {
    // The sources are guarded since before setup: ContactForm.java is removed and ContactView.java put back after the take.
    await writeFile(FORM, CONTACT_FORM);
    await writeFile(VIEW, useContactForm(await app.read('contacts/ui/ContactView.java')));
    // The scene's hot reload picks the change up too: whichever apply comes second may be superseded, so retry.
    for (let i = 0; ; i++) {
      try {
        console.log(`docs app: ${(await app.apply()).split('\n').at(-1)}`);
        break;
      } catch (e) {
        if (i > 5) throw e;
        await page.waitForTimeout(3000);
      }
    }
    // A new class can take a restart: reload until the app answers again.
    for (let i = 0; ; i++) {
      try {
        await page.reload();
        await copilot.ready();
        break;
      } catch (e) {
        if (i > 10) throw e;
        await page.waitForTimeout(3000);
      }
    }
    await page.waitForTimeout(1500);
    for (const close of await page.locator('copilot-notifications-container vaadin-button').all()) await close.click({ force: true }).catch(() => {});
    await copilot.setMode('edit');
  },

  async run(demo, { page, copilot, outDir }) {
    const original = await app.read('contacts/ui/ContactForm.java');
    const phone = page.locator('vaadin-text-field').filter({ has: page.locator('label:text-is("Phone")') }).first();
    const label = copilot.badge.locator('[part="badge-label"]');
    const labelIs = (text: string) => async () => ((await label.textContent().catch(() => '')) ?? '').trim() === text;
    const editing = page.locator('text=/^\\s*Editing/').first().locator('xpath=..');
    await demo.placeCursor({ x: 900, y: 520 });

    demo.step('select');
    await demo.zoom({ x: 600, y: 285 }, 1.45, { duration: 700 });
    await demo.click(phone, { anchor: { x: 0.6, y: 0.6 }, duration: 900 });
    await demo.waitFor(labelIs('ContactForm'), { timeout: 10_000, minMs: 300 });
    const enter = copilot.badge.locator('vaadin-button[aria-label^="Click to edit"]');
    await demo.waitFor(enter, { minMs: 300 });
    demo.outline(enter, { padding: 4 });
    await demo.hold(END_HOLD + 300);

    demo.step('enter');
    demo.clearOutline();
    await demo.click(enter, { duration: 600 });
    await demo.hold(500);
    // Entered, Copilot selects the class's root; select a field inside, which shows the Editing tag.
    await demo.click(phone, { anchor: { x: 0.6, y: 0.6 }, duration: 700 });
    await demo.waitFor(labelIs('TextField'), { timeout: 5000 });
    await demo.waitFor(page.getByText('ContactForm.java').first(), { timeout: 10_000, minMs: 400 });
    await demo.moveTo({ x: 900, y: 420 }, { duration: 500 });
    demo.outline(editing, { padding: 4 });
    await demo.hold(END_HOLD + 400);

    demo.step('change');
    demo.clearOutline();
    // Changes inside go into ContactForm.java: give Phone a helper text.
    await demo.click(copilot.badge.locator('#properties-panel-btn'), { duration: 600 });
    const props = copilot.panel('copilot-component-properties');
    const helper = props.locator('[data-test-prop-name="helperText"] input');
    await demo.waitFor(helper, { minMs: 300 });
    await demo.click(helper, { anchor: { x: 0.3, y: 0.5 }, duration: 600 });
    await demo.type(HELPER, { perChar: 60 });
    await demo.press('Enter');
    await demo.waitFor(phone.locator('[slot="helper"]', { hasText: HELPER }), { timeout: 30_000 });
    await demo.waitFor(async () => !(await copilot.busy()), { timeout: 30_000, minMs: 400 });
    await demo.click(page.locator('vaadin-popover:has(copilot-component-properties) [aria-label="Close"]').first(), { duration: 600 });
    // Escape would leave the class: select the form inside it instead (the gap between its columns), whose
    // badge sits at the top of the form, off Phone.
    await demo.click({ x: 529, y: 215 }, { duration: 600 });
    await demo.moveTo({ x: 900, y: 420 }, { duration: 500 });
    demo.outline(phone, { padding: 4 });
    await demo.hold(END_HOLD + 300);

    demo.step('up');
    demo.clearOutline();
    await demo.zoom({ x: 740, y: 230 }, 1.2, { duration: 600 });
    const up = page.locator('[aria-label^="Go up"], [title^="Go up"]').first();
    await demo.click(up, { duration: 700 });
    await demo.waitFor(page.getByText('ContactView.java').first(), { timeout: 10_000, minMs: 600 });
    await demo.moveTo({ x: 900, y: 420 }, { duration: 600 });
    demo.outline(editing, { padding: 4 });
    await demo.hold(END_HOLD + 300);

    await writeFile(path.join(outDir, 'source.diff'), await app.diffOf(FORM, original));
  },
});
