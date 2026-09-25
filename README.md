# TADoodle

A TAD-branded group scheduling app with names, shared polls, an availability grid, and full-duration overlap results. It uses a static React interface on GitHub Pages and Firebase Authentication + Cloud Firestore on the Spark plan.

## Included

- Poll title, organizer name, optional description, 1–14 dates, time range and meeting length.
- Named participant responses: Available, If needed, or unmarked/unavailable.
- Mouse painting, keyboard activation and touch tapping.
- Time-zone conversion using UTC instants, with daylight-saving handling.
- Ranked times based on availability for the entire meeting, not just its first half-hour.
- Organizer-only final time selection and reopening.
- Live shared responses once Firebase is connected.
- Responsive design, public source download, and a GitHub Pages workflow.

No Google/Outlook/Apple calendar sync, account screens, dashboards, email reminders, recurring availability groups, payments, or analytics are included. No emails or calendar invitations are sent when a time is chosen.

## Current delivery status

The app is hosted at https://theeray.github.io/TADoodle/ and the Pages workflow includes public configuration for Firebase project `tadoodle-35e15`. Repository variables can override that configuration. Local development without Firebase environment values still uses temporary preview data.

### Update required for title editing and copies

Publish the current `firestore.rules` in Firebase Console → Firestore → Rules. GitHub Pages deployment does not publish database rules. Existing polls remain compatible.

### Rename, copy, and reuse templates

- In the organizer's original browser, use **Edit title** to rename an open or closed poll. Its link, dates, and responses stay the same.
- **Copy poll** creates an independent open poll. Enter a new title and a replacement for each original date. Meeting length, description, names, and local time availability carry over. Save any pending response changes before copying.
- Copied responses are labeled as awaiting confirmation, and included in the availability summary. Participants using their original browser can save a new response that replaces their copied baseline. The baseline cannot be edited by the organizer after creation. Clearing browser data loses that participant identity.
- Times stay in the original poll's zone across daylight-saving offset changes. Missing or repeated clock-change hours are rejected rather than guessed. Copies support up to 400 responses.
- **Save as template** adds a shortcut to **Your templates** on the New poll page. The shortcut list is stored in this browser; bookmark the poll link as a backup. Removing a shortcut does not delete the poll. A template remains an ordinary poll, so later responses will be included in future copies.
- Phone layouts use larger touch targets, three date columns, stacked forms and scrollable dialogs.

The project is a new React/Firebase implementation inspired by Timeful; it is not a port of Timeful's full Vue/Go/MongoDB codebase. See NOTICE.md.

## Run the preview

Install Node.js 22 LTS and unzip the project.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. You can create a preview poll or choose “Try a sample poll.” No Firebase credentials are needed to preview the interface.

## Connect a free Firebase project

Use a separate new project so this app does not share quotas or rules with the Badge Tracker.

1. Open https://console.firebase.google.com/ and create a project. Keep the **Spark** plan; do not link a billing account. Google Analytics is not needed.
2. Add a **Web app** in Project settings. Copy its public `firebaseConfig` values. The four values needed here are `apiKey`, `authDomain`, `projectId`, and `appId`.
3. In **Authentication → Sign-in method**, enable **Anonymous**. This is a browser identifier behind the scenes. People still enter and display their names. Do not enable automatic anonymous-account cleanup, which would remove editing access for older polls.
4. Create **Cloud Firestore**, Standard edition, in production mode. Select an appropriate US region. Do not leave it in open/test mode.
5. In **Firestore → Rules**, replace the rules with this project's `firestore.rules` and publish them. Use a separate project; these rules intentionally grant access only to this app's `polls` collection.
6. In **Authentication → Settings → Authorized domains**, add the eventual GitHub Pages hostname (for example `theeray.github.io`). Add `localhost` only for local development if needed. Do not include paths or `https://`.
7. Copy `.env.example` to `.env.local`, fill in the four public values, and restart the local preview. The yellow preview banner disappears when all four values exist.
8. Open a poll in two different browsers or profiles. Confirm that named responses appear in both, that each person can edit only their own response, and that only the creator can choose a time.

The public web configuration is designed to be used in a browser. It is not a service-account key or a password. Never put service-account JSON, admin credentials, or private keys in the repository.

