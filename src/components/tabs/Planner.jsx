import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import DataStore from '../../store/DataStore.js';
import { todayKey } from '../../lib/date.js';
import { useAsyncResult } from '../../hooks/useAsyncResult.js';
import DayNav from '../common/DayNav.jsx';
import TaskItem from './TaskItem.jsx';

/**
 * Planner tab (PRD §6.4). Ordered task list per selected day.
 * V2.4: tasks load via useAsyncResult against async DataStore (Supabase).
 * Round-trip confirm: bump the read-only `version` key after each write's
 * await resolves, so the UI re-renders with the authoritative state.
 */
export default function Planner({ route, setRoute, bumpStale }) {
  const dateKey = route.dateKey || todayKey();
  const [version, setVersion] = useState(0);

  const { data: dayData, loading } = useAsyncResult(
    `planner:${dateKey}:${version}`,
    () => DataStore.planner.get(dateKey),
    [dateKey, version]
  );
  const tasks = [...(dayData?.tasks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const [quickAdd, setQuickAdd] = useState('');

  const bump = () => { setVersion((v) => v + 1); bumpStale?.(); };

  const handleQuickAdd = (e) => {
    e.preventDefault();
    const title = quickAdd.trim();
    if (!title) return;
    setQuickAdd('');
    DataStore.planner.addTask(dateKey, { title, priority: 'low' })
      .then(() => bump())
      .catch((err) => console.warn('[PARTH] addTask failed:', err?.message));
  };

  const updateTask = (id, patch) => {
    DataStore.planner.updateTask(dateKey, id, patch)
      .then(() => bump())
      .catch((err) => console.warn('[PARTH] updateTask failed:', err?.message));
  };

  const deleteTask = (id) => {
    DataStore.planner.deleteTask(dateKey, id)
      .then(() => bump())
      .catch((err) => console.warn('[PARTH] deleteTask failed:', err?.message));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = tasks.findIndex((t) => t.id === active.id);
    const newIdx = tasks.findIndex((t) => t.id === over.id);
    // Optimistically reorder then send — round-trip confirm still bumps.
    const reordered = arrayMove(tasks, oldIdx, newIdx);
    DataStore.planner.reorder(dateKey, reordered.map((t) => t.id))
      .then(() => bump())
      .catch((err) => console.warn('[PARTH] reorder failed:', err?.message));
    // Local bump too so the UI reflects the drop before the round-trip.
    bump();
  };

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="planner">
      <header className="planner__head">
        <DayNav
          dateKey={dateKey}
          onChange={(k) => setRoute({ tab: 'planner', dateKey: k })}
          maxKey={null}
        />
        <div className="planner__count">
          {tasks.length ? `${doneCount} of ${tasks.length} done` : ''}
        </div>
      </header>

      <form className="planner__quickadd" onSubmit={handleQuickAdd}>
        <input
          className="planner__quickadd-input"
          type="text"
          value={quickAdd}
          placeholder="Add a task — press Enter"
          onChange={(e) => setQuickAdd(e.target.value)}
        />
      </form>

      {loading && tasks.length === 0 ? (
        <div className="planner__empty" aria-live="polite">Loading…</div>
      ) : tasks.length === 0 ? (
        <div className="planner__empty">
          No tasks yet. Add one above.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="planner__list">
              {tasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onChange={(patch) => updateTask(t.id, patch)}
                  onDelete={() => deleteTask(t.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
