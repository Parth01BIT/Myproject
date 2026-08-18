import { useEffect, useRef } from 'react';
import { TABS } from '../../hooks/useRoute.js';

/**
 * Color-coded dot per tab, used both in stale treatment and in the History
 * calendar (PRD HI-004). Journal=blue, Planner=amber, Tracker=green.
 */
const TAB_DOT = {
  journal: 'var(--dot-journal)',
  planner: 'var(--dot-planner)',
  tracker: 'var(--dot-tracker)',
};

/**
 * Keyboard navigation (PRD NF-012): arrow keys move between tabs.
 *
 * `playingTabId` (V2.3): when set, applies a `.tab--playing` class for the
 * pulsing "tab playing audio" treatment — which tab id is actively running
 * a focus session (currently only 'planner' is ever playing).
 */
export default function TabBar({ activeTab, stale, playingTabId, onSelect }) {
  const refs = useRef({});

  useEffect(() => {
    const onKey = (e) => {
      if (!['ArrowLeft','ArrowRight'].includes(e.key)) return;
      // Avoid hijack when typing in inputs / contentEditable.
      const tag = (e.target?.tagName || '').toLowerCase();
      if (['input','textarea','select'].includes(tag)) return;
      if (e.target?.isContentEditable) return;

      const idx = TABS.findIndex((t) => t.id === activeTab);
      if (idx < 0) return;
      const next = e.key === 'ArrowRight' ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
      e.preventDefault();
      onSelect(TABS[next].id);
      requestAnimationFrame(() => refs.current[TABS[next].id]?.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab, onSelect]);

  return (
    <nav className="tabbar" role="tablist" aria-label="PARTH tabs">
      {TABS.map((t) => {
        const isActive = t.id === activeTab;
        const isStale = stale?.[t.id];
        const isPlaying = playingTabId === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => (refs.current[t.id] = el)}
            role="tab"
            aria-selected={isActive}
            className={[
              'tab',
              isActive ? 'tab--active' : '',
              isStale ? 'tab--stale' : '',
              isPlaying ? 'tab--playing' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => onSelect(t.id)}
            title={`${t.label}${isStale ? ' (empty for today)' : ''}${isPlaying ? ' (focus session running)' : ''}`}
          >
            <span className="tab__icon" aria-hidden="true">{t.icon}</span>
            <span className="tab__label">{t.label}</span>
            {TAB_DOT[t.id] && (
              <span
                className="tab__dot"
                style={{ background: TAB_DOT[t.id], opacity: isStale ? 0.35 : 0.8 }}
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
