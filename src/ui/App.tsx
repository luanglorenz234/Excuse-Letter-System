import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SHOW_TEST_BAR } from '@/config';
import { includesUser } from '@/core/requests';
import { isHr, roleWord, type User } from '@/core/types';
import { Button, Sidebar, TitleBar, type IconName, type SidebarNavItem } from './components';
import { useApp } from './state/AppState';
import { paths } from './state/paths';
import { HomeScreen } from './screens/HomeScreen';
import { SignInScreen } from './screens/SignInScreen';
import { DashboardScreen } from './screens/DashboardScreen';
import { InternEditScreen, InternFormScreen, RequestFormScreen } from './screens/RequestFormScreen';
import { InternLetterScreen } from './screens/InternLetterScreen';
import { MyRequestsScreen } from './screens/MyRequestsScreen';
import { QueueScreen } from './screens/QueueScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { version as APP_VERSION } from '../../package.json';
import './App.css';

/** React Router v7's behaviour, adopted now, as in APG Post-It. */
export const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

/** A hash router: a desktop app has no server to answer a deep link, and `#/queue` survives a reload. */
export function App() {
  return (
    <HashRouter future={routerFuture}>
      <AppShell />
    </HashRouter>
  );
}

export function homeFor(user: User): string {
  return isHr(user) ? paths.queue : paths.dashboard;
}

interface NavDef {
  readonly key: string;
  readonly label: string;
  readonly path: string;
  readonly icon: IconName;
}

function navFor(user: User): readonly NavDef[] {
  if (isHr(user)) {
    return [
      { key: 'queue', label: 'Review queue', path: paths.queue, icon: 'inbox' },
      { key: 'calendar', label: 'Calendar', path: paths.calendar, icon: 'calendar' },
      { key: 'settings', label: 'Settings', path: paths.settings, icon: 'settings' },
    ];
  }
  return [
    { key: 'dashboard', label: 'Dashboard', path: paths.dashboard, icon: 'home' },
    { key: 'new', label: 'New request', path: paths.newRequest, icon: 'plus' },
    { key: 'requests', label: 'My requests', path: paths.myRequests, icon: 'letter' },
    { key: 'calendar', label: 'Calendar', path: paths.calendar, icon: 'calendar' },
  ];
}

function navKeyFor(pathname: string): string | null {
  const first = pathname.split('/')[1] ?? '';
  if (first === 'review') return 'queue';
  if (first === 'edit') return 'requests';
  return first || null;
}

const SIDEBAR_KEY = 'apg-excuse-letters/sidebar-collapsed';

export function AppShell() {
  const app = useApp();
  const { user, platform } = app;
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => platform.readLocal(SIDEBAR_KEY) === '1');
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!platform.hasWindowControls) return undefined;
    void platform.isMaximized().then(setMaximized);
    return platform.onMaximizedChange(setMaximized);
  }, [platform]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      platform.writeLocal(SIDEBAR_KEY, c ? '0' : '1');
      return !c;
    });
  }, [platform]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);

  const windowControls = platform.hasWindowControls
    ? {
        maximized,
        onMinimize: () => void platform.minimize(),
        onToggleMaximize: () => void platform.toggleMaximize(),
        onClose: () => void platform.close(),
      }
    : null;

  const signOut = () => {
    app.signOut();
    navigate(paths.home);
    app.notify('Signed out.');
  };

  if (!user) {
    return (
      <div className="shell shell--signed-out">
        <div className="shell__content">
          <TitleBar brandHref="#/" windowControls={windowControls} />
          {SHOW_TEST_BAR ? <TestBar /> : null}
          <main className="shell__main" id="main">
            <Routes>
              <Route path={paths.home} element={<HomeScreen />} />
              <Route path={paths.memberSignIn} element={<SignInScreen mode="member" />} />
              <Route path={paths.adminSignIn} element={<SignInScreen mode="admin" />} />
              <Route path={paths.internForm} element={<InternFormScreen />} />
              <Route path="/letter/:code" element={<InternLetterScreen />} />
              <Route path="/letter/:code/edit" element={<InternEditScreen />} />
              <Route path="*" element={<Navigate to={paths.home} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    );
  }

  const returned = Object.values(app.db.requests).filter((r) => r.uid === user.uid && r.status === 'returned').length;
  const pending = Object.values(app.db.requests).filter((r) => r.status === 'submitted').length;
  const nav: SidebarNavItem[] = navFor(user).map((n) => ({
    key: n.key,
    label: n.label,
    href: `#${n.path}`,
    icon: n.icon,
    count: n.key === 'queue' ? pending : n.key === 'requests' ? returned : undefined,
    countLabel: n.key === 'queue' ? `${pending} waiting` : n.key === 'requests' ? `${returned} returned` : undefined,
  }));

  return (
    <div className="shell">
      <Sidebar
        nav={nav}
        currentKey={navKeyFor(location.pathname)}
        user={{ name: user.name, role: user.role === 'hr' ? 'hr' : user.memberType ?? user.role }}
        onNavigate={(key) => {
          const target = nav.find((n) => n.key === key);
          if (target) navigate(target.href.slice(1));
        }}
        onSignOut={signOut}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        dragRegion={platform.hasWindowControls}
        animate
        appVersion={APP_VERSION}
      />
      <div className="shell__content">
        <TitleBar windowControls={windowControls} />
        {SHOW_TEST_BAR ? <TestBar /> : null}
        <main className="shell__main" id="main">
          <SignedInRoutes user={user} />
        </main>
      </div>
    </div>
  );
}

