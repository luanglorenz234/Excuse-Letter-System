import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CODE_LENGTH, findByAccessCode, normalizeAccessCode } from '@/core/requests';
import { Button, Card, Notice, TextInput } from '../components';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';

/** Signed out: interns file or check a letter without an account; employees and HR sign in. */
export function HomeScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [notFound, setNotFound] = useState(false);

  const open = (e: FormEvent) => {
    e.preventDefault();
    const found = findByAccessCode(app.db, code);
    setNotFound(!found);
    if (found?.accessCode) navigate(paths.internLetter(found.accessCode));
  };

  return (
    <div className="welcome">
      <div className="stack stack--tight">
        <p className="muted">Alpha Premier Group</p>
        <h1 className="welcome__title" tabIndex={-1}>
          Leave of absence request
        </h1>
        <p className="muted">Choose how you want to continue.</p>
      </div>
      <div className="welcome__options">
        <Card className="welcome__option" title="Interns">
          <p className="muted">No account needed. Fill out the form with your name and department, sign it, and send it to HR.</p>
          <div>
            <Button variant="primary" onClick={() => navigate(paths.internForm)}>
              Intern absence form
            </Button>
          </div>
          <form className="stack stack--tight welcome__code" onSubmit={open} noValidate>
            <TextInput
              label="Already sent one? Enter your letter code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setNotFound(false);
              }}
              placeholder="e.g. K7Q-4MZ"
              autoComplete="off"
              spellCheck={false}
              hint="See HR's comments, revise a returned letter, or check its status."
            />
            {notFound ? (
              <Notice tone="warn" live>
                {normalizeAccessCode(code).length === CODE_LENGTH ? 'No letter has that code. Check it and try again, or ask HR.' : `A letter code has ${CODE_LENGTH} letters and numbers.`}
              </Notice>
            ) : null}
            <div>
              <Button type="submit" variant="ghost">
                Check my letter
              </Button>
            </div>
          </form>
        </Card>
        <div className="stack">
          <Card className="welcome__option" title="Employees">
            <p className="muted">Sign in or register to file your absence letter. Your letter is noted by the CEO, HR and Marketing.</p>
            <div>
              <Button variant="ghost" onClick={() => navigate(paths.memberSignIn)}>
                Employee sign-in
              </Button>
            </div>
          </Card>
          <Card className="welcome__option" title="HR">
            <p className="muted">Review, comment on, approve, return or decline submitted letters.</p>
            <div>
              <Button variant="ghost" onClick={() => navigate(paths.adminSignIn)}>
                Login as admin
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
