import { useState, useEffect } from 'react';
import './styles/shell.css';
import './styles/journal.css';
import './styles/planner.css';
import './styles/tracker.css';
import './styles/history.css';
import './styles/today.css';
import './styles/clock.css';
import './styles/focus.css';
import './styles/login.css';
import './styles/polish.css';
import './styles/cat.css';
import BrowserShell from './components/shell/BrowserShell.jsx';
import BootSequence from './components/shell/BootSequence.jsx';
import RestoreSession from './components/shell/RestoreSession.jsx';
import FocusWidget from './components/shell/FocusWidget.jsx';
import Login from './components/shell/Login.jsx';
import { AuthProvider, useAuth } from './contexts/Auth.jsx';
import { FocusTimerProvider } from './contexts/FocusTimer.jsx';
import { useFocusStatus } from './hooks/useFocusTimer.js';
import { useRoute } from './hooks/useRoute.js';
import { useStaleTabs, useStaleVersion } from './hooks/useStaleTabs.js';
import { useBootGate } from './hooks/useBootGate.js';
import { useTheme } from './hooks/useTheme.js';
import { useDebounced } from './hooks/useDebounced.js';
import ErrorBoundary from './components/shell/ErrorBoundary.jsx';
import { todayKey, dayDiff } from './lib/date.js';
import DataStore from './store/DataStore.js';
import Journal from './components/tabs/Journal.jsx';
import Planner from './components/tabs/Planner.jsx';
import Tracker from './components/tabs/Tracker.jsx';
import History from './components/tabs/History.jsx';
import Today from './components/tabs/Today.jsx';
import Clock from './components/tabs/Clock.jsx';
import Cat from './components/tabs/Cat.jsx';

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

/** Gate: render Login / splash / live tree based on auth state. */
function AuthGate() {
  const { user, loading } = useAuth();
  if (loading && !user) return <div className="app-splash" aria-busy="true" />;
  if (!user) return <Login />;
  return (
    <FocusTimerProvider>
      <AppInner />
    </FocusTimerProvider>
  );
}

function AppInner() {
  const [route, setRoute] = useRoute();
  const [staleVersion, bumpStale] = useStaleVersion();
  // Debounce stale re-computation so rapid writes (journal typing) don't fire
  // 3+N Supabase queries on every keystroke. 2 s of inactivity is enough.
  const debouncedBumpStale = useDebounced(bumpStale, 2000);
  const { stale } = useStaleTabs(todayKey(), staleVersion);
  const { theme, toggle: toggleTheme } = useTheme();
  const focusStatus = useFocusStatus();

  // Capture lastVisit BEFORE we touch it (so restore-gap calc is correct).
  // V2.4: DataStore.meta.get() is now async. We hydrate lastVisit in an
  // effect, and the restore prompt only renders once both values are known.
  const [restoredLastVisit, setRestoredLastVisit] = useState(null);
  useEffect(() => {
    let active = true;
    DataStore.meta.get()
      .then((m) => { if (active) setRestoredLastVisit(m.lastVisit || null); })
      .catch((e) => console.warn('[PARTH] meta.get failed:', e?.message));
    return () => { active = false; };
  }, []);

  // Boot gate returns: null=pending | true=run boot | false=skip (already booted).
  const [shouldBoot, onBootDone] = useBootGate({ bootDurationMs: 2000 });

  // Flag whether the boot/restore-initialization phase has fully finished.
  const [bootingDone, setBootingDone] = useState(false);
  const [restoreDismissed, setRestoreDismissed] = useState(false);

  // After we have the last-visit snapshot, touch the visit timestamp now.
  // V2.4: fire-and-forget async post; the next load will see the new value.
  useEffect(() => {
    DataStore.meta.touchVisit().catch((e) => console.warn('[PARTH] meta.touchVisit failed:', e?.message));
  }, []);

  // If boot skipped (shouldBoot===false), flip bootingDone right away.
  useEffect(() => {
    if (shouldBoot === false) setBootingDone(true);
  }, [shouldBoot]);

  const restoreGap = restoredLastVisit
    ? Math.max(0, dayDiff(restoredLastVisit, todayKey()))
    : 0;
  const showRestore = bootingDone && !restoreDismissed && restoreGap > 2;

  function handleBootComplete() {
    onBootDone();
    setBootingDone(true);
  }

  function handleRestore(oldKey) {
    setRestoreDismissed(true);
    setRoute({ tab: 'history', dateKey: oldKey, arg: { type: 'day', key: oldKey } });
  }

  function handleStartFresh() {
    setRestoreDismissed(true);
    setRoute({ tab: 'today', dateKey: todayKey() });
  }

  let pane;
  if (route.tab === 'today') {
    pane = <Today route={route} setRoute={setRoute} bumpStale={debouncedBumpStale} />;
  } else if (route.tab === 'journal') {
    pane = <Journal route={route} setRoute={setRoute} bumpStale={debouncedBumpStale} />;
  } else if (route.tab === 'planner') {
    pane = <Planner route={route} setRoute={setRoute} bumpStale={debouncedBumpStale} />;
  } else if (route.tab === 'tracker') {
    pane = <Tracker bumpStale={debouncedBumpStale} />;
  } else if (route.tab === 'cat') {
    pane = <Cat />;
  } else if (route.tab === 'clock') {
    pane = <Clock />;
  } else if (route.tab === 'history') {
    pane = <History route={route} setRoute={setRoute} />;
  } else {
    pane = null;
  }
  // Wrap in ErrorBoundary keyed by tab so switching tabs auto-resets any error.
  const safePane = pane
    ? <ErrorBoundary key={route.tab}>{pane}</ErrorBoundary>
    : null;

  return (
    <>
      {shouldBoot === true && <BootSequence onComplete={handleBootComplete} />}
      {showRestore && (
        <RestoreSession
          lastVisit={restoredLastVisit}
          onRestore={handleRestore}
          onStartFresh={handleStartFresh}
        />
      )}
      <BrowserShell
        route={route}
        setRoute={setRoute}
        stale={stale}
        onSelectTab={(tabId) => setRoute({ tab: tabId })}
        theme={theme}
        onToggleTheme={toggleTheme}
        playingTabId={focusStatus.playingTabId}
      >
        {safePane}
      </BrowserShell>
      <FocusWidget />
    </>
  );
}

export default App;
