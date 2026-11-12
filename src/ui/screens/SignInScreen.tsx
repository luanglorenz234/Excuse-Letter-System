import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TEMP_ACCOUNTS } from '@/config';
import { register, signIn, type SignInMode } from '@/core/accounts';
import type { MemberType } from '@/core/types';
import { Button, Card, Notice, TextInput } from '../components';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';
import { homeFor } from '../App';

/** Sign in, and for interns and employees, register. HR accounts can only sign in. */
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
  const [regType, setRegType] = useState<MemberType>('intern');
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
    const outcome = await register(app.db, { name: regName, email: regEmail, password: regPassword, memberType: regType }, new Date());
    const saved = await app.run(outcome);
    setRegBusy(false);
    if (saved && outcome.ok) {
      app.signInAs(outcome.value.user.uid);
      navigate(paths.dashboard);
    }
  };

  const testAccount = TEMP_ACCOUNTS.find((a) => a.role === (mode === 'admin' ? 'hr' : 'intern'));

  return (
    <div className={`signin${mode === 'admin' ? ' signin--single' : ''}`}>
      <Card title={mode === 'admin' ? 'Login as admin' : 'Sign in'} description={mode === 'admin' ? 'For HR. Review and approve absence letters.' : 'Interns and employees.'}>
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
              Testing? The test {mode === 'admin' ? 'HR' : 'intern'} login is in <code>src/config.ts</code>.{' '}
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
        <Card title="New here? Register" description="Your account is active right away. HR can correct your ID number and position later.">
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
            <div className="field">
              <label className="field__label" htmlFor="reg-type">
                I am an
              </label>
              <select id="reg-type" className="field__select" value={regType} onChange={(e) => setRegType(e.target.value === 'employee' ? 'employee' : 'intern')}>
                <option value="intern">Intern</option>
                <option value="employee">Employee</option>
              </select>
            </div>
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
