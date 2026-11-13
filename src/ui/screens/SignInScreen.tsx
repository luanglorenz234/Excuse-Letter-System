import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEMP_ACCOUNTS } from '@/config';
import { register, signIn, type SignInMode } from '@/core/accounts';
import { Button, Card, Notice, TextInput } from '../components';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';
import { homeFor } from '../App';

/** Sign in, and for employees, register. HR accounts can only sign in. Interns have no account. */
export function SignInScreen({ mode }: { mode: SignInMode }) {
  const app = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBusy, setRegBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await signIn(app.db, email, password, mode);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    app.signInAs(result.user.uid);
    app.notify(`Signed in as ${result.user.name}.`);
    navigate(homeFor(result.user));
  };

  const submitRegistration = async (e: FormEvent) => {
    e.preventDefault();
    setRegBusy(true);
    const outcome = await register(app.db, { name: regName, email: regEmail, password: regPassword }, new Date());
    const saved = await app.run(outcome);
    setRegBusy(false);
    if (saved && outcome.ok) {
      app.signInAs(outcome.value.user.uid);
      navigate(paths.dashboard);
    }
  };

  const testAccount = TEMP_ACCOUNTS.find((a) => a.role === (mode === 'admin' ? 'hr' : 'employee'));

  return (
    <div className={`signin${mode === 'admin' ? ' signin--single' : ''}`}>
      <Card
        title={mode === 'admin' ? 'Login as admin' : 'Employee sign-in'}
        description={mode === 'admin' ? 'For HR. Review and approve absence letters.' : 'Employees only. Interns use the intern absence form; no account needed.'}
      >
        <form className="stack" onSubmit={submit} noValidate>
          <TextInput label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextInput label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error ? (
            <Notice tone="danger" live>
              {error}
            </Notice>
          ) : null}
          <div className="row">
            <Button type="submit" variant="primary" busy={busy}>
              Sign in
            </Button>
            <Button type="button" variant="link" onClick={() => navigate(paths.home)}>
              Back
            </Button>
          </div>
          {testAccount ? (
            <p className="small muted">
              Testing? The test {mode === 'admin' ? 'HR' : 'employee'} login is in <code>src/config.ts</code>.{' '}
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setEmail(testAccount.email);
                  setPassword(testAccount.password);
                }}
              >
                Fill it in
              </Button>
            </p>
          ) : null}
        </form>
      </Card>

      {mode === 'member' ? (
        <Card title="New employee? Register" description="Your account is active right away. You type your position and department on each letter.">
          <form className="stack" onSubmit={submitRegistration} noValidate>
            <TextInput label="Full name" value={regName} onChange={(e) => setRegName(e.target.value)} autoComplete="name" required />
            <TextInput label="Email" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} autoComplete="email" required />
            <TextInput
              label="Password"
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              autoComplete="new-password"
              hint="At least 8 characters."
              required
            />
            <div>
              <Button type="submit" variant="ghost" busy={regBusy}>
                Register
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