Optional: register your deployed app with Firebase App Check using reCAPTCHA v3, set the public `VITE_RECAPTCHA_SITE_KEY`, verify valid traffic, then enforce App Check for Firestore. This helps reduce unauthorized client traffic; it does not remove usage limits.

## Publish on GitHub Pages

1. Use the public GitHub repository `theeray/TADoodle`. Upload this project's source, including `.github/workflows/pages.yml` and `package-lock.json`, with `main` as the branch.
2. Firebase values are already configured in the workflow. To use a different project, optionally override them in **Settings → Secrets and variables → Actions → Variables**:

   | Variable | Firebase config value |
   | --- | --- |
   | `VITE_FIREBASE_API_KEY` | `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | `projectId` |
   | `VITE_FIREBASE_APP_ID` | `appId` |
   | `VITE_RECAPTCHA_SITE_KEY` | Optional reCAPTCHA v3 public site key |

3. In **Settings → Pages**, select **GitHub Actions** as the source.
4. Run **Actions → Deploy TADoodle to GitHub Pages → Run workflow**. It refuses to deploy an unconfigured preview as the shared app.
5. Use the actual URL reported by the deployment. Hash-based poll links work with GitHub Pages without server rewrites, including repositories served in a subfolder.

The workflow publishes only the static `dist` output. Deploying Firestore rules is a separate one-time step above. Alternatively, after `npx firebase login`, deploy only the rules with:

```sh
npx firebase deploy --only firestore:rules --project YOUR_FIREBASE_PROJECT_ID
```

Firebase Hosting is also supported by `firebase.json` if you prefer its free subdomain later. That does not require changing the interface.

## Free operation and limits

The intended setup uses GitHub Pages and Firebase's Spark plan, with no billing account. Cloud Functions, Cloud Run, file storage, SMS, and paid extensions are not used. A custom domain is optional.

Firestore Standard currently includes 50,000 reads/day, 20,000 writes/day, 20,000 deletes/day, 1 GiB stored data and 10 GiB/month outbound transfer. The quotas apply to the project, not to each poll. Live listeners and reconnects count toward usage. With Spark, exceeding a quota can interrupt the service; it does not automatically switch to paid billing. Provider limits may change. Check https://firebase.google.com/pricing before activation.

This app loads the responses for an open poll, not all polls. A 30-person poll opened once by all 30 participants uses roughly 900 response-document reads plus poll reads and later updates. Usage depends on how often pages reopen and responses change. Polls are capped at 672 half-hour cells to bound document size and rendering work.

## Names, identity and privacy

- Names are self-entered and not verified. Two people may use the same name; each browser has a separate identifier.
- An invisible Firebase anonymous identity protects edits; no visible signup is needed.
- Participants can edit only their own response. The organizer alone can close/reopen their poll. These restrictions are enforced in Firestore rules, not just hidden buttons.
- Editing access stays in the same browser/profile. Clearing browser data, switching devices, or deleting the Firebase identity loses that access. There is no account recovery or transferable organizer key in this version.
- Anyone with a poll link can view its names and availability. The app does not expose a list of all polls.
- One browser/profile holds one response per poll. Shared devices require separate profiles.
- Polls and responses persist until a project administrator deletes them. There is no paid automatic retention job.
- Nobody else's response is changed when the organizer picks a meeting time. Poll responses are frozen until the poll reopens.

## Verify

```sh
npm test
npm run test:rules
npm run build
```

The Firestore rules suite uses the local emulator, project ID `demo-tad-meet`, and no production database. Java 17+ is required for the pinned emulator version. The tests cover ownership, response isolation, invalid fields, invalid availability, closed polls, and blocked poll enumeration. The scheduling suite covers complete meeting overlap, if-needed availability, daylight-saving transitions, date changes across zones, and input validation.

`npm run build` generates `public/source.zip` from the current source and copies it into `dist`, alongside the complete license. Keep the source download in published versions. A `zip` command is required (included on the GitHub Actions Ubuntu runner; on Windows, use WSL or Git Bash with zip installed).

## License

AGPL-3.0-or-later. See LICENSE and NOTICE.md. The supplied TADoodle SVG logo is used, with turquoise, yellow and coral accents.
