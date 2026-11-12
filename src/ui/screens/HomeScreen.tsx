import { useNavigate } from 'react-router-dom';
import { Button, Card } from '../components';
import { paths } from '../state/paths';

/** Signed out: pick the way in. */
export function HomeScreen() {
  const navigate = useNavigate();
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
        <Card className="welcome__option" title="Answer absence form">
          <p className="muted">For interns and employees. Sign in or register, then fill out and submit your absence letter to HR.</p>
          <div>
            <Button variant="primary" onClick={() => navigate(paths.memberSignIn)}>
              Answer absence form
            </Button>
          </div>
        </Card>
        <Card className="welcome__option" title="Login as admin">
          <p className="muted">For HR and owners. Review, approve, return or decline submitted letters.</p>
          <div>
            <Button variant="ghost" onClick={() => navigate(paths.adminSignIn)}>
              Login as admin
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
