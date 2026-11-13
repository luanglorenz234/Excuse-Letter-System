# APG Excuse Letters

Alpha Premier Group's leave-of-absence letters for interns and employees, as a **Windows desktop app**. Interns and employees fill in one form with **no account**: they file a letter (alone or as a group), sign it, send it to HR, and get a letter code to come back to it. Only **HR signs in**. HR reviews the letter beside the rendered A4 page, comments on words in it, and returns or declines it. The **HR officer** named in Settings approves. Approved letters get a reference number and the officer's signature, and print or save as PDF.

The letters live on the **apg-letters** Firebase project, shared by every PC running the app. It is built on the same stack and layout as **APG Post-It**, so the two apps can be joined later.

| | |
| --- | --- |
| Desktop shell | Tauri 2 (Rust), WebView2 |
| Screens | React 18 + TypeScript (strict), Vite 5, React Router (hash routes) |
| Server | Firebase project `apg-letters`: Cloud Functions (`asia-southeast1`), Firestore, email/password sign-in for HR |
| Tests | Vitest: the rules, the server handlers, the whole app in a simulated browser, and the Cloud Functions on Firebase's emulator |
| Design | Post-It's design system: `src/theme/tokens.css`, Montserrat, gold accents, dark by default |

![Sample employee letter](docs/sample-letter.png)

### The letter

The 2026 "Notice of Absence" format on the new letterhead, in two versions. The form asks **"Intern or employee?"** and makes the matching letter:

| | Intern | Employee |
| --- | --- | --- |
| Greeting | Good day, | Dear Ma'am Jean: |
| First paragraph | "I am respectfully requesting permission to take a leave of absence on [date] as [reason]" | "I am writing to respectfully request permission to be absent from work [tomorrow,] [date], as [reason]" |
| Closing | Respectfully, (name only) | Very respectfully yours, (name and position) |
| Noted by | HR Officer | CEO, HR Officer, HR / Marketing Officer |

The reason finishes the first sentence ("…on Tuesday, October 27, 2026 as I have a meeting…"). The wording is fixed. In **Settings → Letter**, HR changes who the letter is addressed to and who is listed under "Noted by". The approval signature goes above the HR officer's name. On the employee letter, the CEO and the HR / Marketing Officer sign the printed copy by hand. A very long letter shrinks its type slightly so it always fits one page.

### HR's comments

Comments work like Google Docs comments. While a letter waits for review, HR selects words on the letter and comments on them. The words are highlighted, with the comment beside them. New comments stay private until HR returns (or declines) the letter. Then the filer, opening the letter with its code, sees the same highlights and fixes the letter. If they rewrite the commented words, the comment says so. HR resolves each comment, or all at once, before approving. Highlights never print.

## Who does what

| Who | How |
| --- | --- |
| Interns and employees | No account. **Absence form** on the home screen: pick intern or employee, type your name, department (and position, for employees), fill in the absence, sign, send. You get a 6-character **letter code** (like `K7Q-4MZ`). Enter it on the home screen to see the status and HR's comments, change a letter still waiting, revise a returned one, withdraw a waiting one, or print the approved one. Anyone with the code can open the letter, so keep it private. |
| HR | **HR sign-in**, with an account made in the Firebase console. The first sign-in asks for your name, which goes on reviews, comments and approvals. Every HR account can comment, return, decline and mark paper copies received. |
| The HR officer | The one HR account named in **Settings** by sign-in email. Only that account approves (and so signs) letters and changes Settings. Until one is named, any HR account may name it; after that, only the officer can hand it over. |

Sign-in is for HR only, so there are no roles to manage: every account on the apg-letters project is HR. That holds only while nobody else can make an account, which is why sign-up must stay switched off in the Firebase console (see below).

Rules that hold everywhere: no one can be booked twice for the same half-day (also across group letters, matched by name); dates can't be more than 7 days back; one letter covers at most 60 weekdays; the reason is 30–400 characters; approval needs the paper copy first for hand-in letters, and every comment resolved; returning needs remarks or a comment; returned and declined letters free their dates.

## Run it

You need **Node.js 20+**, and for the desktop app **Rust** (stable, MSVC toolchain) with the Microsoft C++ build tools and WebView2 (already on Windows 11). See <https://tauri.app/start/prerequisites/>. The Firebase emulator also needs **Java 11+**.

```bash
npm install
```

