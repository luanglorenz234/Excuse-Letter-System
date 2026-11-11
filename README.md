# Alpha Premier — Absence Request System (Final v1.0)

This project implements the **Final Plan v1.0** for the **Alpha Premier Group Leave of Absence Request System** (for Interns and Employees).

## Project Files
- `index.html` — Single-page application shell with `html2canvas` + `jsPDF` for client-side A4 PDF export.
- `styles.css` — Full layout styling, including the **Locked Alpha Premier A4 Letterhead** (`794px × 1123px` standard A4 aspect ratio + `@media print` rules).
- `app.js` — Complete state management, pure-function locked letter renderer (`renderLockedLetterHTML`), duplicate slot guard (`absenceSlots/{uid}_{yyyy-mm-dd}_{am|pm}`), Firestore approval transaction simulation (`counters/{year}`), signature pad canvas, CSV export, and all 8 screens.
- `firebase-config.js` — Firebase Auth & Cloud Firestore configuration adapter.
- `firestore.rules` — Production Firestore Security Rules enforcing role-based and status-based field restrictions.

## All 8 Screens Implemented
1. **Login / Self-Registration (`renderLoginScreen`)** — Includes Decision #6 flow where newly registered interns start as `pending` until HR activates them and assigns their official Intern ID, Position, Department, and Required Hours.
2. **Member Dashboard (`renderInternDashboard`)** — Displays hours tracker (Required/Target, Gross Rendered, Approved Absence Deductions, Pending Deductions, Net Remaining Hours), returned-for-revision alerts, recent requests, and locked profile + saved signature.
3. **New / Revise Request (`renderNewRequestScreen`)** — Split-screen workspace: variable input form on the left (with Intern / Employee type selector, 7-day backdate rule, weekday-only counter for multi-day requests, 30–400 character counter, duplicate slot guard, and HTML5 signature pad / PNG upload) + live A4 Alpha Premier letterhead preview on the right.
4. **My Requests (`renderMyRequestsScreen`)** — Filterable request history with status pills, letter modal viewer, **Withdraw** (for `submitted`), **Edit / Revise** (for `draft` and `returned`), and **Download PDF** (for `approved`).
5. **HR Review Queue & Analytics (`renderHRQueueScreen`)** — Prioritizes pending (`submitted`) requests first, filters by status/category/department, displays absence analytics, and exports filtered records to CSV.
6. **HR Review Screen (`renderHRReviewScreen`)** — Side-by-side rendered A4 letter preview beside request metadata, member hours & past absence history, immutable audit trail timeline, and **Approve / Return for Revision / Decline** transaction actions.
7. **HR Attendance Calendar (`renderHRCalendarScreen`)** — Interactive monthly grid showing absent interns per day (`[FULL]`, `[AM]`, `[PM]`).
8. **HR Settings (`renderHRSettingsScreen`)** — Manages `settings/letter` (Signatory Name/Title, Subject line, Address block, Apology/Closing paragraphs, HR signature, and `attachmentsEnabled` feature flag) and activates/edits Intern profiles (`users/{uid}`).

## Run It Locally (no Firebase needed)
The app runs entirely in your browser. All data is saved in that browser's `localStorage`, so nothing needs to be installed or connected.

1. Download or clone this repository.
2. Start a small local web server in the project folder (recommended, so the print/PDF and images behave like a real site):
   ```bash
   python -m http.server 5173
   ```
   Then open <http://localhost:5173>. You can also just double-click `index.html`.
3. Sign in with one of the test logins below, or use the **demo bar** at the top to switch between people in one click (Juan, Sofia, John, Mark, Kevs, Carlos, the pending intern Maria, and HR).
4. **↺ Reset Seed Data** in the demo bar clears everything you entered and restores the sample data.

`firebase-config.js` keeps `useLiveFirebase: false` for local use. Set `showDemoBar: false` to hide the demo bar.

### What to try
| Who | What you can do |
| --- | --- |
| Intern / employee | File a full-day, half-day or multi-day request; sign digitally (draw or upload) or by hand (upload a photo, or hand in the paper copy); save as draft; edit a draft, a returned letter, **or a request still waiting for HR**; withdraw a pending request; print / save the approved letter as PDF. |
| Group (same reason) | In **New Request → Who is absent?**, choose **Group (same reason)**. Add people from the list (e.g. John, Mark and Kevs) or type in someone who has no account. Up to 6 people per letter. With a digital signature each person signs on their own pad; with a wet signature everyone signs the printed letter. The letter switches to "We … our" wording and shows every signature. The request also appears in each listed person's **My Requests** (view only). |
| HR | Review queue with filters and CSV export (group requests list everyone), approve / return / decline, mark paper copies received, compare signatures, attendance calendar (group entries show "Juan +3"), edit the letter wording (including the group wording) and activate new members. |

The duplicate-date guard covers everyone on a group letter: if John already has a pending or approved absence that day, the group request is blocked and names him.

## Temporary Test Logins
Until Firebase Auth is connected, sign-in is checked in the browser. Two test accounts are defined in `temp-login.js`:
- **HR / admin** — use **Login as Admin**
- **Intern** — use **Answer Absence Form**

Accounts created through the register form store a hashed password in that browser only. Remove `temp-login.js` (and its `<script>` tag in `index.html`) once Firebase Auth is in place. Never put real passwords in that file: anyone can read it.
