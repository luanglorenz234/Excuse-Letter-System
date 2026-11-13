import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Button, Sidebar, TitleBar, type IconName, type SidebarNavItem } from './components';
import { useApp } from './state/AppState';
import { paths } from './state/paths';
import { HomeScreen } from './screens/HomeScreen';
import { NameScreen, SignInScreen } from './screens/SignInScreen';
import { EditLetterScreen, FormScreen } from './screens/RequestFormScreen';
import { LetterScreen } from './screens/LetterScreen';
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

interface NavDef {
  readonly key: string;
  readonly label: string;
  readonly path: string;
  readonly icon: IconName;
}

/** Only HR signs in. */
const HR_NAV: readonly NavDef[] = [
  { key: 'queue', label: 'Review queue', path: paths.queue, icon: 'inbox' },
  { key: 'calendar', label: 'Calendar', path: paths.calendar, icon: 'calendar' },
  { key: 'settings', label: 'Settings', path: paths.settings, icon: 'settings' },
];

function navKeyFor(pathname: string): string | null {
  const first = pathname.split('/')[1] ?? '';
  if (first === 'review') return 'queue';
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
    navigate(paths.home);
    void app.signOut();
  };

  const testBar = app.backend.sample ? <TestBar /> : null;

  if (!user) {
    return (
      <div className="shell shell--signed-out">
        <div className="shell__content">
          <TitleBar brandHref="#/" windowControls={windowControls} />
          {testBar}
          <main className="shell__main" id="main">
            <Routes>
              <Route path={paths.home} element={<HomeScreen />} />
              <Route path={paths.signIn} element={<SignInScreen />} />
              <Route path={paths.form} element={<FormScreen />} />
              <Route path="/letter/:code" element={<LetterScreen />} />
              <Route path="/letter/:code/edit" element={<EditLetterScreen />} />
              <Route path="*" element={<Navigate to={paths.home} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    );
  }

  if (app.needsName) {
    return (
      <div className="shell shell--signed-out">
        <div className="shell__content">
          <TitleBar brandHref="#/" windowControls={windowControls} />
          {testBar}
          <main className="shell__main" id="main">
            <NameScreen />
          </main>
        </div>
      </div>
    );
  }

  const pending = Object.values(app.db.requests).filter((r) => r.status === 'submitted').length;
  const nav: SidebarNavItem[] = HR_NAV.map((n) => ({
    key: n.key,
    label: n.label,
    href: `#${n.path}`,
    icon: n.icon,
    count: n.key === 'queue' ? pending : undefined,
    countLabel: n.key === 'queue' ? `${pending} waiting` : undefined,
  }));

  return (
    <div className="shell">
      <Sidebar
        nav={nav}
        currentKey={navKeyFor(location.pathname)}
        user={{ name: user.name, role: app.isOfficer ? 'HR officer' : 'hr' }}
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
        {testBar}
        <main className="shell__main" id="main">
          <Routes>
            <Route path={paths.queue} element={<QueueScreen />} />
            <Route path="/review/:id" element={<ReviewScreen />} />
            <Route path={paths.calendar} element={<CalendarScreen />} />
            <Route path={paths.settings} element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to={paths.queue} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

const SIGNED_OUT = '';
const FORM = '__form';

/**
 * The local stand-in only (`npm run dev`, no Firebase): be any sample HR
 * account in one click, or nobody (the form), and put the sample data back.
 */
function TestBar() {
  const app = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const sample = app.backend.sample;
  if (!sample) return null;
  const be = async (value: string) => {
    const account = sample.accounts.find((a) => a.email === value);
    if (account) {
      const error = await app.signIn(account.email, account.password);
      if (error) app.notify(error, 'warn');
      navigate(paths.queue);
      return;
    }
    if (app.user) await app.signOut();
    navigate(value === FORM ? paths.form : paths.home);
  };
  const formPage = !app.user && (location.pathname === paths.form || location.pathname.startsWith('/letter/'));
  const waiting = Object.values(app.db.requests).filter((r) => r.status === 'submitted').length;
  return (
    <div className="test-bar" role="region" aria-label="Test tools">
      <span className="test-bar__label">Test mode · letters in {app.backend.label}</span>
      <label className="test-bar__pick">
        <span className="visually-hidden">Be someone else</span>
        <select value={app.user?.email ?? (formPage ? FORM : SIGNED_OUT)} onChange={(e) => void be(e.target.value)} className="test-bar__select">
          <option value={SIGNED_OUT}>Signed out (home)</option>
          <option value={FORM}>Intern or employee · no account (the form)</option>
          {sample.accounts.map((a) => (
            <option key={a.email} value={a.email}>
              {a.email} · {a.label}
              {app.user?.email === a.email && waiting ? ` · ${waiting} waiting` : ''}
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
