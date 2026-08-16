/**
 * macOS-style window controls (PRD SH-001 .. SH-004).
 * Three colored dots, top-left of the title bar. Decorative for v1.
 */
export default function WindowControls() {
  return (
    <div className="window-controls" aria-hidden="true">
      <span className="wc wc--close" />
      <span className="wc wc--min" />
      <span className="wc wc--max" />
    </div>
  );
}