function SignedInRoutes({ user }: { user: User }) {
  const home = homeFor(user);
  if (isHr(user)) {
    return (
      <Routes>
        <Route path={paths.queue} element={<QueueScreen />} />
        <Route path="/review/:id" element={<ReviewScreen />} />
        <Route path={paths.calendar} element={<CalendarScreen />} />
        <Route path={paths.settings} element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path={paths.dashboard} element={<DashboardScreen />} />
      <Route path={paths.newRequest} element={<RequestFormScreen />} />
      <Route path="/edit/:id" element={<RequestFormScreen />} />
      <Route path={paths.myRequests} element={<MyRequestsScreen />} />
      <Route path={paths.calendar} element={<CalendarScreen />} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  );
}

const TEST_INTERN = '__intern';

/**
 * For local testing only (src/config.ts SHOW_TEST_BAR): be anyone in the
 * sample data in one click (or an intern, who has no account), and put the
 * sample data back.
 */
function TestBar() {
  const app = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  // Interns have no account: only the people who can sign in.
  const people = Object.values(app.db.users)
    .filter((u) => u.role !== 'intern')
    .sort((a, b) => Number(isHr(b)) - Number(isHr(a)) || a.name.localeCompare(b.name));
  const waiting = Object.values(app.db.requests).filter((r) => r.status === 'submitted').length;
  const be = (value: string) => {
    const u = app.db.users[value];
    if (u) {
      app.signInAs(u.uid);
      navigate(homeFor(u));
      return;
    }
    app.signOut();
    navigate(value === TEST_INTERN ? paths.internForm : paths.home);
  };
  const internPage = !app.user && (location.pathname === paths.internForm || location.pathname.startsWith('/letter/'));
  return (
    <div className="test-bar" role="region" aria-label="Test tools">
      <span className="test-bar__label">Test mode · data in {app.platform.storageLabel}</span>
      <label className="test-bar__pick">
        <span className="visually-hidden">Be someone else</span>
        <select value={app.user?.uid ?? (internPage ? TEST_INTERN : '')} onChange={(e) => be(e.target.value)} className="test-bar__select">
          <option value="">Signed out (home)</option>
          <option value={TEST_INTERN}>Intern · no account (intern form)</option>
          {people.map((u) => (
            <option key={u.uid} value={u.uid}>
              {u.name} · {roleWord(u.role)}
              {u.status !== 'active' ? ` (${u.status})` : ''}
              {isHr(u) && waiting ? ` · ${waiting} waiting` : ''}
              {!isHr(u) ? ` · ${Object.values(app.db.requests).filter((r) => includesUser(r, u.uid)).length} requests` : ''}
            </option>
          ))}
        </select>
      </label>
      <Button size="small" variant="ghost" onClick={() => void app.resetSampleData()}>
        Reset sample data
      </Button>
    </div>
  );
}

/** A screen's title row: the heading, a line under it, and its actions. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1 tabIndex={-1}>{title}</h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
