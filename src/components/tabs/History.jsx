import { useMemo } from 'react';
import { clampMonth, todayKey } from '../../lib/date.js';
import MonthGrid from './MonthGrid.jsx';
import DayDetail from './DayDetail.jsx';

/**
 * History tab (PRD §6.6).
 * Two views: month calendar or day detail (driven by route.arg).
 *
 * route.arg shape:
 *   { type: 'month', year, monthIdx }  -> show calendar
 *   { type: 'day', key }                -> show day detail for that date
 */
export default function History({ route, setRoute, bumpStale }) {
  const arg = route.arg;

  const monthState = useMemo(() => {
    if (arg && arg.type === 'month') {
      return clampMonth(arg.year, arg.monthIdx);
    }
    // When in day detail view we don't show the calendar, but still keep a
    // sane default for whenever the user navigates back.
    const d = new Date();
    return { year: d.getFullYear(), monthIdx: d.getMonth() };
  }, [arg]);

  if (arg && arg.type === 'day') {
    return (
      <DayDetail
        dateKey={arg.key}
        onBack={() => {
          // Return to month containing this day.
          const [y, m] = arg.key.split('-').map(Number);
          setRoute({ tab: 'history', arg: { type: 'month', year: y, monthIdx: m - 1 } });
        }}
        onEditIn={(tabId, dateKey) => setRoute({ tab: tabId, dateKey: dateKey ?? todayKey() })}
      />
    );
  }

  return (
    <div className="history">
      <MonthGrid
        year={monthState.year}
        monthIdx={monthState.monthIdx}
        onPrev={() => setRoute({ tab: 'history', arg: { type: 'month', ...clampMonth(monthState.year, monthState.monthIdx - 1) } })}
        onNext={() => setRoute({ tab: 'history', arg: { type: 'month', ...clampMonth(monthState.year, monthState.monthIdx + 1) } })}
        onSelect={(dateKey) => {
          const [y, m] = dateKey.split('-').map(Number);
          setRoute({ tab: 'history', dateKey, arg: { type: 'day', key: dateKey } });
          // Note: routing for the day's "month" is implicit via the key.
          void y; void m;
        }}
      />
    </div>
  );
}
