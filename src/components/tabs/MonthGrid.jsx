import { useState, useEffect, useMemo } from 'react';
import DataStore from '../../store/DataStore.js';
import { monthGrid, todayKey } from '../../lib/date.js';

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/**
 * Calendar month grid (PRD HI-001..HI-005, HI-010, HI-011).
 * V2.4: replaces N-per-cell sequential localStorage reads with 3 N+1-range
 * queries covering the 42-day grid span:
 *   1. journal.getForRange(start, end)
 *   2. planner.getForRange(start, end)
 *   3. For every tracker: getLogsForRange(tracker.id, start, end)
 * Reduction from ~30 cells × 3 reads = 90 calls to ~3-7 calls.
 */
export default function MonthGrid({ year, monthIdx, onPrev, onNext, onSelect }) {
  const cells = useMemo(
    () => monthGrid(year, monthIdx, todayKey()),
    [year, monthIdx]
  );
  const minKey = cells[0].key;
  const maxKey = cells[cells.length - 1].key;

  const [cellMeta, setCellMeta] = useState(cells);

  useEffect(() => {
    let active = true;
    (async () => {
      const [jMap, pMap, trackers] = await Promise.all([
        DataStore.journal.getForRange(minKey, maxKey),
        DataStore.planner.getForRange(minKey, maxKey),
        DataStore.tracker.list(),
      ]);
      let trackerLogSets = [];
      if (trackers.length) {
        trackerLogSets = await Promise.all(
          trackers.map((t) => DataStore.tracker.getLogsForRange(t.id, minKey, maxKey))
        );
      }
      if (!active) return;
      const meta = cells.map((cell) => {
        let hasJ = false, hasP = false, hasT = false;
        if (cell.inMonth) {
          const j = jMap.get(cell.key);
          if (j && (j.content || j.mood || (j.tags && j.tags.length))) hasJ = true;
          const p = pMap.get(cell.key);
          if (p && p.tasks && p.tasks.length) hasP = true;
          if (trackers.length) hasT = trackerLogSets.some((set) => set.has(cell.key));
        }
        return { ...cell, hasJ, hasP, hasT };
      });
      if (active) setCellMeta(meta);
    })().catch((e) => {
      console.warn('[PARTH] MonthGrid load failed:', e?.message);
      if (active) setCellMeta(cells.map((cell) => ({ ...cell, hasJ: false, hasP: false, hasT: false })));
    });
    return () => { active = false; };
  }, [minKey, maxKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="cal">
      <header className="cal__head">
        <button className="cal__nav" onClick={onPrev} aria-label="Previous month">‹</button>
        <h3 className="cal__monthlabel">{MONTHS[monthIdx]} {year}</h3>
        <button className="cal__nav" onClick={onNext} aria-label="Next month">›</button>
      </header>
      <div className="cal__weekdays">
        {WEEKDAYS.map((d) => <span key={d} className="cal__weekday">{d}</span>)}
      </div>
      <div className="cal__grid">
        {cellMeta.map((cell, i) => (
          <button
            key={i}
            className={`cal__day${!cell.inMonth ? ' cal__day--out' : ''}${cell.isToday ? ' cal__day--today' : ''}`}
            onClick={() => cell.inMonth && onSelect(cell.key)}
            disabled={!cell.inMonth}
            tabIndex={cell.inMonth ? 0 : -1}
          >
            <span className="cal__daynum">{cell.dayOfMonth}</span>
            {(cell.hasJ || cell.hasP || cell.hasT) && (
              <span className="cal__dots">
                {cell.hasJ && <span className="dot dot--journal" />}
                {cell.hasP && <span className="dot dot--planner" />}
                {cell.hasT && <span className="dot dot--tracker" />}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="cal__legend">
        <span><span className="dot dot--journal" /> Journal</span>
        <span><span className="dot dot--planner" /> Planner</span>
        <span><span className="dot dot--tracker" /> Tracker</span>
      </div>
    </div>
  );
}
