import { useState } from 'react';
import { useAuth } from '../../contexts/Auth.jsx';

/**
 * Login — Stage A email OTP gate.
 * Shown by App when `useAuth().user` is null.
 *
 * Flow:  email → "send code" → 6-digit input → "verify" → session.
 */
export default function Login() {
  const { sendOtp, verifyOtp, busy, error, needsConfig } = useAuth();
  const [email, setEmail]     = useState('');
  const [code, setCode]         = useState('');
  const [sentStage, setSent] = useState(false);

  function onSubmitEmail(e) {
    e.preventDefault();
    if (!email.trim()) return;
    sendOtp(email)
      .then(() => setSent(true))
      .catch(() => {});
  }

  function onSubmitCode(e) {
    e.preventDefault();
    if (code.trim().length < 6) return;
    verifyOtp(email, code).catch(() => {});
  }

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__brand">
          <span className="login__brand-mark">◐</span>
          <span className="login__brand-name">PARTH</span>
        </div>

        {needsConfig && (
          <div className="login__note">
            Supabase isn't configured. Create <code>.env.local</code> with
            your <code>VITE_SUPABASE_URL</code> and
            <code> VITE_SUPABASE_ANON_KEY</code>, then restart the dev server.
          </div>
        )}

        {!sentStage ? (
          <form className="login__form" onSubmit={onSubmitEmail}>
            <label className="login__label" htmlFor="login-email">Sign in with email</label>
            <input
              id="login-email"
              className="login__input"
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
              autoComplete="email"
            />
            <button
              className="login__submit"
              type="submit"
              disabled={busy || needsConfig || !email.trim()}
            >
              {busy ? 'Sending…' : 'Send 6-digit code →'}
            </button>
            <p className="login__hint">
              A one-time 6-digit code will be emailed to you. No password to remember.
            </p>
          </form>
        ) : (
          <form className="login__form" onSubmit={onSubmitCode}>
            <label className="login__label" htmlFor="login-code">
              Enter the code sent to <strong>{email}</strong>
            </label>
            <input
              id="login-code"
              className="login__input login__input--code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6,8}"
              maxLength={8}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              autoComplete="one-time-code"
            />
            <button
              className="login__submit"
              type="submit"
              disabled={busy || code.trim().length < 6}
            >
              {busy ? 'Verifying…' : 'Verify & sign in →'}
            </button>
            <button
              className="login__back"
              type="button"
              onClick={() => { setSent(false); setCode(''); }}
              disabled={busy}
            >
              ← Use a different email
            </button>
          </form>
        )}

        {error && <div className="login__error" role="alert">{error}</div>}

        <div className="login__foot">
          Your data is private to your account on Supabase.
        </div>
      </div>
    </div>
  );
}
