/**
 * DataStore swap-point (PRD §7, §13.4).
 * All tabs import from here — never from supabaseStore or localStorage
 * directly.
 *
 * V2.4: live tree reads from supabaseStore (async). localStorage.js is
 * retained and imported by migrateLocalToSupabase.js for the one-shot
 * upload on first login.
 */
export { DataStore as default } from './supabaseStore.js';
export { DataStore } from './supabaseStore.js';
