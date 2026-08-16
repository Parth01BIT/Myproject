/**
 * Supabase client (V2.4).
 * Reads credentials from Vite env vars (see .env.local).
 * Exposes the singleton `sb` for both auth and data access.
 *
 * Notes:
 *  - persistSession=true → localStorage stores the access token so a refresh
 *    on mobile doesn't force re-login every visit.
 *  - autoRefreshToken=true → token rotation handled by the SDK.
 *  - detectSessionInUrl=true → handles the magic-link / OTP callback redirect
 *    on the rare cases a hash fragment is present.
 *
 * Until Stage B (the DataStore swap), this client is only used by Auth.jsx.
 * All other code still goes through the localStorage DataStore.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn(
    '[PARTH] Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local. Auth will be disabled until then.'
  );
}

export const sb = createClient(url || 'http://localhost:54321', anon || 'placeholder', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** True when both env vars are populated. Used to gate the auth UI. */
export const isSupabaseConfigured = Boolean(url && anon);
