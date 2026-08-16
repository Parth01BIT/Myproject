import { useState, useEffect } from 'react';
import DataStore from '../../store/DataStore.js';
import { todayKey } from '../../lib/date.js';
import RichEditor from '../common/RichEditor.jsx';
import DayNav from '../common/DayNav.jsx';
import { useDebounced } from '../../hooks/useDebounced.js';

const MOODS = [
  { id: 'happy',     emoji: '😊', label: 'happy' },
  { id: 'neutral',   emoji: '😐', label: 'neutral' },
  { id: 'sad',       emoji: '😔', label: 'sad' },
  { id: 'energized',emoji: '🔥', label: 'energized' },
  { id: 'tired',     emoji: '😴', label: 'tired' },
];

const MOOD_BY_ID = Object.fromEntries(MOODS.map((m) => [m.id, m]));
void MOOD_BY_ID;

/**
 * Journal tab — single entry per day (PRD §6.3).
 * One editor per active day; switching date loads that day's entry.
 *
 * V2.4: reads/writes are now async against Supabase. The entry loads on
 * dateKey change; debounced save fires 500ms after the last edit; save-state
 * indicator reflects the in-flight promise.
 */
export default function Journal({ route, setRoute, bumpStale }) {
  const dateKey = route.dateKey || todayKey();

  const [entry, setEntry] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [tagsInput, setTagsInput] = useState('');

  // Load the stored entry for this day (async).
  useEffect(() => {
    let active = true;
    setEntry(null);
    setSaveState('idle');
    DataStore.journal.get(dateKey)
      .then((e) => {
        if (!active) return;
        const loaded = e || { content: '', mood: null, tags: [] };
        setEntry(loaded);
        setTagsInput((loaded.tags || []).join(', '));
      })
      .catch((err) => {
        if (!active) return;
        console.warn('[PARTH] journal load failed:', err?.message);
        setEntry({ content: '', mood: null, tags: [] });
      });
    return () => { active = false; };
  }, [dateKey]);

  // Debounced save 500ms after last change (JN-006). Async; save-state shows
  // 'saving' until the promise resolves, then 'saved' for 1.5s.
  const scheduleSave = useDebounced((patch) => {
    setSaveState('saving');
    DataStore.journal.save(dateKey, patch)
      .then(() => {
        setSaveState('saved');
        bumpStale?.();
        setTimeout(() => setSaveState('idle'), 1500);
      })
      .catch((err) => {
        console.warn('[PARTH] journal save failed:', err?.message);
        setSaveState('idle');
      });
  }, 500);

  function update(partial) {
    setEntry((prev) => {
      const draft = prev || { content: '', mood: null, tags: [] };
      const merged = { ...draft, ...partial };
      scheduleSave(partial);
      return merged;
    });
  }

  const handleHtml = (html) => update({ content: html });
  const handleMood = (moodId) => update({ mood: (entry?.mood === moodId ? null : moodId) });
  const handleTags = (rawStr) => {
    setTagsInput(rawStr);
    const tags = rawStr.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    update({ tags });
  };

  // While the entry is loading on first render, show a brief placeholder so
  // the RichEditor doesn't flicker with stale content from another day.
  if (entry === null) {
    return (
      <div className="journal">
        <header className="journal__head">
          <DayNav
            dateKey={dateKey}
            onChange={(k) => setRoute({ tab: 'journal', dateKey: k })}
            maxKey={todayKey()}
          />
          <div className="journal__save-indicator" data-state="loading" aria-live="polite">
            Loading…
          </div>
        </header>
        <div className="journal__skeleton" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="journal">
      <header className="journal__head">
        <DayNav
          dateKey={dateKey}
          onChange={(k) => setRoute({ tab: 'journal', dateKey: k })}
          maxKey={todayKey()}
        />
        <div className="journal__save-indicator" data-state={saveState}>
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved'  && '✓ Saved'}
        </div>
      </header>

      <div className="journal__moodrow">
        <span className="journal__mood-label">Mood</span>
        <div className="journal__moods">
          {MOODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mood ${entry.mood === m.id ? 'mood--active' : ''}`}
              onClick={() => handleMood(m.id)}
              title={m.label}
              aria-pressed={entry.mood === m.id}
            >
              {m.emoji}
            </button>
          ))}
        </div>
      </div>

      <RichEditor
        dateKey={dateKey}
        initialHtml={entry.content || ''}
        onChange={handleHtml}
      />

      <footer className="journal__footer">
        <label className="journal__tags-label">Tags</label>
        <input
          type="text"
          className="journal__tags-input"
          value={tagsInput}
          placeholder="comma, separated, tags"
          onChange={(e) => handleTags(e.target.value)}
        />
      </footer>
    </div>
  );
}
