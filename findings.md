# Findings

Copilot problems met while recording the docs walkthroughs, and decisions about what they leave out. Input for the
Copilot team; keep adding to it. Each entry says what happens, why (when we know), and where to fix it. "Verified"
means reproduced and checked in the source or by patching the bundle; "observed" means seen in recordings, cause not
traced. Versions and dates are when it was found; recheck after a Copilot upgrade, and remove what's fixed.

The walkthroughs don't show a problem that isn't fixed yet: they work around it off camera, and the entry says how.

## Editing

### Changing a label through Properties breaks the build (verified; Copilot)

After a drop into a form, setting a Date Picker's label to "Birthday" in Properties → Save All renames
the variable (`date` → `birthday`) but not its use in `new FormLayout(…, date, …)`. The file no
longer compiles ("cannot find variable date").

Why: `JavaRewriterUtil.renameVariable` renames method-call scopes and `findParameterUsage`, which
keeps only `isMethodCallArgument` references. Constructor arguments (`ObjectCreationExpr`) are
dropped. Copilot's own drop had just put the component in a constructor call, so its next edit breaks
it. Still the same at HEAD. Patch: `docs/patches/rename-constructor-arguments.patch` (applies to HEAD):
a rename now also updates references passed to a constructor, and a test case covers it. Tested
against the 25.3.0 sources (same code): the new test fails without the fix ("expected `Div wrapper =
new Div(hello);`") and all 15 tests in `JavaRewriterRenameVariableTest` pass with it.

Also by double-click, in plain code (25.3.5, 2026-11-09): in a view written the way people write them,
`var save = new Button("Save", …)` and later `new HorizontalLayout(save, cancel)`, changing the caption
in place to "Save contact" renames `save` to `saveContact` and leaves `new HorizontalLayout(save, cancel)`:
"cannot find variable save". The two rewritten lines also lose their indentation. The docs walkthroughs'
app (`apps/docs-app`) adds its components with `add(…)` to stay clear of it.

### Padding on a component class's own layout shows but isn't saved (verified; Copilot)

25.3.5, docs app, 2026-11-11. Inside `ViewTitle` (a `Composite<HorizontalLayout>`, entered with the badge's
↳), the selection is the `Composite`, and its badge has the layout's Pad and Gap switches. Turning Pad on
pads the title in the browser, and stays on after going back up, but neither `ViewTitle.java` nor
`ContactView.java` changes, and nothing says so. A property on the heading inside (Class Name in
Properties) is saved to `ViewTitle.java` as expected (`h.setClassName("page-title")`, at column 0). The
docs walkthrough shows the class name.

### Entering a component class selects a "Composite" first (observed; Copilot UX)

25.3.5, docs app, 2026-11-12. After the badge's ↳ on a `ContactForm` (a `Composite<FormLayout>` in its own
file), the selection is the class's root, badged **COMPOSITE**, and the "Editing ContactForm.java ↰" tag
doesn't show until something inside is selected. That root is the one whose Pad doesn't save (above). Escape
inside goes back up to the view, rather than clearing the selection. The docs walkthrough selects a field
right after entering.

### Extract to Inner Component: no name, and unindented code (verified; Copilot)

25.3.5, docs app, 2026-11-12. ⋮ → Extract to Inner Component on the contact form extracts at once, with no
dialog: `public static class MyComponent extends Composite<FormLayout>` inside `ContactView`, a notice
("Extracted to inner component MyComponent. Refactor to top-level class to reuse.") that closes by itself
after a few seconds, and the new component selected. The class and its use are written at column 0, and each
field gets its own `form.add(…)`. The hot swap of the new inner class escalates to a restart
(`IncompatibleClassChangeError … disagree on InnerClasses`); the Dev Loop handles it.

### Impersonating from the login page stays on the login page (observed; Copilot UX)

25.3.5, the docs app's secure profile (then `apps/docs-app-secure`), 2026-11-12. ⋮ → Impersonate App User works on the login page (Copilot is
there), and Switch User reloads the page, signed in, but the login view shows again unless the app sends
signed-in users on; `LoginView` there forwards them to "". The panel's Recent Usernames are machine-wide
(`recentSwitchedUsernames` in `~/.vaadin/copilot-configuration.json`), so an old one from another project
shows up; the take starts with none. Impersonation is in the ⋮ menu, not the toolbar, in every mode.

### Add View stays open after Create (observed; Copilot UX)

25.3.5, docs app. Views & Routes → + → Title "Contacts" → Create: Copilot writes `com.example.Contacts`
(route `contacts`, in the base package rather than next to the other views), lists it, and shows a notice that
the route was created and that hot reload is unavailable without the IDE plugin, so restart the server (no
plugin here; the Dev Loop reloads it anyway, and `/contacts` opens). The Add View dialog stays open with
the same values, so a second Create is one click away. "Add to menu" was on, but the side nav shows the view
only after a restart.

### The Theme Editor is left out of the docs walkthroughs (decided)

See "The theme editor finds no theme in a start.vaadin.com app" below: a walkthrough would show a fix the
reader's fresh project doesn't have. Revisit when Copilot finds the `AppShellConfigurator` class.

### Undo needs the IDE plugin (observed; Copilot)

`⌘Z` / `Ctrl+Z` in Edit mode, after a Duplicate and a Delete, changes nothing without an IDE plugin; the
docs say undo goes through the plugin, IntelliJ only. So there's no undo to show in a browser-only
walkthrough, and none for VS Code users.

### Escape after a drop does different things (observed; Copilot UX)

Right after dropping a component from the UI Library, Escape sometimes selects the parent (the view) and
sometimes does nothing visible; a second Escape sometimes closes the UI Library. The docs walkthroughs
close the library with its × and click beside the form instead.

### Double-clicking a Date Picker's label doesn't edit it (verified; Copilot)

Double-click-to-edit works for TextField and EmailField labels, including freshly dropped ones. On a
Date Picker's label, the selector resolves the point to the enclosing view (no
`subPart`), so nothing opens.

### The badge covers the label of the component it belongs to (observed; Copilot UX)

Right after a drop the new component is selected, and its badge sits over its label row. The natural
next step, double-clicking the label to rename it, hits the badge instead. Deselecting first (Esc)
works around it.

### Editing inside a tab, or inside a component class (observed; Copilot and Flow)

Found in an app with a tab sheet whose Tasks tab is its own class (`TasksTab`).

- **Every edit sends you back to the first tab.** The hot swap re-creates the view, which opens
  on its first tab, so the change you just made isn't on screen until you click Tasks again. The same happens
  after an agent's `vaadin-dev apply`.
- **The step-in pill covers what you point at.** Hovering a component that is its own class shows "Edit
  TasksTab.java ↳" in its top-right corner, which is where the tab's "New task" button is. The pill
  takes the click; you step in with the ↳ button and then edit the button underneath.

## Accessibility checker

- **Every view reports Vaadin's own components** (observed). "Elements must only use supported ARIA
  attributes" on every view is `aria-selected="false"` on the `vaadin-menu-bar-item` of the user menu.
  App developers can't fix it, and it teaches them to ignore the checker. Worth filtering, or reporting
  to the web components team.
- **"Global issue"** (observed). On a larger view, 94 colour-contrast warnings are listed one per row, all
  titled "Global issue", including ones with a specific element (the user-menu avatar above).

## New view

- **Add View doesn't open the new view under the Dev Loop** (verified; Copilot). Copilot writes the class,
  the Dev Loop compiles and loads it, and the dialog keeps waiting: it opens the view on
  `copilot-java-after-update` with the route, which the IDE plugin's hot swap sends and the Dev Loop's
  doesn't. Sending Copilot `route-created` with the route (`Vaadin.copilot.eventbus`) opens it. The Views & Routes
  walkthrough opens the new view from the panel's link instead.
- **Image to View copies the picture's style** (observed; Copilot AI). From a whiteboard-like sketch it
  wrote serif fonts, thick borders and hand-placed spacing into the view; from a plain grey wireframe it
  wrote ordinary fields that follow the app's theme. Both took 12–20 s. Neither used a FormLayout for
  the two-column form: rows of HorizontalLayouts.
- **Sometimes the view doesn't compile** (observed once in five; Copilot AI). One take's view imported
  `com.vaadin.flow.component.orderedlayout.Div` and extended a class it then couldn't call `getStyle()`
  or `add()` on. The Dev Loop's apply failed with the compiler errors; Copilot itself showed nothing.
- **"Please restart the server"** (observed; Copilot). Without an IDE plugin, Add View says the route was
  created "but no active IDE plugin was detected, so hot-reloading is unavailable. Please restart the
  server". Under the Dev Loop the view is already compiled and loaded; no restart is needed.
- **"This operation uses AI"** asks before each AI action unless "Don't ask again" is checked.
- **The Add View dialog scrolls** at 1000 px viewport height; the templates are below the fold.

## UI Library
- **"Add to Components" in 25.3.0** (observed). The context menu still calls the UI Library
  "Components"; copilot-internal main already says "Add to UI Library".
- **A drop between sections a view adds by method call fails** (verified; Copilot). Dropping a form
  component between a view's two sections shows "Failed to add call": the view does
  `content.add(buildProfileSection(me)); content.add(buildPasswordSection());`, and the rewriter
  (`JavaRewriter`, "Reference component not found in the add call") needs the neighbour to be a
  variable. A common way to structure a view; the drop zone is offered all the same.

## Dev Loop and hot swap

### The no-hotswap warning, and in-place edits that wait for a hot swap (observed; Copilot)

In a start.vaadin.com app, right after the Dev Loop has hot-swapped a caption
change, an in-place edit in Edit mode warns "You do not have Java hotswapping enabled. This operation
will feel slow." Copilot doesn't recognize the Dev Loop's hot swap (its `usingHotswap()` reads
`earlyProjectState.jdkInfo.runningWitHotswap && runningWithExtendClassDef`, both false under the Dev Loop's JBR
with HotswapAgent); the walkthroughs dismiss the warning (`scenes/support/docs.ts`).
The in-place edit writes the Java at once, but the page keeps showing the old caption until something
hot-swaps the class, so without an IDE plugin the edit looks like it did nothing.

## A fresh start.vaadin.com app

### The theme editor finds no theme in a start.vaadin.com app (verified; Copilot)

In a fresh start.vaadin.com project (25.3.5), the theme editor says "The application does not have a theme
set up" and offers Create. The theme is there: `AppShell` has `@StyleSheet(Aura.STYLESHEET)` and
`@StyleSheet("styles.css")`. But `ThemeEditorMessageHandler` reads `@StyleSheet` only from
`SpringBridge.getApplicationClass` (the `@SpringBootApplication` class), and the template keeps the app
shell in its own class. Create (`ApplicationInitializer.createTheme`) then writes `@StyleSheet` and
`implements AppShellConfigurator` onto `Application`, and the next start fails: "Multiple classes
implementing `AppShellConfigurator` were found". Fix: look up the `AppShellConfigurator` class (Flow's
`AppShellRegistry` knows it) instead of the Spring Boot class, in both places.

### A view title can't be edited in place (observed; Copilot)

Double-clicking "Task List" in Edit mode selects the `ViewTitle` composite (its toolbar says
VERTICALLAYOUT) instead of editing the text, because the H1's text comes in through the composite's
constructor. In a fresh start.vaadin.com app, the button caption is the only obvious label that edits in
place.
