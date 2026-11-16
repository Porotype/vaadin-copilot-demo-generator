---
name: copilot-walkthroughs
description: Regenerate, fix, adjust or add the Vaadin Copilot docs walkthroughs (the step-by-step clips under Tools › Copilot › Features in vaadin/docs) with this repository. Use for any work on scenes/, director/, docs-content/ or apps/docs-app, for a Vaadin or Copilot version bump, for a scene that broke, for a new walkthrough, and for reviewing a recording.
---

# Copilot docs walkthroughs

Each walkthrough is a scene (a Playwright script) recorded against the real Copilot in `apps/docs-app`, in light and
dark, cut into one looping clip per step, and written into a vaadin/docs checkout with its step texts. Read
`README.md` first for the person's view (prerequisites, the commands); this is the rest.

## The pipeline

```bash
npm run regenerate -- 91                                     # all of the below for one scene (or none: all)
```

By hand, for one scene:

```bash
npm run apps -- start                                        # :8084 plain, :8085 secure profile (scripts/apps.ts)
npm run scene -- scenes/91-docs-edit-text.ts                 # light take → out/91-docs-edit-text/
DOCS_THEME=dark npm run scene -- scenes/91-docs-edit-text.ts # dark take  → out/91-docs-edit-text-dark/
npm run walkthrough -- 91-docs-edit-text 91-docs-edit-text-dark   # cut → out/<take>/steps/NN-<step>.mp4/.jpg
python3 -I docs-content/asciidoc.py . .work/docs 91-docs-edit-text  # partials and media into the docs checkout
python3 -I docs-content/contact_sheet.py . out/contact-sheet.html   # every step's poster, light and dark
```

`npm run regenerate` makes the docs branch (in `.work/docs`, or `DOCS_DIR`), starts and stops the apps, records each
scene light then dark, skips a failed scene and goes on, and prints what failed. See the header of
`scripts/regenerate.ts` for its options.

