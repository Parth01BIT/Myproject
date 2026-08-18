import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFocusTimer } from '../../hooks/useFocusTimer.js';

const PRIORITY_META = {
  low:    { label: '',     color: 'transparent', chip: null },
  medium: { label: 'med',  color: 'var(--dot-planner)' },
  high:   { label: 'high', color: 'var(--danger)' },
};

/**
 * Single planner task row. Drag handle uses the drag handle (left edge),
 * the checkbox toggles completion, title is inline-editable on click.
 *
 * PRD: PL-004 (inline edit), PL-005 (toggle), PL-006 (priority), PL-008 (delete),
 * PL-012 (free-text time label). Drag reorder PL-007.
 *
 * V2.3: ▶ launch button starts a Focus Timer session bound to this task.
 * Pulsing accent ring on the row when this task is currently being focused.
 */
export default function TaskItem({ task, onChange, onDelete }) {
  const { id, title, time, priority, done } = task;
  const meta = PRIORITY_META[priority] || PRIORITY_META.low;

  const focus = useFocusTimer();
  const focusing = focus.isFocusingTask(id);

  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Inline editing state
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [editingTime, setEditingTime] = useState(false);
  const [draftTime, setDraftTime] = useState(time || '');
  const inputRef = useRef(null);
  const timeRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);
  useEffect(() => {
    if (editingTime && timeRef.current) timeRef.current.focus();
  }, [editingTime]);

  function commitTitle() {
    const trimmed = draftTitle.trim();
    if (trimmed) onChange({ title: trimmed });
    else if (title) setDraftTitle(title); // revert if emptied
    setEditing(false);
  }

  function commitTime() {
    const t = draftTime.trim();
    onChange({ time: t || null });
    setEditingTime(false);
  }

  function cyclePriority() {
    const order = ['low','medium','high'];
    const i = order.indexOf(priority || 'low');
    const next = order[(i + 1) % order.length];
    onChange({ priority: next });
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        'task',
        done ? 'task--done' : '',
        priority === 'high' ? 'task--high' : '',
        focusing ? 'task--focusing' : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        ref={setActivatorNodeRef}
        className="task__handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >⋮⋮</button>

      <button
        className="task__check"
        onClick={() => onChange({ done: !done })}
        aria-pressed={done}
        aria-label={done ? 'Mark not done' : 'Mark done'}
      >
        {done && <span className="task__check-icon">✓</span>}
      </button>

      <button
        className="task__priority"
        onClick={cyclePriority}
        title={`Priority: ${priority || 'low'} — click to cycle`}
      >
        <span className="task__priority-dot" style={{ background: meta.color }} />
      </button>

      <button
        className="task__focus"
        onClick={(e) => {
          e.stopPropagation();
          if (focusing) {
            // Pause if running, resume if paused.
            if (focus.status === 'paused') {
              focus.resume();
            } else {
              focus.pause();
            }
          } else {
            focus.start(task);
          }
        }}
        title={focusing
          ? (focus.status === 'paused' ? 'Resume focus session' : 'Pause focus session')
          : 'Start a focus session for this task'}
        aria-label={focusing ? 'Pause/resume focus session' : 'Start focus session'}
      >
        {focusing ? (focus.status === 'paused' ? '▶' : '⏸') : '▶'}
      </button>

      <div className="task__body">
        {editing ? (
          <input
            ref={inputRef}
            className="task__title-input"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle();
              else if (e.key === 'Escape') { setDraftTitle(title); setEditing(false); }
            }}
          />
        ) : (
          <span
            className="task__title"
            onClick={() => { setDraftTitle(title); setEditing(true); }}
            title="Click to edit"
          >
            {title}
          </span>
        )}

        {editingTime ? (
          <input
            ref={timeRef}
            className="task__time-input"
            value={draftTime}
            placeholder="e.g. 9am"
            onChange={(e) => setDraftTime(e.target.value)}
            onBlur={commitTime}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTime();
              else if (e.key === 'Escape') { setDraftTime(time || ''); setEditingTime(false); }
            }}
          />
        ) : (
          <span
            className="task__time"
            onClick={() => { setDraftTime(time || ''); setEditingTime(true); }}
            title="Click to add/edit time"
          >
            {time || '+ time'}
          </span>
        )}
      </div>

      <button
        className="task__delete"
        onClick={onDelete}
        aria-label="Delete task"
        title="Delete task"
      >×</button>
    </li>
  );
}
