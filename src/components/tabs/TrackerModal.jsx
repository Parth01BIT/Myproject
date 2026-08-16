import { useState } from 'react';

const TYPES = [
  { id: 'boolean', label: 'Boolean', hint: 'Toggle — logged or not' },
  { id: 'number',  label: 'Number',  hint: 'Daily value + unit' },
];

/**
 * Modal for creating/editing a tracker (PRD TR-001, TR-010).
 * Editing only changes name/unit — type can't change post-create (logs depend on it).
 */
export default function TrackerModal({ initial = null, onSave, onClose }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'boolean');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const isEditing = !!initial;

  const valid = name.trim().length > 0;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onSave({
      name: name.trim(),
      type, // ignored on edit per the note above
      unit: type === 'number' ? (unit.trim() || null) : null,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
      >
        <header className="modal__head">
          <h2 className="modal__title">{isEditing ? 'Edit tracker' : 'New tracker'}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="field__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            placeholder="e.g. Drink water"
          />
        </label>

        {!isEditing && (
          <div className="field">
            <span className="field__label">Type</span>
            <div className="radios">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`radios__opt${type === t.id ? ' radios__opt--active' : ''}`}
                  onClick={() => setType(t.id)}
                >
                  <strong>{t.label}</strong>
                  <em>{t.hint}</em>
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'number' && (
          <label className="field">
            <span className="field__label">Unit (optional)</span>
            <input
              className="field__input"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. glasses, hours, km"
            />
          </label>
        )}

        <footer className="modal__foot">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={!valid}>
            {isEditing ? 'Save' : 'Create'}
          </button>
        </footer>
      </form>
    </div>
  );
}
