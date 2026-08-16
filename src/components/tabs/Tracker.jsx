import { useState } from 'react';
import DataStore from '../../store/DataStore.js';
import { useAsyncResult } from '../../hooks/useAsyncResult.js';
import TrackerCard from './TrackerCard.jsx';
import TrackerModal from './TrackerModal.jsx';

/**
 * Tracker tab (PRD §6.5).
 * V2.4: list load via useAsyncResult. CRUD writes async — bump version after
 * each await resolves to trigger a clean re-read.
 */
export default function Tracker({ route, setRoute, bumpStale }) {
  const [version, setVersion] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { data: trackers, loading } = useAsyncResult(
    `trackers:${version}`,
    () => DataStore.tracker.list(),
    [version]
  );

  const bump = () => { setVersion((v) => v + 1); bumpStale?.(); };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSave = (data) => {
    const work = editing
      ? DataStore.tracker.update(editing.id, { name: data.name, unit: data.unit })
      : DataStore.tracker.create(data);
    work
      .then(() => { closeModal(); bump(); })
      .catch((err) => console.warn('[PARTH] tracker save failed:', err?.message));
  };

  const handleDelete = (id) => {
    const t = (trackers || []).find((x) => x.id === id);
    if (!t) return;
    if (window.confirm(`Delete tracker "${t.name}" and all its logs? This cannot be undone.`)) {
      DataStore.tracker.delete(id)
        .then(() => bump())
        .catch((err) => console.warn('[PARTH] tracker delete failed:', err?.message));
    }
  };

  return (
    <div className="tracker">
      <header className="tracker__head">
        <h2 className="tracker__title">Trackers</h2>
        <button
          className="btn btn--primary"
          onClick={() => { setEditing(null); setModalOpen(true); }}
        >+ New tracker</button>
      </header>

      {loading && !trackers ? (
        <div className="tracker__empty" aria-live="polite">Loading…</div>
      ) : !trackers || trackers.length === 0 ? (
        <div className="tracker__empty">
          No trackers yet. Create one to start.
        </div>
      ) : (
        <div className="tracker__grid">
          {trackers.map((t) => (
            <TrackerCard
              key={t.id}
              tracker={t}
              onChange={bump}
              onEdit={() => { setEditing(t); setModalOpen(true); }}
              onDelete={() => handleDelete(t.id)}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <TrackerModal
          initial={editing}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
