import { Card, Notice } from '../components';
import { useUser } from '../state/AppState';

/** A registered person HR hasn't activated yet: they can't file letters until then. */
export function PendingScreen() {
  const user = useUser();
  return (
    <div className="page">
      <Card title="Waiting for HR to activate your account">
        <div className="stack">
          <p>
            Welcome, <strong>{user.name}</strong> ({user.email}).
          </p>
          <p className="muted">
            So every official letter carries the right ID number, position and department, HR activates each account and assigns those
            before you can file a letter. Sign in again once HR tells you it is done.
          </p>
          <Notice tone="info">Status: pending HR activation.</Notice>
        </div>
      </Card>
    </div>
  );
}
