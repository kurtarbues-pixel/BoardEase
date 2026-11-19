import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Field } from '../../components/Common/Field';
import { ThemeToggle } from '../../components/Common/ThemeToggle';
import { api } from '../../api/client';
import { authRoutePath, AuthRoute, resolveAuthRoute } from './authRoute';

interface AuthPageProps {
  onSuccessNotice?: (message: string) => void;
}

type RegistrationField = 'name' | 'username' | 'phone' | 'email' | 'password';
type RegistrationErrors = Partial<Record<RegistrationField, string>>;

const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
const USERNAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,49}$/;
const PHONE_PATTERN = /^(?:09\d{9}|\+639\d{9})$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeNameInput = (value: string) => value.replace(/[^\p{L}\p{M} '\u2019-]/gu, '');
const sanitizePhoneInput = (value: string) => {
  const international = value.startsWith('+');
  const digits = value.replace(/\D/g, '').slice(0, international ? 12 : 11);
  return `${international ? '+' : ''}${digits}`;
};

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccessNotice }) => {
  const { login, register } = useAuth();
  const [route, setRoute] = useState<AuthRoute>(() => resolveAuthRoute(window.location.pathname, window.location.search));
  const [error, setError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({});
  const [successMessage, setSuccessMessage] = useState(() => new URLSearchParams(window.location.search).get('password_reset') === '1' ? 'Password reset successfully. You can now sign in.' : '');
  const [busy, setBusy] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [accountRole, setAccountRole] = useState<'tenant' | 'landlord'>('tenant');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isRegistering = route === 'register';
  const isForgotPassword = route === 'forgot-password';

  const clearFormState = useCallback(() => {
    setError('');
    setFieldErrors({});
    setName('');
    setUsername('');
    setPhone('');
    setAccountRole('tenant');
    setIdentifier('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setSuccessMessage('');
  }, []);

  const navigateAuth = useCallback((nextRoute: AuthRoute, replace = false) => {
    const target = authRoutePath(nextRoute);
    if (window.location.pathname !== target || window.location.search) {
      if (replace) window.history.replaceState({}, '', target);
      else window.history.pushState({}, '', target);
    }
    clearFormState();
    setRoute(nextRoute);
  }, [clearFormState]);

  useEffect(() => {
    const syncRoute = () => {
      if (window.location.pathname.replace(/\/+$/, '') === '/reset-password') return;
      const nextRoute = resolveAuthRoute(window.location.pathname, window.location.search);
      const canonicalPath = authRoutePath(nextRoute);
      const preserveResetNotice = nextRoute === 'login' && new URLSearchParams(window.location.search).get('password_reset') === '1';
      const canonicalUrl = `${canonicalPath}${preserveResetNotice ? '?password_reset=1' : ''}`;
      if (`${window.location.pathname}${window.location.search}` !== canonicalUrl) window.history.replaceState({}, '', canonicalUrl);
      clearFormState();
      if (new URLSearchParams(window.location.search).get('password_reset') === '1') {
        setSuccessMessage('Password reset successfully. You can now sign in.');
      }
      setRoute(nextRoute);
    };

    window.addEventListener('popstate', syncRoute);
    syncRoute();
    return () => window.removeEventListener('popstate', syncRoute);
  }, [clearFormState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isRegistering) {
      const errors: RegistrationErrors = {};
      if (!name.trim()) errors.name = 'Enter your name.';
      else if (!NAME_PATTERN.test(name.trim())) errors.name = 'Use letters, spaces, hyphens, or apostrophes only.';
      if (fieldErrors.name) errors.name = fieldErrors.name;
      if (!username.trim()) errors.username = 'Enter a username.';
      else if (!USERNAME_PATTERN.test(username.trim())) errors.username = 'Use 3–50 letters, numbers, periods, underscores, or hyphens.';
      if (phone && !PHONE_PATTERN.test(phone)) errors.phone = 'Enter 09XXXXXXXXX or +639XXXXXXXXX.';
      if (fieldErrors.phone) errors.phone = fieldErrors.phone;
      if (!email.trim()) errors.email = 'Enter your email address.';
      else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address.';
      if (!password) errors.password = 'Enter a password.';
      else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
      setFieldErrors(errors);
      if (Object.keys(errors).length) return;
    }
    setBusy(true);

    try {
      if (isForgotPassword) {
        await api('/password/forgot', { method: 'POST', body: { email: email.trim() } });
        onSuccessNotice?.('If an account exists for that email, a password reset link has been sent.');
        navigateAuth('login');
        setSuccessMessage('If an account exists for that email, a password reset link has been sent.');
      } else if (isRegistering) {
        await register({
          name: name.trim(),
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          password_confirmation: password,
          role: accountRole,
        });
        onSuccessNotice?.(`Your ${accountRole} account was created. You are now logged in.`);
      } else {
        await login({
          identifier: identifier.trim(),
          email: identifier.trim(),
          password,
        });
        onSuccessNotice?.('Signed in successfully.');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  if (route === 'landing') return <main className="landing-page"><div className="landing-top"><a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigateAuth('landing'); }}><img className="brand-mark" src="/bhms-logo.svg" alt="BoardEase" /><span className="brand-text"><strong>BoardEase</strong><small>Boarding House Rentals</small></span></a><ThemeToggle showLabel /></div><section className="landing-hero"><p className="eyebrow">BOARDEASE &bull; RENTAL &amp; MANAGEMENT PLATFORM</p><h1>Find Rooms. Manage Rentals.<br /><span>Live with Ease.</span></h1><p className="muted">Boarding House Rental &amp; Management Platform. A seamless place to discover rooms, manage applications, and stay on top of rent and property activity.</p><div className="actions-cluster"><button className="button primary" onClick={() => navigateAuth('login')}>Sign in</button><button className="button secondary" onClick={() => navigateAuth('register')}>Create an account</button></div></section><div className="landing-features"><article><b>Browse rooms</b><p className="muted">View current listings, amenities, and availability.</p></article><article><b>Track applications</b><p className="muted">Follow rental requests and respond to offers.</p></article><article><b>Stay organized</b><p className="muted">Review occupancy, invoices, payments, and updates.</p></article></div></main>;

  return (
    <main className="auth-page">
      <div className="auth-theme-wrapper">
        <ThemeToggle showLabel={true} />
      </div>

      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="auth-header">
          <div className="auth-brand">
            <img className="brand-mark auth-mark" src="/bhms-logo.svg" alt="BoardEase" />
            <div className="auth-brand-text">
              <strong>BoardEase</strong>
              <small>Boarding House Rentals</small>
            </div>
          </div>
          <p className="eyebrow">BOARDEASE &bull; RENTAL &amp; MANAGEMENT PLATFORM</p>
          <h1 id="auth-heading">
            {isForgotPassword ? 'Reset your password' : isRegistering ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="auth-subtext">
            {isForgotPassword ? 'Enter your account email to receive a password reset link.' : isRegistering
              ? 'Choose whether you are renting a room or managing boarding house listings on BoardEase.'
              : 'Sign in to access your BoardEase account.'}
          </p>
        </div>

        {error && (
          <div className="notice notice-error" role="alert">
            <span>{error}</span>
          </div>
        )}
        {successMessage && <div className="notice notice-success" role="status"><span>{successMessage}</span></div>}

        <form className="form-stack" onSubmit={handleSubmit} noValidate={isRegistering}>
          {isForgotPassword ? (
            <Field label="Email address" required>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </Field>
          ) : isRegistering ? (
            <>
              <Field label="Full name" required error={fieldErrors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const sanitized = sanitizeNameInput(e.target.value);
                    setName(sanitized);
                    setFieldErrors((current) => ({ ...current, name: sanitized === e.target.value ? undefined : 'Use letters, spaces, hyphens, or apostrophes only.' }));
                  }}
                  onBlur={() => { if (name.trim() && !NAME_PATTERN.test(name.trim())) setFieldErrors((current) => ({ ...current, name: 'Enter a complete name using letters, spaces, hyphens, or apostrophes.' })); }}
                  aria-invalid={Boolean(fieldErrors.name)}
                  autoComplete="name"
                  placeholder="e.g. Juan dela Cruz"
                  required
                  maxLength={255}
                />
              </Field>

              <Field label="Username" error={fieldErrors.username} hint="3–50 characters. Use letters, numbers, periods, underscores, or hyphens." required>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    const value = e.target.value;
                    setUsername(value);
                    setFieldErrors((current) => ({ ...current, username: value && !USERNAME_PATTERN.test(value) ? 'Use 3-50 letters, numbers, periods, underscores, or hyphens.' : undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.username)}
                  autoComplete="username"
                  placeholder="e.g. juandelacruz"
                  pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,49}"
                  minLength={3}
                  maxLength={50}
                  required
                />
              </Field>

              <Field label="Phone number" hint="Optional. Enter 09XXXXXXXXX or +639XXXXXXXXX." error={fieldErrors.phone}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const sanitized = sanitizePhoneInput(e.target.value);
                    setPhone(sanitized);
                    const message = sanitized !== e.target.value
                      ? 'Use digits only and match one of the formats shown.'
                      : sanitized && !PHONE_PATTERN.test(sanitized) ? 'Enter 09XXXXXXXXX or +639XXXXXXXXX.' : undefined;
                    setFieldErrors((current) => ({ ...current, phone: message }));
                  }}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  autoComplete="tel"
                  placeholder="e.g. 09171234567"
                  maxLength={13}
                />
              </Field>

              <Field label="I am registering as" required>
                <select
                  value={accountRole}
                  onChange={(e) => setAccountRole(e.target.value as 'tenant' | 'landlord')}
                  required
                >
                  <option value="tenant">Tenant — looking to rent</option>
                  <option value="landlord">Landlord — listing rooms</option>
                </select>
              </Field>

              <Field label="Email address" required error={fieldErrors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEmail(value);
                    setFieldErrors((current) => ({ ...current, email: value && !EMAIL_PATTERN.test(value.trim()) ? 'Enter a valid email address.' : undefined }));
                  }}
                  aria-invalid={Boolean(fieldErrors.email)}
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                />
              </Field>
            </>
          ) : (
            <Field label="Email address or username" required>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                placeholder="Enter email or username"
                required
              />
            </Field>
          )}

          {!isForgotPassword && <Field
            label="Password"
            hint={isRegistering ? 'Must be at least 8 characters' : undefined}
            required
            error={isRegistering ? fieldErrors.password : undefined}
          >
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  const value = e.target.value;
                  setPassword(value);
                  if (isRegistering) setFieldErrors((current) => ({ ...current, password: value && value.length < 8 ? 'Password must be at least 8 characters.' : undefined }));
                }}
                aria-invalid={isRegistering && Boolean(fieldErrors.password)}
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                minLength={8}
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" x2="22" y1="2" y2="22" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </Field>}

          <button
            type="submit"
            className="button primary full"
            disabled={busy}
          >
            {busy ? 'Please wait…' : isForgotPassword ? 'Send Reset Link' : isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {!isRegistering && !isForgotPassword && <p className="auth-switch"><button type="button" onClick={() => navigateAuth('forgot-password')} className="switch-btn">Forgot password?</button></p>}
        <p className="auth-switch">
          {isRegistering ? 'Already registered?' : isForgotPassword ? 'Remembered your password?' : 'Need an account?'}{' '}
          <button type="button" onClick={() => navigateAuth(isRegistering || isForgotPassword ? 'login' : 'register')} className="switch-btn">
            {isRegistering ? 'Sign in here' : isForgotPassword ? 'Sign in' : 'Register as Tenant or Landlord'}
          </button>
        </p>

        <div className="auth-bottom-nav">
          <button
            type="button"
            className="auth-back-btn"
            onClick={() => navigateAuth('landing')}
            aria-label="Return to the BoardEase home page"
          >
            Home
          </button>
        </div>
      </section>
    </main>
  );
};

