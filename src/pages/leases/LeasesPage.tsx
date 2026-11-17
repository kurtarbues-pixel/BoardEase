import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, fetchAll, formatMoney, getTodayDateString, listData, getToken } from '../../api/client';
import { Lease, LeaseFormData, Room, User } from '../../types';
import { Panel } from '../../components/Common/Panel';
import { Field } from '../../components/Common/Field';
import { Modal } from '../../components/Common/Modal';
import { StatusBadge } from '../../components/Common/StatusBadge';
import { LoadingState, EmptyState, ErrorState } from '../../components/Common/States';

interface LeasesPageProps {
  announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const LeasesPage: React.FC<LeasesPageProps> = ({ announce }) => {
  const { user } = useAuth();
  const canManage = user?.role !== 'tenant';

  const [leases, setLeases] = useState<Lease[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create lease modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [startDate, setStartDate] = useState(getTodayDateString());
  const [endDate, setEndDate] = useState('');
  const [rentOverride, setRentOverride] = useState('');
  const [inspectionLease, setInspectionLease] = useState<Lease | null>(null);
  const [inspectionKind, setInspectionKind] = useState<'move_in' | 'move_out'>('move_in');
  const [inspectionDate, setInspectionDate] = useState(getTodayDateString());
  const [inspectionCondition, setInspectionCondition] = useState('');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [damageAmount, setDamageAmount] = useState('0');
  const [damageDescription, setDamageDescription] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [leaseRows, roomRows] = await Promise.all([
        fetchAll<Lease>('/leases'),
        fetchAll<Room>('/rooms?per_page=50'),
      ]);
      setLeases(leaseRows);
      setRooms(roomRows);

      if (canManage) {
        const tenantRes = await api<{ data: User[] }>('/tenants');
        setTenants(listData<User>(tenantRes));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load lease records.');
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setEditingLease(null);
    setSelectedTenantId('');
    setSelectedRoomId('');
    setStartDate(getTodayDateString());
    setEndDate('');
    setRentOverride('');
    setIsModalOpen(true);
  };

  const openEditModal = (lease: Lease) => {
    setEditingLease(lease);
    setSelectedTenantId(String(lease.tenant_id));
    setSelectedRoomId(String(lease.room_id));
    setStartDate(lease.start_date || getTodayDateString());
    setEndDate(lease.end_date || '');
    setRentOverride(String(lease.monthly_rent ?? ''));
    setIsModalOpen(true);
  };

  const handleSaveLease = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    try {
      if (editingLease) {
        await api(`/leases/${editingLease.id}`, {
          method: 'PATCH',
          body: {
            start_date: startDate,
            end_date: endDate.trim() ? endDate : null,
            monthly_rent: rentOverride.trim() ? Number(rentOverride) : null,
          },
        });
        announce('Lease updated successfully!');
      } else {
        if (!selectedTenantId || !selectedRoomId) {
          announce('Please select both a tenant and a room.', 'warning');
          setIsSaving(false);
          return;
        }

        const payload: LeaseFormData = {
          tenant_id: Number(selectedTenantId),
          room_id: Number(selectedRoomId),
          start_date: startDate,
          end_date: endDate.trim() ? endDate : null,
          monthly_rent: rentOverride.trim() ? Number(rentOverride) : null,
        };

        await api('/leases', {
          method: 'POST',
          body: payload,
        });
        announce('Lease created successfully! The room is now marked as occupied.');
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      announce(err.message || (editingLease ? 'Failed to update lease.' : 'Failed to create lease.'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndLease = async (lease: Lease) => {
    const tenantName = lease.tenant?.name || 'this tenant';
    const roomNumber = lease.room?.room_number || 'this room';

    if (!window.confirm(`Start the move-out inspection for ${tenantName} in Room ${roomNumber}? The room will remain occupied until the inspection is saved.`)) {
      return;
    }
    openInspection(lease, 'move_out');
  };

  const openInspection = (lease: Lease, kind: 'move_in' | 'move_out') => {
    setInspectionLease(lease); setInspectionKind(kind); setInspectionDate(getTodayDateString());
    setInspectionCondition(''); setInspectionNotes(''); setDamageAmount('0'); setDamageDescription('');
  };

  const saveInspection = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inspectionLease) return;
    setIsInspecting(true);
    try {
      await api(`/leases/${inspectionLease.id}/inspections`, { method: 'POST', body: {
        kind: inspectionKind, inspection_date: inspectionDate, condition: inspectionCondition,
        notes: inspectionNotes || null, damages_amount: inspectionKind === 'move_out' ? Number(damageAmount || 0) : 0,
        damage_description: damageDescription || null,
      } });
      announce(inspectionKind === 'move_in' ? 'Move-in inspection recorded; room is now occupied.' : 'Move-out completed; the room is available and any damage charge was added to billing.');
      setInspectionLease(null); await loadData();
    } catch (err: any) { announce(err.message || 'Could not save the inspection.', 'error'); }
    finally { setIsInspecting(false); }
  };

  const acceptAgreement = async (lease: Lease) => {
    if (!window.confirm(`Review the lease for Room ${lease.room?.room_number}: ${formatMoney(lease.monthly_rent)}/month, ${lease.start_date} to ${lease.end_date || 'open-ended'}. Accept these terms?`)) return;
    try {
      await api(`/leases/${lease.id}/agreement/accept`, { method: 'POST', body: { agreement_accepted: true } });
      announce('Lease agreement accepted. Your landlord can now record the move-in inspection.'); await loadData();
    } catch (err: any) { announce(err.message || 'Could not accept the lease agreement.', 'error'); }
  };

  const downloadAgreement = async (lease: Lease) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/leases/${lease.id}/agreement.pdf`, { headers: { Authorization: `Bearer ${getToken() || ''}`, Accept: 'application/pdf' } });
      if (!response.ok) throw new Error('Could not download the agreement.');
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a');
      link.href = url; link.download = `BoardEase-Lease-Agreement-${lease.id}.pdf`; link.click(); URL.revokeObjectURL(url);
    } catch (err: any) { announce(err.message || 'Could not download the agreement.', 'error'); }
  };

  const availableRooms = rooms.filter((r) => r.status === 'available');
  const activeLeases = leases.filter((l) => l.status === 'active');
  const pastLeases = leases.filter((l) => l.status !== 'active');

  return (
    <div className="leases-page">
      <div className="welcome-block">
        <div>
          <h2>{canManage ? 'Tenants & Occupancy' : 'My Lease Information'}</h2>
          <p className="muted">
            {canManage
              ? 'Track active tenants, room assignments, contract dates, and lease history.'
              : 'Review your current tenancy agreement and contract terms.'}
          </p>
        </div>
        <div className="actions-cluster">
          {canManage && (
            <button type="button" className="button primary" onClick={openCreateModal}>
              + Record New Lease
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading lease agreements…" />
      ) : error ? (
        <ErrorState error={error} retry={loadData} />
      ) : (
        <>
          <Panel
            title={`Active Leases (${activeLeases.length})`}
            description="Currently ongoing tenant contracts and occupied room units."
          >
            {activeLeases.length === 0 ? (
              <EmptyState message="No active leases found." />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Room</th>
                      <th>Monthly Rent</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                      <th>{canManage ? 'Actions' : 'Agreement'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeLeases.map((lease) => (
                      <tr key={lease.id}>
                        <td>
                          <strong>{lease.tenant?.name || 'Tenant'}</strong>
                          <small className="cell-sub">{lease.tenant?.email}</small>
                        </td>
                        <td>
                          Room {lease.room?.room_number}
                          <small className="cell-sub">{lease.room?.title}</small>
                        </td>
                        <td>
                          <strong>{formatMoney(lease.monthly_rent)}</strong>
                          <small className="cell-sub">Outstanding: {formatMoney(lease.outstanding_balance || 0)}</small>
                        </td>
                        <td>{lease.start_date}</td>
                        <td>{lease.end_date || <span className="muted">Ongoing</span>}</td>
                        <td>
                          <StatusBadge status={lease.status} />
                          <small className="cell-sub">Agreement: {lease.agreement_status || 'legacy'}{lease.inspections?.some((row) => row.kind === 'move_in') ? ' · Move-in complete' : ' · Move-in pending'}</small>
                          {Boolean(lease.inspections?.length) && <details className="lease-inspection-details"><summary>Inspection records ({lease.inspections!.length})</summary>{lease.inspections!.map((inspection) => <div key={inspection.id}><strong>{inspection.kind === 'move_in' ? 'Move-in' : 'Move-out'} · {inspection.inspection_date}</strong><p>{inspection.condition}</p>{inspection.notes && <p>{inspection.notes}</p>}{Number(inspection.damages_amount) > 0 && <p>Damage charge: {formatMoney(inspection.damages_amount)} — {inspection.damage_description}</p>}</div>)}</details>}
                        </td>
                        {canManage && (
                          <td>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="button secondary sm"
                                onClick={() => openEditModal(lease)}
                              >
                                Edit
                              </button>
                              {lease.agreement_status === 'accepted' && !lease.inspections?.some((row) => row.kind === 'move_in') && <button type="button" className="button secondary sm" onClick={() => openInspection(lease, 'move_in')}>Record Move-in</button>}
                              {(lease.inspections?.some((row) => row.kind === 'move_in') || lease.agreement_status === 'legacy') && !lease.inspections?.some((row) => row.kind === 'move_out') && <button type="button" className="button danger-outline sm" onClick={() => handleEndLease(lease)}>Move-out</button>}
                              <button type="button" className="button secondary sm" onClick={() => void downloadAgreement(lease)}>Lease PDF</button>
                            </div>
                          </td>
                        )}
                        {!canManage && <td><div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><button type="button" className="button secondary sm" onClick={() => void downloadAgreement(lease)}>Download lease PDF</button>{lease.agreement_status === 'pending' && <button type="button" className="button primary sm" onClick={() => void acceptAgreement(lease)}>Review &amp; Accept</button>}</div></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title={`Past Leases (${pastLeases.length})`}
            description="Historical records of terminated and completed leases."
            className="spaced-panel"
          >
            {pastLeases.length === 0 ? (
              <EmptyState message="No past leases recorded." />
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Tenant</th>
                      <th>Room</th>
                      <th>Monthly Rent</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastLeases.map((lease) => (
                      <tr key={lease.id}>
                        <td>
                          <strong>{lease.tenant?.name || 'Tenant'}</strong>
                          <small className="cell-sub">{lease.tenant?.email}</small>
                        </td>
                        <td>
                          Room {lease.room?.room_number} · {lease.room?.title}
                        </td>
                        <td>{formatMoney(lease.monthly_rent)}</td>
                        <td>{lease.start_date}</td>
                        <td>{lease.end_date || 'Terminated'}</td>
                        <td>
                          <StatusBadge status={lease.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {/* Record / Edit Lease Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLease ? `Edit Lease — Room ${editingLease.room?.room_number}` : 'Record New Lease'}
        maxWidth="600px"
      >
        <form className="form-grid" onSubmit={handleSaveLease}>
          {editingLease ? (
            <>
              <Field label="Tenant">
                <input
                  type="text"
                  value={`${editingLease.tenant?.name || 'Tenant'} (${editingLease.tenant?.email || ''})`}
                  disabled
                />
              </Field>

              <Field label="Room">
                <input
                  type="text"
                  value={`Room ${editingLease.room?.room_number} · ${editingLease.room?.title}`}
                  disabled
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Tenant" required hint="Select an active registered tenant">
                <select
                  value={selectedTenantId}
                  onChange={(e) => setSelectedTenantId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    -- Select a Tenant --
                  </option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.email})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Available Room" required hint="Only rooms currently 'available' are listed">
                <select
                  value={selectedRoomId}
                  onChange={(e) => {
                    setSelectedRoomId(e.target.value);
                    const selected = availableRooms.find((r) => String(r.id) === e.target.value);
                    if (selected && !rentOverride) {
                      setRentOverride(String(selected.price));
                    }
                  }}
                  required
                >
                  <option value="" disabled>
                    -- Select an Available Room --
                  </option>
                  {availableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Room {r.room_number} · {r.title} ({formatMoney(r.price)}/mo)
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}

          <Field label="Lease Start Date" required>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </Field>

          <Field label="Lease End Date (optional)" hint="Leave blank for open-ended / month-to-month">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>

          <Field
            label="Monthly Rent (₱)"
            hint={editingLease ? 'Update the agreed monthly rent' : 'Leave blank to use the standard room price'}
          >
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={rentOverride}
              onChange={(e) => setRentOverride(e.target.value)}
              placeholder="e.g. 5000.00"
            />
          </Field>

          <div className="form-actions">
            <button
              type="submit"
              className="button primary"
              disabled={isSaving || (!editingLease && (!tenants.length || !availableRooms.length))}
            >
              {isSaving ? 'Saving…' : editingLease ? 'Update Lease' : 'Create & Activate Lease'}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
          </div>

          {!editingLease && !availableRooms.length && (
            <p className="notice notice-warning">
              ⚠️ There are no rooms marked as 'Available'. Please add or adjust room status first.
            </p>
          )}
        </form>
      </Modal>
      <Modal isOpen={Boolean(inspectionLease)} onClose={() => { if (!isInspecting) setInspectionLease(null); }} title={inspectionKind === 'move_in' ? 'Move-in inspection' : 'Move-out inspection'} maxWidth="620px">
        {inspectionLease && <form className="form-grid" onSubmit={saveInspection}>
          <p className="muted">Room {inspectionLease.room?.room_number} · {inspectionLease.tenant?.name}. The room is not released until the move-out inspection is saved.</p>
          <Field label="Inspection date" required><input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} required /></Field>
          <Field label="Room condition" required><textarea rows={4} value={inspectionCondition} onChange={(e) => setInspectionCondition(e.target.value)} placeholder="Describe the room condition in detail" required /></Field>
          <Field label="Inspection notes"><textarea rows={3} value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} placeholder="Optional inspection notes" /></Field>
          {inspectionKind === 'move_out' && <><Field label="Damage charge (PHP)"><input type="number" min="0" step="0.01" value={damageAmount} onChange={(e) => setDamageAmount(e.target.value)} /></Field><Field label="Damage description"><input value={damageDescription} onChange={(e) => setDamageDescription(e.target.value)} maxLength={180} placeholder="Optional" /></Field></>}
          <div className="form-actions"><button type="submit" className="button primary" disabled={isInspecting || !inspectionCondition.trim()}>{isInspecting ? 'Saving…' : 'Complete inspection'}</button><button type="button" className="button secondary" onClick={() => setInspectionLease(null)}>Cancel</button></div>
        </form>}
      </Modal>
    </div>
  );
};

