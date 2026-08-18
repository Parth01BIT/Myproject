import WindowControls from './WindowControls.jsx';
import TabBar from './TabBar.jsx';
import AddressBar from './AddressBar.jsx';
import { buildAddress } from '../../hooks/useRoute.js';

/**
 * The browser-chrome frame. Composes:
 *   - Title bar (window controls + brand + ThemeToggle V2.1)
 *   - Tab bar (primary navigation, PRD §6.1.2)
 *   - Address bar (parth:// route, read-only, PRD §6.1.3)
 *
 * Sticky layout so chrome never scrolls away (NF-010).
 */
export default function BrowserShell({
  route,
  stale,
  onSelectTab,
  theme,
  onToggleTheme,
  playingTabId,
  children,
}) {
  const address = buildAddress(route.tab, route.dateKey, route.arg);

  return (
    <div className="shell">
      <div className="shell__titlebar">
        <WindowControls />
        <span className="shell__brand" aria-hidden="true">PARTH</span>
        <span className="shell__spacer" />
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          {theme === 'dark' ? '◐' : '◑'}
        </button>
      </div>

      <TabBar
        activeTab={route.tab}
        stale={stale}
        playingTabId={playingTabId}
        onSelect={onSelectTab}
      />

      <AddressBar address={address} />

      <main className="shell__content">
        {children}
      </main>
    </div>
  );
}
