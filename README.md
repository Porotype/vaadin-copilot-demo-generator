# Copilot docs walkthroughs

Records the step-by-step walkthroughs in the Vaadin Copilot docs (Tools › Copilot › Features) from the real Copilot,
running in a real app: one short looping clip per step, in light and dark, with the step's text beside it in the page.
The scenes are Playwright scripts, so when Copilot changes, the clips are re-recorded rather than redone by hand.

What's where:

- **This repository**: the demo app (`apps/docs-app`, pinned to a Vaadin version), the scenes (`scenes/`), the
  recorder (`director/`), the step texts (`docs-content/content.py`), and the scripts that run it all. Never the
  recordings: `out/` is ignored.
- **vaadin/docs**: the clips (`src/main/resources/META-INF/resources/vaadin/videos/copilot/`) and the AsciiDoc
  partials that hold them (`articles/tools/copilot/features/_walkthrough-*.adoc`), both written by this repository,
  and the pages that include them, written by hand there. The step-through player is
  `dspublisher/theme/walkthrough.ts` in the docs repo.

The usual way of working: bump the Vaadin version in the app, run one command, fix the scenes that broke (an AI agent
can do most of that, see below), and have a person review the docs pull request.

## Prerequisites

- Node 22 or newer
- Java 25 (the app's `java.version`), Maven comes with the app (`mvnw`)
- ffmpeg (with ffprobe), Python 3, git; [gh](https://cli.github.com/) to open the docs PR from here
- Copilot signed in to a Vaadin account (`~/.vaadin/proKey`): open any Vaadin app in dev mode and sign in from
  Copilot. The AI walkthroughs (102–104) need an account that may use AI; without a sign-in they're skipped.
- macOS or Linux (the Dev Loop's `vaadin-dev` is a bash script)

`npm install` installs Playwright's Chromium and then checks the rest, saying what's missing.

## Regenerate everything

```bash
git clone <this repository> && cd <it>
npm install
npm run regenerate             # about an hour for all 21 scenes
```

`npm run regenerate`:

1. Gets a vaadin/docs checkout (a shallow clone in `.work/docs`, or `DOCS_DIR=/path/to/docs`) and makes a branch
   there from `main`.
2. Starts the app on :8084 and, with the `secure` profile, on :8085 (`scripts/apps.ts`).
3. Records each scene in light, then dark, one at a time, and cuts the steps. A failed scene is reported and
   skipped; the others go on.
4. Writes the partials and clips into the docs checkout.
5. Writes a contact sheet, `out/contact-sheet.html`: every step's last frame in light and dark, with its text.
6. Stops the apps, and prints the failed scenes, the docs diff and the commands to commit and push.

Options:

```bash
npm run regenerate -- 106 110          # only these scenes (number or name)
npm run regenerate -- --push           # also commit, push and open a draft PR in vaadin/docs
npm run regenerate -- --docs-branch v25.3   # a versioned docs branch; set the matching Vaadin version first
npm run regenerate -- --skip-ai        # leave out the AI scenes
npm run regenerate -- --keep-apps      # leave the apps running
```

Then review: open the contact sheet and look at every frame, light and dark. A take "passes" when its checks pass,
but framing problems only show in the frames. To see the pages, run the docs dev server in the docs checkout
(`npm install && npm run dspublisher:start`, http://localhost:8210); restart it after the partials change, and
hard-reload the browser, since clips keep their names.

## Update Vaadin

Change `vaadin.version` in `apps/docs-app/pom.xml`, run `npm run regenerate`, fix what broke, commit here, and send
the docs PR. Don't regenerate the app from start.vaadin.com: the scenes depend on its exact content. Copilot comes
with Vaadin, so a Vaadin bump is also a Copilot bump; Copilot's UI changes between versions, and scenes break on
selectors (most are in `director/copilot.ts`) and on changed behavior.

## Add a walkthrough

1. A scene, `scenes/<NN>-docs-<name>.ts`, built with `docsScene()` from `scenes/support/docs.ts`. Start from a
   similar one. Mark each step with `demo.step('<name>')`.
2. Its texts in `docs-content/content.py`: a walkthrough with `scene`, `docs` (the slug in vaadin/docs), `title` and
   a text per step.
3. Record it: `npm run regenerate -- <NN>`.
4. In vaadin/docs, by hand: a page (or a section in one) under `articles/tools/copilot/features/` that includes
   `_walkthrough-<slug>.adoc`, with front matter (`title`, `page-title`, `description`, `meta-description`,
   `order`). Follow the docs' `CONVENTIONS.md`, and run Vale on it (0 errors, 0 warnings).

The rules for the content, and everything else an agent needs, are in the project skill,
[`.claude/skills/copilot-walkthroughs/SKILL.md`](.claude/skills/copilot-walkthroughs/SKILL.md). Copilot problems met
while recording are in [`findings.md`](findings.md).

## With an AI agent

Open the repository in Claude Code (or another agent that reads `.claude/skills/`) and ask, for example:
"Bump Vaadin to 25.4.0, regenerate the walkthroughs and fix what breaks", or "Add a walkthrough for the
Accessibility checker's fix suggestions". The skill has the workflow, the rules and the gotchas.

## By hand

```bash
npm run apps -- start                                          # both apps
npm run scene -- scenes/91-docs-edit-text.ts                   # light take → out/91-docs-edit-text/
DOCS_THEME=dark npm run scene -- scenes/91-docs-edit-text.ts   # dark take  → out/91-docs-edit-text-dark/
npm run walkthrough -- 91-docs-edit-text 91-docs-edit-text-dark    # cut into out/<take>/steps/
python3 -I docs-content/asciidoc.py . .work/docs 91-docs-edit-text # into the docs checkout
python3 -I docs-content/contact_sheet.py . out/contact-sheet.html  # the contact sheet
npm run apps -- stop
npm run typecheck
```

## Not covered yet

From the plan for the full set:

| Feature | Why not yet |
| --- | --- |
| Theme editor: style one component, then all of them | In a start.vaadin.com app it finds no theme, and its Create breaks the next start (`findings.md`) |
| Set data on a Grid | Later |
| Annotations (Test mode) | Later |
| Internationalization | Experimental |
| Figma to code (paste) | Needs Figma in the frame |
| Sign in with a Vaadin account; keyboard shortcuts | Text or a table is enough |
| Undo and redo | Goes through the IDE plugin (IntelliJ only); nothing to show in the browser |
| UI Test Generation, UI Test Recorder | Experimental and changing; revisit |
| UI Services (Hilla) | The app is Flow-first; a Hilla app later if needed |

## Links from Copilot

Copilot links to the pages with a tag, so visits from Copilot can be told apart:
`https://vaadin.com/docs/latest/tools/copilot/features/<page>?utm_source=copilot&utm_content=<page>`, where `<page>`
is one of `toolbar`, `menu` (with `#app-info`, `#app-log`, `#feature-flags`, `#feedback` or `#settings` for a menu
item), `select`, `go-to-source`, `inspect-mode`, `edit-text`, `properties`, `spacing-and-alignment`, `ui-library`,
`drag-and-drop`, `copy-and-paste`, `wrap-with-layout`, `prompt-ai`, `listeners`, `views-and-routes`,
`impersonate-users`, `component-classes`, `accessibility-checker`. Never move or rename those pages or anchors.
