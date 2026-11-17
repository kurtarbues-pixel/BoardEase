import React, { useState } from 'react';
import { api } from '../../api/client';
import { Field } from '../../components/Common/Field';
import { ThemeToggle } from '../../components/Common/ThemeToggle';

export const ResetPasswordPage: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const params = new URLSearchParams(window.location.search);
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/password/reset', { method: 'POST', body: {
        token: params.get('token'), email, password, password_confirmation: confirmation,
      } });
      onComplete();
    } catch (err: any) {
      setError(err.message || 'This reset link is invalid or has expired.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-theme-wrapper">
        <ThemeToggle showLabel />
      </div>
      <section className="auth-card" aria-labelledby="reset-heading">
        <div className="auth-header">
          <div className="auth-brand">
            <img className="brand-mark auth-mark" src="/bhms-logo.svg" alt="BoardEase" />
            <div className="auth-brand-text">
              <strong>BoardEase</strong>
              <small>Boarding House Rentals</small>
            </div>
          </div>
          <p className="eyebrow">BOARDEASE &bull; RENTAL &amp; MANAGEMENT PLATFORM</p>
          <h1 id="reset-heading">Choose a new password</h1>
          <p className="auth-subtext">Set up your new password to regain access to your account.</p>
        </div>

        {error && <div className="notice notice-error" role="alert">{error}</div>}

        <form className="form-stack" onSubmit={submit}>
          <Field label="Email address" required>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="New password" hint="Must be at least 8 characters" required>
            <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Field label="Confirm new password" required>
            <input type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required />
          </Field>
          <button className="button primary full" disabled={busy}>
            {busy ? 'Updating…' : 'Reset Password'}
          </button>
        </form>

        <div className="auth-bottom-nav">
          <button
            type="button"
            className="auth-back-btn"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '/login';
              }
            }}
            aria-label="Back to sign in page"
          >
            ← Back
          </button>
        </div>
      </section>
    </main>
  );
};
