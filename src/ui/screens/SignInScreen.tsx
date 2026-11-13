import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Notice, TextInput } from '../components';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';

/**
 * HR sign-in. Every account on the apg-letters Firebase project is HR: they
 * are made in the Firebase console, and nobody can make one from the app.
 */
export function SignInScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sample = app.backend.sample;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const problem = await app.signIn(email, password);
    setBusy(false);
    setError(problem);
    // Signed in: the app opens HR's screens by itself.
  };

  return (
    <div className="signin signin--single">
      <Card title="HR sign-in" description="Review and approve absence letters. Interns and employees don't need an account: they use the absence form.">
        <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
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
          {sample ? (
            <p className="small muted">
              Test mode: the sample HR accounts are in <code>src/config.ts</code>.{' '}
              {sample.accounts.map((a) => (
                <Button
                  key={a.email}
                  type="button"
                  variant="link"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                  }}
                >
                  Fill in {a.label}
                </Button>
              ))}
            </p>
          ) : (
            <p className="small muted">Forgot the password, or need an account? Ask whoever manages the apg-letters Firebase project.</p>
          )}
        </form>
      </Card>
    </div>
  );
}

/** The first sign-in: the account's name, which goes on reviews, comments and approvals. */
export function NameScreen() {
  const app = useApp();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const problem = await app.setName(name);
    setBusy(false);
    setError(problem);
  };

  return (
    <div className="signin signin--single">
      <Card title="What's your name?" description={`Signed in as ${app.user?.email ?? ''}. Your name goes on the letters you review, comment on and approve.`}>
        <form className="stack" onSubmit={(e) => void submit(e)} noValidate>
          <TextInput label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ms. Jean Ashley Chico" required />
          {error ? (
            <Notice tone="danger" live>
              {error}
            </Notice>
          ) : null}
          <div className="row">
            <Button type="submit" variant="primary" busy={busy}>
              Continue
            </Button>
            <Button type="button" variant="link" onClick={() => void app.signOut()}>
              Sign out
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
