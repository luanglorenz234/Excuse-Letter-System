import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CODE_LENGTH, formatAccessCode, normalizeAccessCode } from '@/core/requests';
import type { LetterReply } from '@/server/handlers';
import { Button, Card, Notice, TextInput } from '../components';
import { useApp } from '../state/AppState';
import { paths } from '../state/paths';
import { forgetRecentLetter, readRecentLetters, rememberRecentLetter, type RecentLetter } from '../state/recentLetters';

/** Signed out: interns and employees file or check a letter without an account; HR signs in. */
export function HomeScreen() {
  const app = useApp();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<RecentLetter[]>(() => readRecentLetters(app.platform));

  const openCode = async (raw: string, fromRecent = false) => {
    const typed = normalizeAccessCode(raw);
    if (typed.length !== CODE_LENGTH) {
      setProblem(`A letter code has ${CODE_LENGTH} letters and numbers.`);
      return;
    }
    setProblem(null);
    setBusy(true);
    const reply = await app.call<LetterReply>({ action: 'open', code: typed });
    setBusy(false);
    if (!reply.ok) {
      if (reply.notFound && fromRecent) {
        setRecent(forgetRecentLetter(app.platform, typed));
      }
      setProblem(reply.notFound ? 'No letter has that code. Check it and try again, or ask HR.' : reply.error);
      return;
    }
    setRecent(rememberRecentLetter(app.platform, reply.value.letter));
    navigate(paths.letter(reply.value.code), { state: { letter: reply.value.letter } });
  };

  const open = (e: FormEvent) => {
    e.preventDefault();
    void openCode(code);
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
        <Card className="welcome__option" title="Interns and employees">
          <p className="muted">No account needed. Fill out the form with your name and department, sign it, and send it to HR.</p>
          <div>
            <Button variant="primary" onClick={() => navigate(paths.form)}>
              Absence form
            </Button>
          </div>
          <form className="stack stack--tight welcome__code" onSubmit={(e) => void open(e)} noValidate>
            <TextInput
              label="Already sent one? Enter your letter code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setProblem(null);
              }}
              placeholder="e.g. K7Q-4MZ"
              autoComplete="off"
              spellCheck={false}
              hint="See HR's comments, revise a returned letter, or check its status."
            />
            {problem ? (
              <Notice tone="warn" live>
                {problem}
              </Notice>
            ) : null}
            <div>
              <Button type="submit" variant="ghost" busy={busy}>
                Check my letter
              </Button>
            </div>
            {recent.length > 0 ? (
              <div className="recent-letters" aria-label="Recent letters on this PC">
                <span className="field__hint">Recent on this PC</span>
                <div className="recent-letters__list">
                  {recent.map((item) => {
                    const formatted = formatAccessCode(item.code);
                    return (
                      <div key={item.code} className="recent-chip">
                        <button
                          type="button"
                          className="recent-chip__open"
                          disabled={busy}
                          onClick={() => void openCode(item.code, true)}
                        >
                          <code>{formatted}</code>
                          {item.name ? <span>{item.name}</span> : null}
                          {item.dates ? <span className="muted">{item.dates}</span> : null}
                        </button>
                        <button
                          type="button"
                          className="recent-chip__remove"
                          aria-label={`Remove ${formatted} from recent`}
                          onClick={() => setRecent(forgetRecentLetter(app.platform, item.code))}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </form>
        </Card>
        <Card className="welcome__option" title="HR">
          <p className="muted">Review, comment on, approve, return or decline submitted letters.</p>
          <div>
            <Button variant="ghost" onClick={() => navigate(paths.signIn)}>
              HR sign-in
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
