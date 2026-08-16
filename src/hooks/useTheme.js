import { useState, useEffect, useCallback } from 'react';
import DataStore from '../store/DataStore.js';

/**
 * Theme hook (V2.1, V2.4-async).
 * Reads persisted theme from DataStore.meta (now async, hits Supabase),
 * applies it to document.documentElement.dataset.theme, exposes a toggle.
 *
 * Default identity is 'dark' (per PRD §8). On first paint we use 'dark'
 * eagerly; the awaited theme supersedes it once the round-trip completes.
 *
 * Write paths (set/toggle) are fire-and-forget async posts to Supabase.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    if (typeof document !== 'undefined' && document.documentElement.dataset.theme) {
      return document.documentElement.dataset.theme;
    }
    return 'dark';
  });

  // Hydrate from Supabase on first mount.
  useEffect(() => {
    let active = true;
    DataStore.meta.getTheme()
      .then((t) => { if (active && (t === 'dark' || t === 'light')) setThemeState(t); })
      .catch((e) => console.warn('[PARTH] theme load failed:', e?.message));
    return () => { active = false; };
  }, []);

  // Apply to DOM on every change.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      DataStore.meta.setTheme(next).catch((e) => console.warn('[PARTH] theme save failed:', e?.message));
      document.documentElement.dataset.theme = next;
      return next;
    });
  }, []);

  const setTheme = useCallback((t) => {
    if (t !== 'dark' && t !== 'light') return;
    DataStore.meta.setTheme(t).catch((e) => console.warn('[PARTH] theme save failed:', e?.message));
    document.documentElement.dataset.theme = t;
    setThemeState(t);
  }, []);

  useEffect(() => {
    if (!document.documentElement.style.colorScheme) {
      document.documentElement.style.colorScheme = theme;
    }
  }, [theme]);

  return { theme, toggle, setTheme };
}
