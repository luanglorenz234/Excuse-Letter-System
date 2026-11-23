import { useId, type MouseEvent } from 'react';
import { initials, roleWord } from '@/core/types';
import { Icon, type IconName } from './Icon';
import { Badge } from './Pill';
import './TitleBar.css';
import './Sidebar.css';

export interface SidebarNavItem {
  readonly key: string;
  readonly label: string;
  readonly href: string;
  readonly icon: IconName;
  /** Open items, shown as a count. Zero or absent shows nothing. */
  readonly count?: number | undefined;
  /** What the count means, for screen readers: "2 waiting". */
  readonly countLabel?: string | undefined;
}

export interface SidebarUser {
  readonly name: string;
  readonly role: string;
}

export interface SidebarProps {
  readonly nav: readonly SidebarNavItem[];
  readonly currentKey?: string | null | undefined;
  readonly user: SidebarUser;
  readonly onNavigate?: ((key: string) => void) | undefined;
  readonly onSignOut?: (() => void) | undefined;
  readonly collapsed?: boolean | undefined;
  readonly onToggleCollapsed?: (() => void) | undefined;
  readonly brandHref?: string | undefined;
  readonly navLabel?: string | undefined;
  readonly dragRegion?: boolean | undefined;
  readonly animate?: boolean | undefined;
  readonly appVersion?: string | undefined;
  readonly onCheckUpdates?: (() => void) | undefined;
  readonly checkingUpdates?: boolean | undefined;
  readonly onWhatsNew?: (() => void) | undefined;
}

const isModifiedClick = (e: MouseEvent) => e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;

/**
 * Top Executive Navigation Bar: replaces the left sidebar with a horizontal
 * Black & Gold header bar matching alphapremiergroup.com, giving the main
 * workspace full window width.
 */
export function Sidebar({
  nav,
  currentKey,
  user,
  onNavigate,
  onSignOut,
  brandHref = '#/',
  navLabel = 'Main',
  dragRegion = false,
  appVersion,
}: SidebarProps) {
  const id = useId();
  const drag = dragRegion ? { 'data-tauri-drag-region': true } : {};

  return (
    <header id={`${id}-sidebar`} className="sidebar" aria-label="Workspace navigation">
      <div className="sidebar__brand-row" {...drag}>
        <a className="sidebar__brand brand-word" href={brandHref} aria-label="APG Excuse Letters">
          <span className="sidebar__monogram" aria-hidden="true">
            A
          </span>
          <span className="sidebar__brand-text">
            <span className="brand-word__company">ALPHA PREMIER</span>
            <span className="brand-word__product">Excuse Letters</span>
          </span>
        </a>
        {appVersion ? <span className="sidebar__version tabular">v{appVersion}</span> : null}
      </div>

      <nav className="sidebar__nav" aria-label={navLabel}>
        <ul className="sidebar__list">
          {nav.map((item) => (
            <li key={item.key}>
              <a
                className="sidebar__item"
                href={item.href}
                aria-current={item.key === currentKey ? 'page' : undefined}
                onClick={(event) => {
                  if (!onNavigate || isModifiedClick(event)) return;
                  event.preventDefault();
                  onNavigate(item.key);
                }}
              >
                <Icon name={item.icon} className="sidebar__icon" />
                <span className="sidebar__label">{item.label}</span>
                {item.count ? <Badge className="sidebar__count" count={item.count} label={item.countLabel} /> : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user">
          <span className="sidebar__avatar sidebar__avatar--me" aria-hidden="true">
            {initials(user.name)}
          </span>
          <span className="sidebar__who">
            <span className="sidebar__user-name">{user.name}</span>
            <span className="sidebar__user-role">{roleWord(user.role)}</span>
          </span>
        </div>
        {onSignOut ? (
          <button type="button" className="sidebar__signout" onClick={onSignOut}>
            <Icon name="signOut" className="sidebar__icon" />
            <span>Sign out</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