- **Scene** (`scenes/NN-docs-*.ts`): a Playwright script in the director's DSL (`director/dsl.ts`), built with
  `docsScene({...})` from `scenes/support/docs.ts`. Marks each step with `demo.step('<name>')`, and can draw an
  outline (`demo.outline(locator | rect | () => rect)`) on what the step's text points at. Other verbs: `click`,
  `type`, `press`, `moveTo`, `placeCursor`, `dragStart`/`dragTo`/`drop`, `waitFor`, `hold`, `zoom`/`unzoom`
  (`zoomToFit` in docs.ts), `between()` (a reset that's cut out), `step(name, { still, crop })`. Recording is
  1280×800 CSS px, captured at 1440×900, 30 fps; zoom re-rasterizes, so zoomed text is sharp.
- **A scene's phases**: `prepare` runs before the browser (app checks, config swaps), `setup` in the browser but
  not recorded, `run` is recorded. Anything registered with `defer` is undone afterwards, also when the take fails
  or is interrupted.
- **docsScene options**: `route`, `mode` (Copilot's mode at the start: play/inspect/edit/test), `editsSources`
  (default true: guard and restore the app's sources; a take that edits must leave the app as it found it), `ai`
  (allow Copilot AI), `baseUrl` (`app.SECURE_URL` for the app with a login), `ide` (a staged IDE beside the browser,
  for 93 and 107), `machineState` (values for Copilot's machine-wide config, e.g. `{ recentSwitchedUsernames: [] }`).
- **Sources**: `guardSources` (`scenes/support/docs-app.ts`) snapshots the app, compiles and restarts if anything
  was pending, and restores changed files and removes new ones afterwards. Copilot only writes files; an IDE would
  compile them. The Dev Loop has no watch mode, so `applyOnChange` runs `vaadin-dev apply` after each saved
  `.java`/`.css`. Edit scenes save the real change as `out/<take>/source.diff`.
- **Machine state**: Copilot keeps UI state in `~/.vaadin/copilot-configuration.json`. A take backs it up, sets a
  known state (`useDemoMachineConfig` in `director/copilot.ts`), and restores it. If a take is killed hard, the
  backup is in the take's output folder, and the next take refuses to start until it's put back.
- **Copilot plugins** load from cdn.vaadin.com in the browser; they're cached per Copilot version under `.cache/`.
- **Cutting** (`director/walkthrough.ts`): reads `out/<take>/steps.json` (written by `director/run.ts` from the step
  marks), cuts one clip per step plus a poster (the step's last frame), and writes `out/<take>/steps/steps.json`.
- **Text** (`docs-content/content.py`, `PAGES`): per page, its walkthroughs (`scene`, `docs` slug, `title`,
  optional `sections: True`) and per step the text, keyed by the step's name in the scene. Markup: `**bold**`,
  `` `code` `` (keys become `kbd:[…]`, file names the docs' `[filename]` role), and `[[words]]` for what the clip
  outlines (rendered in the outline's orange). `_ORDER` is the docs nav order. The light take, the dark take and
  content.py must have the same steps, or asciidoc.py stops.
- **Docs output** (`docs-content/asciidoc.py`): per walkthrough,
  `articles/tools/copilot/features/_walkthrough-<slug>.adoc` (a `[.walkthrough]` ordered list, one step per item,
  each with its clip), or for `sections: True` one partial per step, `_<slug>-<step>.adoc` (the menu page has a
  section per menu item). Media go to
  `src/main/resources/META-INF/resources/vaadin/videos/copilot/<slug>/NN-<step>[-dark].{mp4,jpg}`. The pages that
  include the partials (`features/*.adoc`, `features/index.adoc`) are **written by hand in the docs repo**; a
  re-record only changes what asciidoc.py writes. A new walkthrough needs a page (or a section) written there, with
  front matter (`title`, `page-title`, `description`, `meta-description`, `order`).
- **Player** (vaadin/docs `dspublisher/theme/walkthrough.ts`, CSS in `dspublisher/theme/global.css`): one step at a
  time with Back/Next, plays the clip in view, swaps in the `-dark` twin in the dark theme, preloads a walkthrough's
  clips, respects reduced motion. Changes to it are a docs PR.

## The app

`apps/docs-app`: a fresh start.vaadin.com project plus `contacts/ui/ContactView.java` (a form that adds its fields
with `add(...)`, see findings). It's committed and pinned; a Vaadin update is a bump of `vaadin.version`, not a new
project. Its `secure` Spring profile adds a login, users `user`/`user` and `admin`/`admin`, and admin-only views
(Users, Audit Log); without the profile there's no Spring Security at all, which matters: Copilot offers
impersonation whenever the app has a `SecurityFilterChain` bean. The plain app runs on :8084, the secure one on
:8085 from a synced copy in `.work/docs-app-secure` (one Dev Loop daemon per project folder). Details in
`apps/docs-app/README.md`. Both run under the Vaadin Dev Loop (`.vaadin/vaadin-dev start|apply|restart|status`);
its own skill is in `apps/docs-app/.claude/skills/vaadin-devloop/`.

`101-docs-component` writes a `ContactForm.java` before its take and removes it after; `106-docs-routes` creates
a view and the guard removes it.

## The walkthroughs

| Page | Scene | Slug | Steps |
| --- | --- | --- | --- |
| Toolbar | 90-docs-toolbar | toolbar | where, modes, menu |
| App Info, Logs & Settings | 94-docs-menu | menu (sections) | app-info, app-log, features, feedback, settings |
| Select | 96-docs-select | select | click, parent, keys, several |
| Go to Source | 93-docs-go-to-source | go-to-source | context-menu, ide |
| Inspect Mode | 105-docs-inspect | inspect | mode, select, properties |
| Edit Text | 91-docs-edit-text | edit-text | edit-mode, context, double-click |
| Properties | 97-docs-properties | properties | open, edit |
| Spacing & Alignment | 98-docs-layout | spacing-and-alignment | select, padding, align |
| UI Library | 95-docs-ui-library | ui-library | open, search, drag |
| Drag & Drop | 92-docs-drag-drop | drag-and-drop | select, drag, outline-open, outline-drag |
| Copy & Paste | 99-docs-copy-paste | copy-and-paste | duplicate, delete, copy, paste |
| Wrap with Layout | 100-docs-wrap | wrap-with-layout | select, wrap |
| Prompt AI | 102-docs-ai-icons, 103-docs-ai-format, 104-docs-ai-sections | ai-icons, ai-format, ai-sections | select, ask / ask / ask |
| Listeners | 107-docs-listener | listeners | menu, ide |
| Views & Routes | 106-docs-routes | views-and-routes | open, add, type, create, go |
| Impersonate Users | 110-docs-impersonate | impersonate-users | open, in, switch |
| Component Classes | 109-docs-extract, 101-docs-component | extract-component, component-classes | extract, result / select, enter, change, up |
| Accessibility Checker | 108-docs-a11y | accessibility-checker | open, check, issue |

## Rules for the content

- A few steps per walkthrough; each step loops on its own clip.
- **No text on the clips.** The words live in the page beside them (editable, translatable, searchable). An
  outline on what the text points at is fine; no callouts or cards.
- Each step ends on a hold (`END_HOLD`) with its outline still on: that last frame is the poster. Clear the
  outline at the start of the next step. A clip never starts by undoing the previous step; use `demo.between()`
  for a reset.
- Light and dark for every clip.
- **Don't show Copilot UX problems that aren't fixed yet.** Work around them off camera, and add them to
  `findings.md` (input for the Copilot team). Example: the component-class walkthrough uses a whole
  `ContactForm.java` instead of the view title, and selects a field right after entering so the "COMPOSITE" root
  selection isn't shown.
- Zoom so Copilot's UI reads at a docs column's width; keep popups inside the frame.
- Docs integration: one page per feature under Tools › Copilot › Features, basic to advanced. Never move or rename
  existing docs pages or anchors (Copilot and others link to them, see README "Links from Copilot").
- Page and text style: the docs' conventions (`CONVENTIONS.md` in the docs repo), and Vale with 0 errors and 0
  warnings (install `vale` and `asciidoctor`, run `vale sync` in the docs repo once, then
  `vale articles/tools/copilot/features/`).

## Fixing a scene that broke

Usually after a Vaadin (and so Copilot) bump.

1. Re-run just that scene, light only, to see it fail: `npm run scene -- scenes/<scene>.ts`. A failed take leaves
   its frames in `out/<take>/frames/`; the last one shows where it stopped. `--headed` shows the browser,
   `DEBUG=1` prints the page's console errors and failed requests.
2. Most breaks are selectors: Copilot's custom elements, panel tags and button labels change. Shared ones are in
   `director/copilot.ts`; scene-specific ones are in the scene. Find the new one in the running app with Playwright
   (Copilot's UI is in shadow DOM; Playwright's CSS locators pierce it).
3. If Copilot now behaves differently, adjust the steps. If it now behaves badly, don't show it: work around it
   off camera and note it in `findings.md`. If the step texts no longer match what the clip shows, change them in
   `content.py` (and the step names, in the scene and content.py together).
4. Record light and dark, cut, and **look at the frames** (below) before calling it done.
5. Commit the scene fix here; the clips go to docs with the next regenerate.

## Checking a take

- Re-check every take in **both** themes: the contact sheet (`out/contact-sheet.html`) shows each step's poster;
  also look at a few mid frames of the clips that move. A take "passes" when its checks pass, but framing
  problems (a popup cut off, an outline on the wrong thing, a notification in the way) only show in the frames.
  Frames are cheap to pull:
  ```bash
  ffmpeg -loglevel error -i out/<take>/scene.mp4 -vf "fps=1,scale=480:-1" /tmp/f%03d.jpg
  ```
- Scenes check their result (the view changed, the field is still in the form). Keep that up in new scenes: two
  takes once looked right and were wrong (a caption edit that broke the build, a drop that left the form).
- In the docs checkout, `git diff --stat` after a re-record should show only the re-encoded media (and text
  changes you made on purpose).

## Gotchas

- **One take at a time.** Never run two scenes at once: they share the app, the browser profile and
  `~/.vaadin/copilot-configuration.json`. Wait for one to finish: `pgrep -f "[t]sx director/run.ts"`.
- The AI scenes (102–104) depend on the AI's answer, so a take can differ or time out; re-run, and check the
  diff (`out/<take>/source.diff`). They need Copilot signed in to an account that may use AI.
- After an explicit `vaadin-dev apply`, the app's own hot-reload watcher can supersede it ("superseding"): retry
  (see `101-docs-component`'s setup).
- Your Vaadin account shows in Copilot's ⋮ menu: `hideAccount(page)` (docs.ts) blurs it, and must be re-applied
  after every page reload (e.g. impersonation reloads).
- Impersonation lives in the ⋮ menu ("Impersonate App User"), not the toolbar. Its recent usernames are
  machine-wide (`recentSwitchedUsernames`); the scene starts with an empty list via `machineState`.
- Copilot doesn't recognize the Dev Loop's hot swap: it warns that edits "will feel slow" (dismissed for every
  take) and some flows ask for a restart or wait for an IDE plugin event (see findings).
- **Held-still drags**: a real browser keeps firing `dragover` while the mouse is held mid-drag, and Copilot's
  drop zones depend on it; the director nudges the real mouse by half a pixel each frame while a drag is held.
  Headless Chromium draws no drag image, so `dragStart` screenshots the dragged element and the overlay draws it.
- **The top layer**: Copilot lives in the top layer (`popover="manual"`) and re-promotes itself whenever an overlay
  opens; the director's overlay is a manual popover too and re-raises itself every frame.
- Mode switching right after Copilot reports itself ready is sometimes ignored, so `Copilot.setMode` retries.
- `page.evaluate` with a named function fails under tsx (`__name is not defined`); docs.ts sets
  `window.__name = f => f` for every take.
- **Proxies**: Chromium ignores `HTTPS_PROXY`; the runner passes it through. Without network access to
  cdn.vaadin.com (or a cache in `.cache/`), edit mode has no plugins.
- Docs dev server (`npm run dspublisher:start` in the docs repo, http://localhost:8210, on `[::1]` only): a new or
  renamed page, or a changed partial, needs a **restart**, and the first requests after one return 500. Clips keep
  their names across re-records, so a browser may show cached ones (hard reload). Media URLs are
  `/vaadin/videos/copilot/<slug>/…`. Docs URLs have no trailing slash; relative media paths break if you add one.
- Commits for vaadin repos (the docs PR, and this repository if it moves to the vaadin org): no
  `Co-Authored-By: Claude` or other AI co-author trailers. The CLA check counts the co-author as an unsigned
  contributor and blocks the PR.

## Timing

In the stepped capture, the director's own motion is frame-exact: the cursor, outline, fades and zoom are computed
per output frame. The page still runs on wall-clock time, and each frame takes about 170 ms of real time, so
Copilot's own transitions and server waits look much faster in the video than they were. Good for compile and
hot-reload waits. A wait the viewer should feel uses `waitFor(…, { realtime: true })`; a long one that should pass
quickly (an AI answer) uses `speed` (see `askAI` in docs.ts).
