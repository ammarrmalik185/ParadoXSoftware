# ParadoXSoftware

A black/red company website and platform-organized application catalog, hosted on Firebase Hosting with an additional GitHub Pages deployment workflow.

## Login and editing

Visitors can browse without an account. Select **Sign in**, then use the existing portfolio owner's Google account or email/password account. Only Firebase UID `Lyc9SMw7dGPhtkbHMw8QADWgmFc2` can open the content studio and add, edit, import, or remove projects. Signing in with another account grants view-only access.

Authentication is enforced in the UI and in the deployed Firestore rules. Closing the browser preserves the Firebase sign-in session; **Sign out** ends it on this browser. The GitHub Pages domain `ammarrmalik185.github.io` is authorized for Firebase sign-in. The Google and email/password providers were already enabled and remain unchanged.

In **Content studio → Link personal project**, select one or more projects using the checkboxes, then choose **Link selected projects**. Selection is preserved while searching; **Select all visible** selects matching, unlinked projects. Already linked projects cannot be selected again. The selected links are saved together in one transaction, and a failed save keeps the selection available to retry.

## Company storage and personal-project links

Company entries live in `paradoxSoftwareProjects/{companyProjectId}`. Company information and the shared catalog revision live in `paradoxSoftwareSettings/catalog`. Imported entries store only a `personalProjectRef` reference to `projects/{personalProjectId}`, the source ID, and company-specific platforms/category/card color. Source titles, descriptions, images, and URLs are never copied into imported entries. Standalone company projects store their own details.

Firestore listeners update the company catalog and linked personal-project details live. The original title, summary, image, URLs, and supported Editor.js text are loaded directly from the source for display. Removing a company link deletes only its company entry. The existing personal `projects` collection is never written by the app. Missing or inaccessible sources show an unavailable state; there is no copied fallback content. Rules reject imported entries that contain copied details.

The portfolio's `project.platforms` array is also imported and kept live. Android, Web, iOS, Windows, macOS, and Linux are supported, using the portfolio's case-insensitive normalization and deduplication. Imported add/edit forms show only an import notice and save controls; details and platforms are managed in the personal portfolio. Older projects without this field keep their catalog platform selection; an explicitly empty source array is respected.

Standalone company projects also support custom platforms. In their add/edit form, enter a name under **Custom platform**, then press Enter or **Add**. Custom names become selectable alongside standard platforms and appear automatically in the catalog filters. Names are trimmed, deduplicated without regard to case, and limited to 40 characters, with up to 20 platforms per standalone project. Linked projects continue to use the portfolio's supported platforms.

Saves use a Firestore transaction and catalog revision to reject conflicting edits. The earlier local catalog was copied into the new company collection; all 23 existing personal-project document versions were verified unchanged.

## Development and checks

Use Node.js 24:

```sh
cd studio
npm ci
npm run dev
```

Open `http://localhost:5173` for local Google sign-in. The development app connects to the configured Firebase project; it does not use a mock login.

```sh
npm run build:pages
node scripts/check-pages.mjs
node scripts/check-portfolio.mjs
npm run test:firestore
```

The Firestore tests use `demo-paradoxsoftware` on the local emulator at `127.0.0.1:8088`; they never touch production data. Java 21 or later is required. CI supplies Java 21; an optional ignored project-local runtime is supported on Windows.

## GitHub Pages CI/CD

`.github/workflows/pages.yml` checks pull requests and builds/deploys pushes to `main` or `master`. It also supports **Actions → GitHub Pages → Run workflow**. In repository **Settings → Pages**, select **GitHub Actions** as the publishing source. The expected project URL is `https://ammarrmalik185.github.io/ParadoXSoftware/`; the deployment job reports the actual URL on success.

Content edits are saved directly to Firestore and appear to visitors without rebuilding. No private Sites backend, snapshot export, or `SITES_READ_TOKEN` is used. The bundled `studio/content/site.json` is only an initial fallback; the Firestore catalog is authoritative once initialized.

## Firebase Hosting

The same app can deploy to **paradox-software** in Firebase project **ammarportfolioweb**. Its Hosting URL is `https://paradox-software.web.app`. `studio/firebase.json` contains Hosting configuration only, and `studio/.firebaserc` maps the `paradox-software` target exclusively to that site. Deploying this target does not publish to the personal portfolio sites or deploy database rules.

```sh
cd studio
npm run deploy:firebase
```

This builds `studio/dist-firebase/` with root-relative asset paths, validates the artifact and target mapping, and runs `firebase deploy --only hosting:paradox-software`. Use an authorized Firebase CLI login for local deployment. Google sign-in supports both `paradox-software.web.app` and `paradox-software.firebaseapp.com` after the scoped authorization setup in `scripts/authorize-hosting-domains.mjs`.

`.github/workflows/firebase-hosting.yml` checks pull requests without deploying. Firebase deployment runs only when explicitly started through **Actions → Firebase Hosting → Run workflow**, or locally with `npm run deploy:firebase`. Pushes do not trigger Firebase deployment. Manual GitHub deployment uses the repository Actions secret **FIREBASE_SERVICE_ACCOUNT_AMMARPORTFOLIOWEB**, containing a service account JSON credential authorized for Firebase Hosting deployment in `ammarportfolioweb`. No credential is committed or generated by this setup. The deploy job fails with an explicit message until the secret is configured.

GitHub Pages continues to use its separate `build:pages` output and repository base path; Firebase Hosting uses `build:firebase` and `/`.

`studio/content/site.json` also stores only metadata for imported entries. The explicit `node scripts/migrate-project-links.mjs --apply` migration removes copied fields from existing imports, using document-version preconditions and preserving standalone company entries and all personal-project versions. Without `--apply` it is read-only.

## Firebase setup and rule maintenance

`studio/firestore.rules` contains the reviewed, merged production rules. The existing signed-in write policy for other collections was preserved; only the two new company collections have owner-only writes. Their matches are also supplied in `studio/firestore.company.rules.fragment` for review. Keep the owner UID aligned with `studio/app/catalog-policy.ts`.

The one-time setup is complete. `node scripts/setup-company-firestore.mjs` performs a read-only plan. Its explicit `--apply` mode checks the previously reviewed rule hash, creates only missing company records with create-only preconditions, preserves existing sign-in domains/providers, and verifies that personal-project versions did not change. It refuses to replace unreviewed rule changes or overwrite existing company records. It requires an authorized Firebase CLI login.

No new Sites versions or private deployments are created. The old Sites URL from earlier work was `https://paradoxsoftware-studio.qinmin-0747.chatgpt.site`; it is no longer part of this app's editing or data flow.
