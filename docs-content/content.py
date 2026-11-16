"""The walkthroughs' words: the step texts, which docs-content/asciidoc.py writes into vaadin/docs beside the clips
(the clips carry no text).

Per page, its walkthroughs: `scene` (scenes/<scene>.ts), `docs` (the slug in vaadin/docs), `title`, optional
`sections: True` (one partial per step, for a page with a section per step), and `steps`: the text per step, keyed by
the step's name in the scene (demo.step()). Markup: `**x**` is bold, `[[x]]` marks what the clip outlines (drawn in the
outline's orange), `` `x` `` is code (keys become kbd:[…], file names the docs' filename role).

Only the walkthroughs reach the docs. A page's `nav`, `title`, `lead` and `after`, and a walkthrough's `code`, are from the
prototype page that came before the docs pages; the pages in vaadin/docs are written by hand there.
"""

PAGES = [
    {
        "id": "toolbar",
        "nav": "The toolbar",
        "title": "The Copilot toolbar",
        "lead": "Copilot is part of your app while it runs in development mode. Nothing to install: open the app "
                "in the browser and the toolbar is there.",
        "walkthroughs": [
            {
                "scene": "90-docs-toolbar",
                "docs": "toolbar",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-toolbar.adoc (asciidoc.py)
                "title": "Find your way around the toolbar",
                "steps": {
                    "where": "The [[Copilot toolbar]] sits in the lower-right corner of your app. It stays small "
                             "and faded until you move the pointer toward it.",
                    "modes": "Pick a mode. **Inspect** shows the view's structure, **Edit** lets you change it, "
                             "**Test** checks it, and **Play** is your app as usual. The toolbar grows the panels "
                             "of the mode you pick.",
                    "menu": "The **⋮** menu has your app's info and log, feature flags, feedback, help, and "
                            "settings.",
                },
            },
        ],
        "after": "**Tip:** press `Shift` and then `Ctrl` twice (`Shift` + `⌘` `⌘` on macOS) to switch between "
                 "Play and the mode you used last.",
    },
    {
        "id": "edit-text",
        "nav": "Edit text",
        "title": "Edit text in place",
        "lead": "Captions, labels and headings are strings in your Java code. In Edit mode you change them where "
                "you read them, and Copilot changes the code.",
        "walkthroughs": [
            {
                "scene": "91-docs-edit-text",
                "docs": "edit-text",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-edit-text.adoc (asciidoc.py)
                "title": "Change a button's caption",
                "steps": {
                    "edit-mode": "Switch to **Edit** mode in the toolbar.",
                    "context": "Copilot's [[Editing]] tab names the file you are editing, here "
                               "`ContactView.java`. You can change the components that this file creates. The "
                               "rest of the page, such as the main layout, is dimmed.",
                    "double-click": "Double-click the text, type the new one and press `Enter`. Copilot "
                                    "changes the string in your Java code, and the view updates.",
                },
                "code": {"title": "The caption changes in ContactView.java, and the variable is renamed to match"},
            },
        ],
    },
    {
        "id": "drag-drop",
        "nav": "Drag & drop",
        "title": "Move components",
        "lead": "Rearrange a view by dragging its components, in the view itself or in the Outline. Copilot "
                "moves the lines of code that add them.",
        "walkthroughs": [
            {
                "scene": "92-docs-drag-drop",
                "docs": "drag-and-drop",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-drag-and-drop.adoc (asciidoc.py)
                "title": "Reorder a form, in the view and in the Outline",
                "steps": {
                    "select": "In **Edit** mode, click a component to select it. Its [[badge]] names the "
                              "component type. Drag the component by the badge.",
                    "drag": "Drag it to its new place and release. In a form, aim for the thin strip at the "
                            "left edge of a field: the component goes before that field.",
                    "outline-open": "When the target is small or crowded, open the [[Outline]]. It shows the "
                                    "view's components as a tree.",
                    "outline-drag": "Drag a row in the Outline to move that component. Here, Birthday moves to "
                                    "the top of the form.",
                },
                "code": {"title": "The same fields, in a new order"},
            },
        ],
    },
    {
        "id": "menu",
        "nav": "App info, logs & settings",
        "title": "App info, logs & settings",
        "lead": "The ⋮ at the end of the toolbar opens Copilot's menu: your account, messages, and the panels "
                "that aren't about one view. Each item opens one.",
        "walkthroughs": [
            {
                "scene": "94-docs-menu",
                "docs": "menu",  # vaadin/docs: articles/tools/copilot/features/_menu-<step>.adoc (asciidoc.py)
                "sections": True,  # the docs page has a section per item, with its clip, not a stepper
                "title": "What's in the menu",
                "steps": {
                    "app-info": "**App Info** lists what your application runs on: the Vaadin, Java and Spring "
                                "versions, and whether you have set up hot swap and the IDE plugin.",
                    "app-log": "**App Log** shows the communication between your application and its backend "
                               "services, its errors, and Copilot's notifications.",
                    "features": "**Features** turns feature flags on and off: features of Vaadin and Copilot "
                                "that are still experimental, to try before their release.",
                    "feedback": "**Feedback** sends general feedback, a bug report, a question, or an idea to "
                                "Vaadin.",
                    "settings": "**Settings** changes how Copilot looks and behaves, such as its size, theme, "
                                "and how the toolbar appears.",
                },
            },
        ],
    },
    {
        "id": "go-to-source",
        "nav": "Go to Source",
        "title": "Go to Source",
        "lead": "Every component on the page was created somewhere in your code. Copilot opens that line in your "
                "IDE.",
        "walkthroughs": [
            {
                "scene": "93-docs-go-to-source",
                "docs": "go-to-source",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-go-to-source.adoc (asciidoc.py)
                "title": "Open the code behind a button",
                "steps": {
                    "context-menu": "Right-click a component and point at **Go to Source**. Choose "
                                    "**Instance created** for the line that creates it, or **Attached to UI** "
                                    "for the line that adds it to the view.",
                    "ide": "Your IDE opens the file at that line.",
                },
            },
        ],
        "after": "**Tip:** select a component and press `Ctrl` + `B` to go straight to the "
                 "line that creates it.",
    },
    {
        "id": "select",
        "nav": "Select",
        "title": "Select components",
        "lead": "Most of what you do in Edit mode starts with a selection: one component, the layout around it, or "
                "several at once.",
        "walkthroughs": [
            {
                "scene": "96-docs-select",
                "docs": "select",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-select.adoc (asciidoc.py)
                "title": "Select a component, its layout, and its neighbors",
                "steps": {
                    "click": "In **Edit** mode, click a component to select it. Its badge names the "
                             "[[component type]], here a button, and has the tools for it.",
                    "parent": "To select the layout around it, right-click and choose **Select** › **Parent**. The "
                              "badge now names the [[HorizontalLayout]] that holds both buttons.",
                    "keys": "The arrow keys move the selection without the menu. `↓` selects the first component "
                            "inside a layout, then the next one, here Cancel. `↑` goes back, and `←` selects the "
                            "parent.",
                    "several": "To select several components, click the first and `Ctrl`-click the others "
                               "(`⌘`-click on macOS). Each gets a badge, with the tools that work on all of them.",
                },
            },
        ],
    },
    {
        "id": "properties",
        "nav": "Properties",
        "title": "Change properties",
        "lead": "Every component has properties that you'd otherwise set in code, such as a field's helper text "
                "or placeholder. Set them in the Properties panel, and Copilot writes the call.",
        "walkthroughs": [
            {
                "scene": "97-docs-properties",
                "docs": "properties",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-properties.adoc (asciidoc.py)
                "title": "Give a field a helper text",
                "steps": {
                    "open": "Select a component and click **Properties** in its badge. The [[panel]] lists what "
                            "you can set, in groups such as General, Behavior, and Validation.",
                    "edit": "Type a value and press `Enter`. The Phone [[field]] shows its new helper text, and "
                            "Copilot adds a `setHelperText` call to `ContactView.java`.",
                },
                "code": {"title": "Copilot adds the call to ContactView.java"},
            },
        ],
    },
    {
        "id": "layout",
        "nav": "Spacing & alignment",
        "title": "Spacing and alignment",
        "lead": "A layout's badge has switches for its padding and the gap between its components, and buttons "
                "for its alignment. No CSS needed.",
        "walkthroughs": [
            {
                "scene": "98-docs-layout",
                "docs": "spacing-and-alignment",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-spacing-and-alignment.adoc (asciidoc.py)
                "title": "Pad the buttons' layout and center the view",
                "steps": {
                    "select": "Select a layout, here the one around the buttons: click Save and press `←` for "
                              "its parent. The layout's [[badge]] has the **Pad** and **Gap** switches, and "
                              "**Alignment**.",
                    "padding": "Turn **Pad** on. The [[layout]] gets padding around its buttons, and Copilot "
                               "writes it to `ContactView.java`.",
                    "align": "Click beside the form to select the view, which is a vertical layout too. In "
                             "**Alignment**, choose to align its components to the center: the title, the form "
                             "and the buttons move to the middle.",
                },
                "code": {"title": "Both changes in ContactView.java"},
            },
        ],
    },
    {
        "id": "ui-library",
        "nav": "UI Library",
        "title": "Add components from the UI Library",
        "lead": "The UI Library has the components and layouts you can add to a view. Find one, drag it in, and "
                "Copilot writes the code that creates and adds it.",
        "walkthroughs": [
            {
                "scene": "95-docs-ui-library",
                "docs": "ui-library",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-ui-library.adoc (asciidoc.py)
                "title": "Add a checkbox to the form",
                "steps": {
                    "open": "In **Edit** mode, click **UI Library** in the toolbar. The [[library]] has "
                            "sections for layouts, content, input fields, and more.",
                    "search": "Type in its search field to find a component, here [[Checkbox]].",
                    "drag": "Drag it into the view. Drop zones light up as you go: between the form and the "
                            "buttons, it goes into the view, between the two. Copilot adds it to "
                            "`ContactView.java`.",
                },
                "code": {"title": "Copilot creates the checkbox and adds it to the view"},
            },
        ],
    },
    {
        "id": "copy-paste",
        "nav": "Copy & paste",
        "title": "Copy, paste, duplicate, and delete",
        "lead": "A component's menu has what you'd expect of any editor: copy, paste, duplicate, and delete. "
                "Each changes the code, and each has a keyboard shortcut.",
        "walkthroughs": [
            {
                "scene": "99-docs-copy-paste",
                "docs": "copy-and-paste",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-copy-and-paste.adoc (asciidoc.py)
                "title": "Duplicate a button, delete it, and copy a field",
                "steps": {
                    "duplicate": "Select a component and open its menu: click **⋮** in its badge, or "
                                 "right-click the component. **Duplicate** adds a [[copy]] right after it.",
                    "delete": "**Delete** removes the selected component, here the copy, from the view and from "
                              "`ContactView.java`.",
                    "copy": "**Copy** puts the selected component on the clipboard, here the Phone field.",
                    "paste": "Select a component and choose **Paste**. The [[copy]] goes after it, here at the "
                             "end of the form.",
                },
                "code": {"title": "The pasted field in ContactView.java"},
            },
        ],
    },
    {
        "id": "wrap",
        "nav": "Wrap with a layout",
        "title": "Wrap components with a layout",
        "lead": "To group components, wrap them with a layout. Copilot creates the layout and moves the "
                "components into it, in the view and in the code.",
        "walkthroughs": [
            {
                "scene": "100-docs-wrap",
                "docs": "wrap-with-layout",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-wrap-with-layout.adoc (asciidoc.py)
                "title": "Put the first and last name side by side",
                "steps": {
                    "select": "Select the components to wrap: click the first, then `Ctrl`-click the others "
                              "(`⌘`-click on macOS).",
                    "wrap": "Open the menu, point at **Wrap with**, and choose a layout, here **Horizontal "
                            "Layout**. The [[new layout]] takes their place in the form, with both fields in it.",
                },
                "code": {"title": "Copilot creates the layout and moves the fields into it"},
            },
        ],
    },
    {
        "id": "component",
        "nav": "Component classes",
        "title": "Extract and edit component classes",
        "lead": "A part of a view that you want to reuse, such as a form, can become a component class of its own. "
                "Copilot extracts it, and edits inside it: the change goes into its class, and so into every view "
                "that uses it.",
        "walkthroughs": [
            {
                "scene": "109-docs-extract",
                "docs": "extract-component",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-extract-component.adoc (asciidoc.py)
                "title": "Extract the form into a class",
                "steps": {
                    "extract": "Select the form: click a field, and press **←** for its parent. In its **⋮** "
                               "menu, point at **Extract to Inner Component**.",
                    "result": "Click it. Copilot moves the form and its fields into a class inside the view's "
                              "class, `MyComponent`, and selects it: its [[badge]] now has the **↳** button of a "
                              "component class.",
                },
            },
            {
                "scene": "101-docs-component",
                "docs": "component-classes",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-component-classes.adoc (asciidoc.py)
                "title": "Change the form's own class",
                "steps": {
                    "select": "Here the form is a `ContactForm`, a class in a file of its own. Click a field in "
                              "it, and the form is selected as a whole: its badge has a [[↳]] button that edits "
                              "`ContactForm.java` instead of the view.",
                    "enter": "Click it, and select a field inside. The [[Editing]] tag names `ContactForm.java`, "
                             "and everything outside the form is dimmed.",
                    "change": "Changes now go into `ContactForm.java`, and so into every view that has the form. "
                              "Here [[Phone]] gets a helper text in **Properties**.",
                    "up": "Click **↰** in the Editing tag to go back up to [[the view's file]], `ContactView.java`.",
                },
                "code": {"title": "The helper text goes into ContactForm.java"},
            },
        ],
    },
    {
        "id": "ai",
        "nav": "Prompt AI",
        "title": "Prompt AI to make changes",
        "lead": "Select something and say what you want changed, in your own words. Copilot's AI changes the "
                "code, and the view updates. Good for changes that touch many components at once, or that you'd "
                "otherwise look up.",
        "walkthroughs": [
            {
                "scene": "102-docs-ai-icons",
                "docs": "ai-icons",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-ai-icons.adoc (asciidoc.py)
                "title": "Add an icon to every field",
                "steps": {
                    "select": "Select what the change is about, here the whole form: click a field and press "
                              "`←` for its parent. The badge names the [[form layout]].",
                    "ask": "Click the AI button in the badge, say what you want, and send it. Here, an icon at "
                           "the start of every field: the AI picks one for each, and the [[form]] updates.",
                },
                "code": {"title": "One setPrefixComponent call per field"},
            },
            {
                "scene": "103-docs-ai-format",
                "docs": "ai-format",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-ai-format.adoc (asciidoc.py)
                "title": "Explain and check a field's format",
                "steps": {
                    "ask": "Select the Phone field and ask for its format as a helper text, and for the field to "
                           "accept only that. The [[field]] shows the format, and the AI adds a check that "
                           "rejects other numbers.",
                },
                "code": {"title": "A helper text, a pattern, and an error message"},
            },
            {
                "scene": "104-docs-ai-sections",
                "docs": "ai-sections",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-ai-sections.adoc (asciidoc.py)
                "title": "Split a form into sections",
                "steps": {
                    "ask": "Select the view and ask for a change to its structure: here, the form split in two, "
                           "each part under its own heading.",
                },
                "code": {"title": "Two forms, each under a heading"},
            },
        ],
    },
    {
        "id": "inspect",
        "nav": "Inspect mode",
        "title": "Inspect mode",
        "lead": "Inspect mode shows what a view is made of without changing anything: each component's type, its "
                "properties, and where it is in the view's structure.",
        "walkthroughs": [
            {
                "scene": "105-docs-inspect",
                "docs": "inspect",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-inspect.adoc (asciidoc.py)
                "title": "Look at a field and its properties",
                "steps": {
                    "mode": "Click the [[eye]] in the toolbar to switch to **Inspect** mode.",
                    "select": "Point at a component to see what it is, and click to select it. Its [[badge]] has "
                              "the component's documentation, its properties, and a menu.",
                    "properties": "**Properties** shows the component's [[properties]] and their values. In "
                                  "Inspect mode you can look; to change them, switch to Edit mode.",
                },
            },
        ],
    },
    {
        "id": "routes",
        "nav": "Views & Routes",
        "title": "Views and routes",
        "lead": "The Views & Routes panel lists your application's views and their routes. Add a view there, and "
                "Copilot creates its class.",
        "walkthroughs": [
            {
                "scene": "106-docs-routes",
                "docs": "views-and-routes",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-views-and-routes.adoc (asciidoc.py)
                "title": "Add a view and open it",
                "steps": {
                    "open": "In **Edit** mode, click **Views & Routes** in the toolbar. The [[panel]] lists "
                            "each view's class and route.",
                    "add": "Click **+**, and type a title in the [[dialog]]. Copilot fills in the route and the "
                           "class name from the title.",
                    "type": "Scroll down to choose what the view starts with: [[a template]], such as a "
                            "dashboard or a form, or an empty view.",
                    "create": "Click **Create**. Copilot creates the class and lists the [[new view]]. The "
                              "dialog stays open for another view, so close it when you're done.",
                    "go": "Click its route to open it. The new view is a placeholder, ready for components.",
                },
            },
        ],
    },
    {
        "id": "impersonate",
        "nav": "Impersonate users",
        "title": "Impersonate users",
        "lead": "In an application with a login, see it as any of its users: switch to a user by name, without "
                "a password. Good for checking what each role may see and do.",
        "walkthroughs": [
            {
                "scene": "110-docs-impersonate",
                "docs": "impersonate-users",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-impersonate-users.adoc (asciidoc.py)
                "title": "Sign in as a user, then switch to an admin",
                "steps": {
                    "open": "On the login page, open the **⋮** menu at the end of the toolbar and choose "
                            "**Impersonate App User**. Type a username in the [[panel]].",
                    "in": "Click **Switch User**. The page reloads with you signed in as that user, without a "
                          "password: the [[menu]] lists the views that a user may open.",
                    "switch": "Open the panel again: it lists the usernames you've used. Switch to an "
                              "administrator, and the [[menu]] has the views for administrators too.",
                },
            },
        ],
    },
    {
        "id": "listeners",
        "nav": "Add listeners",
        "title": "Add listeners",
        "lead": "To make a component do something, add a listener to it. Copilot writes the stub, and your IDE "
                "opens at it, ready for the code.",
        "walkthroughs": [
            {
                "scene": "107-docs-listener",
                "docs": "listeners",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-listeners.adoc (asciidoc.py)
                "title": "Add a click listener to a button",
                "steps": {
                    "menu": "Right-click a component, point at **Add Listener**, and choose one, here **Add "
                            "Click Listener**.",
                    "ide": "Copilot adds the listener to `ContactView.java`, and your IDE opens at it.",
                },
                "code": {"title": "The listener stub"},
            },
        ],
    },
    {
        "id": "a11y",
        "nav": "Accessibility checker",
        "title": "Check accessibility",
        "lead": "The Accessibility Checker, in Test mode, scans the view for accessibility issues and explains how "
                "to fix each one.",
        "walkthroughs": [
            {
                "scene": "108-docs-a11y",
                "docs": "accessibility-checker",  # vaadin/docs: articles/tools/copilot/features/_walkthrough-accessibility-checker.adoc (asciidoc.py)
                "title": "Check a view and look at an issue",
                "steps": {
                    "open": "Switch to **Test** mode and click **Accessibility Checker** in the toolbar.",
                    "check": "Click **Check**. The [[results]] list errors and warnings, grouped by rule, with "
                             "the component each one is about.",
                    "issue": "Click an issue for its details: what's wrong, how to fix it, and the HTML it's "
                             "about.",
                },
            },
        ],
    }
]

# Basic to advanced, as in the docs' Features menu.
_ORDER = ["toolbar", "menu", "select", "go-to-source", "inspect", "edit-text", "properties", "layout", "ui-library",
          "drag-drop", "copy-paste", "wrap", "ai", "listeners", "routes", "impersonate", "component", "a11y"]
PAGES.sort(key=lambda p: _ORDER.index(p["id"]))
