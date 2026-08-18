import { useEffect, useState } from 'react';

/**
 * Cross-tab heartbeat + boot gate (PRD BT-007, BT-008).
 *
 * - On mount, listens for a heartbeat on localStorage('parth:heartbeat').
 *   If a heartbeat has touched localStorage within the last 5s, another PARTH
 *   tab is active — we treat that as "boot already shown" and skip.
 * - sessionStorage('parth:booted') marks this tab as already booted.
 *
 * Returns [shouldBoot, done]. After boot animation completes the parent calls
 * done(), which marks booted + starts the local heartbeat so future tabs
 * consider this one active.
 */
const HEARTBEAT_KEY = 'parth:heartbeat';
const SESSION_KEY = 'parth:booted-this-tab';
const HEARTBEAT_INTERVAL_MS = 4000;
const HEARTBEAT_FRESH_WINDOW_MS = 8000;

// Module-level guard: only one heartbeat interval per page lifetime.
// Prevents duplicate intervals on hot-reload / React StrictMode double-mount.
let _heartbeatId = null;

export function useBootGate({ bootDurationMs = 2000 }) {
  const [shouldBoot, setShouldBoot] = useState(null); // null = pending, true = run, false = skip

  useEffect(() => {
    // Already booted in this tab? sessionStorage is per-tab.
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') {
        setShouldBoot(false);
        return;
      }
    } catch { /* sessionStorage may be unavailable */ }

    // Cross-tab freshness check: anything in localStorage?
    let freshFromStorage = false;
    try {
      const raw = localStorage.getItem(HEARTBEAT_KEY);
      if (raw) {
        const ts = Number(raw);
        if (!Number.isNaN(ts) && Date.now() - ts < HEARTBEAT_FRESH_WINDOW_MS) {
          freshFromStorage = true;
        }
      }
    } catch {}

    if (freshFromStorage) {
      markBootedAndStartHeartbeat();
      setShouldBoot(false);
      return;
    }

    // Wait briefly for a storage event (covers the race where another tab is
    // booting at the same instant as this one). If none arrives, run boot.
    let cancelled = false;
    const onStorage = (e) => {
      if (e.key === HEARTBEAT_KEY && !cancelled) {
        const ts = Number(e.newValue);
        if (!isNaN(ts) && Date.now() - ts < HEARTBEAT_FRESH_WINDOW_MS) {
          cancelled = true;
          window.removeEventListener('storage', onStorage);
          markBootedAndStartHeartbeat();
          setShouldBoot(false);
        }
      }
    };
    window.addEventListener('storage', onStorage);

    // After a short window with no competing heartbeat, claim the boot.
    const raceTimer = setTimeout(() => {
      if (cancelled) return;
      window.removeEventListener('storage', onStorage);
      setShouldBoot(true);
    }, 120);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearTimeout(raceTimer);
    };
  }, []);

  function markBootedAndStartHeartbeat() {
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
    try { localStorage.setItem(HEARTBEAT_KEY, String(Date.now())); } catch {}
    if (!_heartbeatId) {
      _heartbeatId = setInterval(() => {
        try { localStorage.setItem(HEARTBEAT_KEY, String(Date.now())); } catch {}
      }, HEARTBEAT_INTERVAL_MS);
    }
  }

  // Called by parent when the boot animation finishes.
  function done() {
    markBootedAndStartHeartbeat();
    setShouldBoot(false);
  }

  // Boot duration budget for the parent component (BT-005).
  void bootDurationMs;
  return [shouldBoot, done];
}
