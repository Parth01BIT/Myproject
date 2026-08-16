import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { sb, isSupabaseConfigured } from '../lib/supabaseClient.js';
import { migrateLocalToSupabase } from '../lib/migrateLocalToSupabase.js';

/**
 * Auth context (V2.4 — Stage A scaffolding).
 *
 * Email 6-digit OTP flow:
 *   1. sendOtp(email)        → Supabase emails a 6-digit code
 *   2. verifyOtp(email, code) → exchanges code for a session
 * Session persists in localStorage via supabase-js's auth.persistSession=true,
 * so a refresh on phone doesn't force re-login.
 *
 * States:
 *   loading: true until first session read completes (App waits on this)
 *   user:    null (= show Login) or { id, email }
 *   error:   surface to the Login UI on send/verify failure
 *   needsConfig: true when env vars missing → Login shows a setup note
 *
 * Migration:
 *   On first verified login, if `meta.migrated` is not yet set AND the
 *   supabase `journal` table is empty for this user, we run the Stage-B
 *   `migrateLocalToSupabase()` function and set the flag so it never runs
 *   again. For Stage A the migration is a no-stub — supabaseStore doesn't
 *   exist yet — so it logs and no-ops. Stage B wires the real impl.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading]   = useState(true);
  const [user, setUser]         = useState(null);
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);

  // Initial session read + subscription to auth changes.
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (!active) return;
        if (data?.session?.user) setUser(sn(data.session.user));
      } catch (e) {
        console.warn('[PARTH] getSession failed:', e?.message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    const { data: sub } = sb.auth.onAuthStateChange(async (_evt, session) => {
      if (session?.user) {
        setUser(sn(session.user));
        await maybeMigrate(session.user);
      } else {
        setUser(null);
      }
    });
    return () => {
      active = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  /** Send 6-digit OTP to the given email. */
  async function sendOtp(email) {
    setError(null);
    setBusy(true);
    try {
      const { error: e } = await sb.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (e) throw e;
    } catch (e) {
      setError(humanError(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  /** Verify the 6-digit code and complete login. */
  async function verifyOtp(email, token) {
    setError(null);
    setBusy(true);
    try {
      const { error: e } = await sb.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'email',
      });
      if (e) throw e;
    } catch (e) {
      setError(humanError(e));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await sb.auth.signOut();
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, error, busy, sendOtp, verifyOtp, signOut, needsConfig: !isSupabaseConfigured }),
    [user, loading, error, busy]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/* ---------- helpers ---------- */
function sn(u) {
  return { id: u.id, email: u.email };
}

function humanError(e) {
  const m = (e?.message || '').toLowerCase();
  if (m.includes('rate limit') || m.includes('for security purposes')) {
    return 'Too many codes sent. Wait a minute and try again.';
  }
  if (m.includes('expired') || m.includes('invalid') || m.includes('token')) {
    return 'That code is invalid or expired. Request a new one.';
  }
  return e?.message || 'Something went wrong. Please try again.';
}

/**
 * One-shot migration from localStorage → Supabase.
 * Stage A: no-op stub. The real implementation lives in Stage B's
 * `migrateLocalToSupabase.js` (created when the DataStore is swapped to
 * supabaseStore). This guard ensures Stage B can drop in the real impl
 * without touching Auth.jsx again.
 */
let migrateRan = false;
async function maybeMigrate(user) {
  if (migrateRan) return;
  migrateRan = true;
  try {
    const result = await migrateLocalToSupabase(user);
    if (result?.ok) {
      console.info('[PARTH] local→Supabase migration complete:', result.counts);
    } else if (result?.skipped) {
      console.info('[PARTH] migration skipped:', result.skipped);
    }
  } catch (e) {
    console.warn('[PARTH] migration failed:', e?.message);
    migrateRan = false; // allow retry on next load
  }
}
