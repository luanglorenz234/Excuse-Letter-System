/**
 * TEMPORARY test logins, until a real sign-in (Firebase Auth) is connected.
 *
 * They are checked inside the app, so anyone with the source can read them:
 * never put a real password here. Each is linked to a sample account in
 * src/core/seed.json by `uid`.
 *   - HR:       "Login as admin"
 *   - Employee: "Employee sign-in"
 * Interns have no login: they use the intern form on the home screen.
 */
export interface TempAccount {
  readonly uid: string;
  readonly role: 'hr' | 'employee';
  readonly email: string;
  readonly password: string;
}

export const TEMP_ACCOUNTS: readonly TempAccount[] = [
  { uid: 'hr-chico', role: 'hr', email: 'jachico@alphapremier.com', password: 'HrTemp#2026' },
  { uid: 'emp-carlos', role: 'employee', email: 'demo@employee.com', password: 'EmployeeTemp#2026' },
];

/**
 * The test bar at the top: switch to any sample person in one click and reset
 * the data. For local testing only; set to false before handing the app out.
 */
export const SHOW_TEST_BAR = true;
