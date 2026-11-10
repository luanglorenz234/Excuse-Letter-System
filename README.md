# Alpha Premier — OJT Absence Request System (Final v1.0)

This project implements the **Final Plan v1.0** for the **Alpha Premier Group OJT Absence Request System**.

## Project Files
- `index.html` — Single-page application shell with `html2canvas` + `jsPDF` for client-side A4 PDF export.
- `styles.css` — Full layout styling, including the **Locked Alpha Premier A4 Letterhead** (`794px × 1123px` standard A4 aspect ratio + `@media print` rules).
- `app.js` — Complete state management, pure-function locked letter renderer (`renderLockedLetterHTML`), duplicate slot guard (`absenceSlots/{uid}_{yyyy-mm-dd}_{am|pm}`), Firestore approval transaction simulation (`counters/{year}`), signature pad canvas, CSV export, and all 8 screens.
- `firebase-config.js` — Firebase Auth & Cloud Firestore configuration adapter.
- `firestore.rules` — Production Firestore Security Rules enforcing role-based and status-based field restrictions.

## All 8 Screens Implemented
1. **Login / Self-Registration (`renderLoginScreen`)** — Includes Decision #6 flow where newly registered interns start as `pending` until HR activates them and assigns their official Intern ID, Position, Department, and Required Hours.
2. **Intern Dashboard (`renderInternDashboard`)** — Displays OJT hours tracker (Required, Gross Rendered, Approved Absence Deductions, Pending Deductions, Net Remaining Hours), returned-for-revision alerts, recent requests, and locked profile + saved signature.
3. **New / Revise Request (`renderNewRequestScreen`)** — Split-screen workspace: variable input form on the left (with 7-day backdate rule, weekday-only counter for multi-day requests, 30–400 character counter, duplicate slot guard, and HTML5 signature pad / PNG upload) + live A4 Alpha Premier letterhead preview on the right.
4. **My Requests (`renderMyRequestsScreen`)** — Filterable request history with status pills, letter modal viewer, **Withdraw** (for `submitted`), **Edit / Revise** (for `draft` and `returned`), and **Download PDF** (for `approved`).
5. **HR Review Queue & Analytics (`renderHRQueueScreen`)** — Prioritizes pending (`submitted`) requests first, filters by status/category/department, displays absence analytics, and exports filtered records to CSV.
6. **HR Review Screen (`renderHRReviewScreen`)** — Side-by-side rendered A4 letter preview beside request metadata, intern's OJT hours & past absence history, immutable audit trail timeline, and **Approve / Return for Revision / Decline** transaction actions.
7. **HR Attendance Calendar (`renderHRCalendarScreen`)** — Interactive monthly grid showing absent interns per day (`[FULL]`, `[AM]`, `[PM]`).
8. **HR Settings (`renderHRSettingsScreen`)** — Manages `settings/letter` (Signatory Name/Title, Subject line, Address block, Apology/Closing paragraphs, HR signature, and `attachmentsEnabled` feature flag) and activates/edits Intern profiles (`users/{uid}`).
