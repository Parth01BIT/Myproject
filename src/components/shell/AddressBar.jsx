/**
 * Read-only address bar (PRD §6.1.3).
 * Displays parth:// URL in monospace with a lock icon. Not editable.
 */
export default function AddressBar({ address }) {
  return (
    <div className="addressbar" role="status" aria-label="Address">
      <span className="addressbar__lock" aria-hidden="true">🔒</span>
      <span className="addressbar__url">{address}</span>
    </div>
  );
}