| Command | What it does |
| --- | --- |
| `npm run dev` | The screens in a browser at <http://localhost:1421> with **no Firebase**: the server's handlers run in the page on the sample data, kept in `localStorage`. A test bar switches between the sample HR accounts and the form, and has **Reset sample data**. |
| `npm run dev:emulator` | The screens against **Firebase's emulator** on this PC. Start the emulator first: `npm run dev` in `firebase/`. |
| `npm run tauri dev` | The desktop app with live reload, on the local stand-in like `npm run dev`. The first run compiles Rust and takes a few minutes. |
| `npm run tauri build` | Builds the installer (`src-tauri/target/release/bundle/`). **The installed app uses the live apg-letters project.** |
| `npm test` | The rules, the server handlers and the whole app in a simulated browser. |
| `npm run build` | Type-checks and builds the screens into `dist/`. |

Development never reaches the live project: `npm run dev` has no Firebase at all, and the emulator is a `demo-` project that can't.

The sample HR accounts (local stand-in and emulator only, never real ones) are in [`src/config.ts`](src/config.ts): `chico@apg-letters.test` is the HR officer, `ana@apg-letters.test` is HR with no name yet. Sample letter codes: `K7Q-4MZ` (returned with comments), `D8M-3JR` (waiting for HR).

## The server (`firebase/`)

```
firebase/
  firebase.json         Cloud Functions (codebase "letters"), Firestore rules and indexes, emulator ports 9100 / 8100 / 5100
  firestore.rules       Nobody reads or writes Firestore directly: everything goes through the functions.
  functions/src/        index.ts: publicApi (the form and letter codes, no sign-in) and hrApi (HR, signed in);
                        firestore-store.ts: the handlers' reads and writes as Firestore transactions;
                        throttle.ts: hourly limits on wrong letter codes and new letters.
  tests/                The functions on the emulator: sign-in, letters racing for one day or one reference number, the closed database.
```

Both functions run the handlers in `src/server/handlers.ts`, the same ones `npm run dev` runs in the page, which run the rules in `src/core`. The build bundles them into one file with esbuild. In `firebase/`:

| Command | What it does |
| --- | --- |
| `npm install` | Once (and `npm install` in `firebase/functions`). |
| `npm run dev` | The emulator, with the two sample HR accounts and the officer named. Ctrl+C stops it. |
| `npm test` | Builds the functions and runs the emulator tests. |
| `npm run deploy` | Deploys the functions and the Firestore rules and indexes to **apg-letters**. Needs `npx firebase login` first. |

Firestore holds `requests/{id}` (a letter, its history and HR's comments), `slots/{person_date_half}` (the duplicate guard), `config/settings` (the letter settings and the HR officer), `config/counters` (the next reference number per year) and `throttle/` (the hourly counts). Every action is one transaction: two letters for the same half-day, or two approvals at once, can't both win.

### Setting up apg-letters

1. **Authentication → Sign-in method:** Email/Password on.
2. **Authentication → Settings → User actions:** untick **Enable create (sign-up)** (and **deletion**). This is what keeps every account HR.
3. **Authentication → Users → Add user** for each HR person. Passwords are set there; nobody shares them with the app's developers.
4. **Firestore:** created in `asia-southeast1`.
5. Deploy: `npm run deploy` in `firebase/`.
6. The first HR person signs in, gives their name, and names the HR officer in **Settings**.

Optional: a Firestore TTL policy on the `throttle` collection's `expireAt` field deletes old counts.

## How the code is laid out

Same structure as APG Post-It:

```
src/
  core/        Rules as plain functions: (data, input) → changes to save, or why not. No React, no Firebase.
  server/      The server: handlers.ts (what each call may do), parse.ts (checks everything sent), the store interface,
               and an in-memory store for tests and the local stand-in.
  backend/     How the screens reach the server: firebase.ts (live or emulator), local.ts (npm run dev, no Firebase).
  platform/    The only way out to the OS: tauri.ts (CSV export, window), browser.ts (dev), memory.ts (tests).
  theme/       Design tokens and base styles, copied from Post-It.
  ui/          React: components/ (Post-It's), letter/ (the A4 letter and printing), screens/, state/.
src-tauri/
  src/files.rs Saves CSV exports inside Downloads\APG Excuse Letters only.
  capabilities/ What the screens are allowed to call.
firebase/      The Cloud Functions and Firestore set-up (above).
```

## What changed

- **From the web version:** the browser app (`app.js`, `styles.css`, `server.js`, `db.js`, `firebase-config.js`) was replaced by this desktop app; it is in git history (commit `a15ace8` and earlier).
- **From the first desktop version:** letters moved from a SQLite file on each PC to the shared apg-letters Firebase project. Employee accounts are gone (employees use the form like interns), and the only sign-in is HR's. A PC that ran the first desktop version still has its old file at `%LOCALAPPDATA%\com.alphapremier.apgexcuseletters\excuse-letters.db`; the app no longer reads it.
