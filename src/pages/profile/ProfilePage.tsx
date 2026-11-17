import React, { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Field } from '../../components/Common/Field';
import { Panel } from '../../components/Common/Panel';

interface Props { announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void; }

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  visible: boolean;
  onToggleVisibility: () => void;
}

const PasswordInput: React.FC<PasswordInputProps> = ({ visible, onToggleVisibility, ...inputProps }) => (
  <div className="password-input-wrap">
    <input {...inputProps} type={visible ? 'text' : 'password'} />
    <button type="button" className="password-toggle-btn" onClick={onToggleVisibility} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'}>
      {visible ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
      )}
    </button>
  </div>
);

export const ProfilePage: React.FC<Props> = ({ announce }) => {
  const { user, refreshUser, logout } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({ current: false, next: false, confirmation: false, deletion: false });
  const togglePassword = (field: keyof typeof visiblePasswords) => setVisiblePasswords((state) => ({ ...state, [field]: !state[field] }));
  const [busy, setBusy] = useState(false);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try { await api('/profile', { method: 'PUT', body: { name: name.trim(), username: username.trim(), email: email.trim(), phone: phone.trim() || null } }); await refreshUser(); announce('Account settings updated.'); }
    catch (err: any) { announce(err.message || 'Could not update profile.', 'error'); }
    finally { setBusy(false); }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await api('/profile/password', { method: 'PUT', body: { current_password: currentPassword, password: newPassword, password_confirmation: confirmation } });
      setCurrentPassword(''); setNewPassword(''); setConfirmation(''); announce('Password changed successfully.');
    } catch (err: any) { announce(err.message || 'Could not change password.', 'error'); }
    finally { setBusy(false); }
  };

  const deleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!window.confirm('Permanently delete this account? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api('/profile', { method: 'DELETE', body: { current_password: deletePassword } });
      await logout();
    } catch (err: any) { announce(err.message || 'Could not delete account.', 'error'); }
    finally { setBusy(false); }
  };

  return <div className="dashboard-content profile-settings-page"><div className="welcome-block"><div><h2>Account Settings</h2><p className="muted">Update your personal information, username, password, or account.</p></div></div>
    <Panel className="profile-settings-panel" title="My Profile" description="Manage the contact and account details associated with your BoardEase profile."><form className="form-stack profile-settings-form profile-grid-form" onSubmit={saveProfile}>
      <Field label="Full name" required><input value={name} onChange={(e) => setName(e.target.value)} pattern="[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ .'-][A-Za-zÀ-ÖØ-öø-ÿ]+\.?)*" title="Use letters, spaces, apostrophes, hyphens, and periods after initials." maxLength={255} required /></Field>
      <Field label="Username" hint="3–50 characters: letters, numbers, periods, underscores, or hyphens." required><input value={username} onChange={(e) => setUsername(e.target.value)} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,49}" minLength={3} maxLength={50} autoComplete="username" required /></Field>
      <Field label="Email address" required><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></Field>
      <Field label="Phone number"><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={25} /></Field>
      <button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save Profile'}</button>
    </form></Panel>
    <Panel className="profile-settings-panel" title="Security" description="Change your password to keep your account secure."><form className="form-stack profile-settings-form profile-grid-form" onSubmit={changePassword}>
      <Field label="Current password" required><PasswordInput autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} visible={visiblePasswords.current} onToggleVisibility={() => togglePassword('current')} required /></Field>
      <Field label="New password" hint="At least 8 characters" required><PasswordInput autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} visible={visiblePasswords.next} onToggleVisibility={() => togglePassword('next')} required /></Field>
      <Field label="Confirm new password" required><PasswordInput autoComplete="new-password" minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} visible={visiblePasswords.confirmation} onToggleVisibility={() => togglePassword('confirmation')} required /></Field>
      <button className="button primary" disabled={busy}>{busy ? 'Updating…' : 'Change Password'}</button>
    </form></Panel>
    <Panel className="profile-settings-panel profile-account-management" title="Account Management" description="Accounts with room listings, applications, or lease history must be closed by an administrator so related records are preserved.">
      <form className="form-stack profile-settings-form" onSubmit={deleteAccount}>
        <p className="muted">Deleting your account is permanent. Enter your current password to confirm.</p>
        <Field label="Current password" required><PasswordInput autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} visible={visiblePasswords.deletion} onToggleVisibility={() => togglePassword('deletion')} required /></Field>
        <button type="submit" className="button danger-outline" disabled={busy}>{busy ? 'Deleting…' : 'Delete My Account'}</button>
      </form>
    </Panel>
  </div>;
};
