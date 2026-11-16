# docs-app

The app the Copilot docs walkthroughs are recorded in (`scenes/*-docs-*.ts`, `scenes/support/docs.ts`): a fresh
project from start.vaadin.com, plus one small form view, `contacts/ui/ContactView.java`, for the walkthroughs that need
a form. It adds its components with `add(…)`, as the generated views do: Copilot's rename of a variable (which comes
with an in-place caption edit) misses constructor arguments and breaks the build (`findings.md`).

It runs twice, under the Vaadin Dev Loop (`npm run apps -- start`, or `npm run regenerate`, which starts and stops
them):

- **:8084, plain**: no login, no Spring Security. Most walkthroughs record here. Takes change its sources and put
  them back afterwards (`scenes/support/docs-app.ts`).
- **:8085, the `secure` profile**, for the impersonation walkthrough (`scenes/110-docs-impersonate.ts`). A project
  has one Dev Loop daemon, so this one runs from a copy, `.work/docs-app-secure`, synced before each start.

## The secure profile

Spring Security is on the classpath, but without the `secure` profile its auto-configuration is excluded
(`application.properties`): the plain app has no `SecurityFilterChain`, so there's no login, and Copilot offers no
user impersonation. `application-secure.properties` turns it back on, and `base/security/SecurityConfig.java`, which
exists only in that profile:

- signs in with `LoginView` (as in the docs' Add Login guide), with two in-memory users, `user` (role USER) and
  `admin` (USER and ADMIN), with their names as their passwords. A signed-in user is forwarded from the login view to
  the app, since Copilot reloads the page it's on after a user switch;
- registers the login and two admin-only views, Users and Audit Log (`admin/ui/`, `@RolesAllowed("ADMIN")`).
  They're `registerAtStartup = false`, so the plain app has no such routes and its menu shows Task List and New
  Contact only. The side nav lists only the views the user may open, so it changes with the user;
- treats views and layouts without an access annotation as `@PermitAll`, so the shared views stay as
  start.vaadin.com wrote them;
- `MainLayout` shows the signed-in user and Log out at the bottom of the drawer instead of "Made with ❤️ with Vaadin".

## Updating Vaadin

Change `vaadin.version` in `pom.xml` (and `java.version` or the Spring Boot parent if the new version needs it),
then `npm run regenerate` and fix what breaks. Don't regenerate the project from start.vaadin.com: the scenes depend
on its exact content.

## By hand

    npm run apps -- start            # both, from the repository root
    npm run apps -- stop
    apps/docs-app/.vaadin/vaadin-dev status

The Dev Loop's skill for agents is in `.claude/skills/vaadin-devloop/` (and `.agents/`).
