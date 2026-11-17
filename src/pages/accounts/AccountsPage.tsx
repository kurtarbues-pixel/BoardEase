import React, { useCallback, useEffect, useState } from 'react';
import { api, fetchAll } from '../../api/client';
import { Role, User } from '../../types';
import { Panel } from '../../components/Common/Panel';
import { Field } from '../../components/Common/Field';
import { Modal } from '../../components/Common/Modal';
import { LoadingState, EmptyState, ErrorState } from '../../components/Common/States';

interface AccountsPageProps {
  announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AccountsPage: React.FC<AccountsPageProps> = ({ announce }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Email modal
  const [emailUser, setEmailUser] = useState<User | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAll<User>('/admin/users');
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load user accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateUserField = async (account: User, field: string, value: any) => {
    try {
      await api(`/admin/users/${account.id}`, {
        method: 'PATCH',
        body: { [field]: value },
      });
      announce(`Account updated (${field}).`);
      await loadUsers();
    } catch (err: any) {
      announce(err.message || 'Failed to update account.', 'error');
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailUser) return;

    setIsSaving(true);
    try {
      await api(`/admin/users/${emailUser.id}`, {
        method: 'PATCH',
        body: { email: newEmail.trim() },
      });
      announce(`Email address updated for ${emailUser.name}.`);
      setEmailUser(null);
      setNewEmail('');
      await loadUsers();
    } catch (err: any) {
      announce(err.message || 'Failed to update email.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="accounts-page">
      <div className="welcome-block">
        <div>
          <h2>User Accounts & Permissions</h2>
          <p className="muted">
            View and manage Admin, Landlord, and Tenant access, update account details, and activate or deactivate accounts. Existing legacy accounts are preserved.
          </p>
        </div>
        <div className="actions-cluster">
          <button type="button" className="button secondary" onClick={loadUsers}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading user accounts…" />
      ) : error ? (
        <ErrorState error={error} retry={loadUsers} />
      ) : (
        <Panel
          title={`Registered Accounts (${users.length})`}
          description="Administrative control over all system logins."
        >
          {users.length === 0 ? (
            <EmptyState message="No user accounts found." />
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <strong>{account.name}</strong>
                      </td>
                      <td>{account.username || <span className="muted">—</span>}</td>
                      <td>{account.email}</td>
                      <td>{account.phone || <span className="muted">—</span>}</td>
                      <td>
                        {account.role === 'staff' ? (
                          <div className="legacy-role-control">
                            <span className="legacy-role-label" title="This existing account is preserved; new staff accounts cannot be created.">Existing staff account</span>
                            <select className="table-select" defaultValue="" onChange={(e) => { if (e.target.value) void updateUserField(account, 'role', e.target.value as Role); }} aria-label={`Assign a supported role to ${account.name}`}>
                              <option value="" disabled>Choose supported role…</option>
                              <option value="admin">Admin</option>
                              <option value="landlord">Landlord</option>
                              <option value="tenant">Tenant</option>
                            </select>
                          </div>
                        ) : (
                          <select
                            className="table-select"
                            value={account.role}
                            onChange={(e) => updateUserField(account, 'role', e.target.value as Role)}
                            aria-label={`Role for ${account.name}`}
                          >
                            <option value="admin">Admin</option>
                            <option value="landlord">Landlord</option>
                            <option value="tenant">Tenant</option>
                          </select>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`status-pill-button ${account.is_active ? 'active' : 'inactive'}`}
                          onClick={() =>
                            updateUserField(account, 'is_active', !account.is_active)
                          }
                          title="Click to toggle account access"
                        >
                          {account.is_active ? '● Active' : '○ Disabled'}
                        </button>
                      </td>
                      <td>
                        <div className="inline-action-btns">
                          <button
                            type="button"
                            className="button secondary sm"
                            onClick={() => {
                              setEmailUser(account);
                              setNewEmail(account.email);
                            }}
                          >
                            Email
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* Change Email Modal */}
      <Modal
        isOpen={Boolean(emailUser)}
        onClose={() => setEmailUser(null)}
        title={`Change Email for ${emailUser?.name}`}
        maxWidth="460px"
      >
        {emailUser && (
          <form className="form-stack" onSubmit={handleSaveEmail}>
            <Field label="New Email Address" required>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </Field>

            <div className="form-actions">
              <button
                type="submit"
                className="button primary"
                disabled={isSaving || newEmail === emailUser.email}
              >
                {isSaving ? 'Saving…' : 'Save Email'}
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setEmailUser(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

