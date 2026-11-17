import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, fetchAll } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Lease } from '../../types';
import { Panel } from '../../components/Common/Panel';
import { Field } from '../../components/Common/Field';
import { LoadingState, EmptyState, ErrorState } from '../../components/Common/States';
import { StatusBadge } from '../../components/Common/StatusBadge';
import { formatBusinessDateTime } from '../../utils/date';

interface MaintenanceItem {
  id: number; lease_id: number; title: string; description: string; status: 'pending' | 'in_progress' | 'resolved';
  created_at: string; photo_path?: string | null; photo_url?: string | null; lease?: { room?: { room_number: string; title: string } };
  tenant?: { name: string }; landlord?: { name: string };
}
type PhotoEdit = { file: File; previewUrl: string } | { remove: true };
interface Props { announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void; }

export const MaintenancePage: React.FC<Props> = ({ announce }) => {
  const { user } = useAuth();
  const tenant = user?.role === 'tenant';
  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [leaseId, setLeaseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [photoEdits, setPhotoEdits] = useState<Record<number, PhotoEdit>>({});
  const [photoEditErrors, setPhotoEditErrors] = useState<Record<number, string>>({});
  const [savingPhotoId, setSavingPhotoId] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<'new' | number>('new');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const photoPreview = useMemo(() => photo ? URL.createObjectURL(photo) : '', [photo]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  useEffect(() => () => {
    Object.values(photoEdits).forEach((edit) => { if ('previewUrl' in edit) URL.revokeObjectURL(edit.previewUrl); });
  }, [photoEdits]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [requests, leaseRows] = await Promise.all([fetchAll<MaintenanceItem>('/maintenance-requests'), tenant ? fetchAll<Lease>('/leases') : Promise.resolve([] as Lease[])]);
      setItems(requests); setLeases(leaseRows);
      setLeaseId((current) => current || String(leaseRows.find((lease) => lease.status === 'active')?.id || ''));
    } catch (err: any) { setError(err.message || 'Could not load maintenance requests.'); }
    finally { setLoading(false); }
  }, [tenant]);
  useEffect(() => { void load(); }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!leaseId) return;
    setSaving(true);
    try {
      const form = new FormData(); form.append('lease_id', leaseId); form.append('title', title.trim()); form.append('description', description.trim());
      if (photo) form.append('photo', photo);
      await api('/maintenance-requests', { method: 'POST', body: form });
      setTitle(''); setDescription(''); setPhoto(null); announce('Maintenance request submitted.'); await load();
    } catch (err: any) { announce(err.message || 'Could not submit the request.', 'error'); }
    finally { setSaving(false); }
  };
  const openPhotoPicker = (target: 'new' | number) => {
    photoTargetRef.current = target;
    photoInputRef.current?.click();
  };
  const selectPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedName = /\.(jpe?g|png|webp)$/i.test(file.name);
    if ((!allowedMime.includes(file.type) && !(file.type === '' && allowedName)) || !allowedName) {
      const message = 'Choose a JPG, PNG, or WebP image.';
      if (photoTargetRef.current === 'new') setPhotoError(message);
      else setPhotoEditErrors((current) => ({ ...current, [photoTargetRef.current as number]: message }));
      announce('Choose a JPG, PNG, or WebP image.', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      const message = 'Photo must be 4 MB or smaller.';
      if (photoTargetRef.current === 'new') setPhotoError(message);
      else setPhotoEditErrors((current) => ({ ...current, [photoTargetRef.current as number]: message }));
      announce('Photo must be 4 MB or smaller.', 'error');
      return;
    }
    const target = photoTargetRef.current;
    if (target === 'new') { setPhotoError(''); setPhoto(file); }
    else {
      setPhotoEditErrors((current) => { const next = { ...current }; delete next[target]; return next; });
      const previous = photoEdits[target];
      if (previous && 'previewUrl' in previous) URL.revokeObjectURL(previous.previewUrl);
      setPhotoEdits((current) => ({ ...current, [target]: { file, previewUrl: URL.createObjectURL(file) } }));
    }
  };
  const clearNewPhoto = () => { setPhoto(null); setPhotoError(''); };
  const savePhotoEdit = async (item: MaintenanceItem) => {
    const edit = photoEdits[item.id];
    if (!edit) return;
    setSavingPhotoId(item.id);
    try {
      const form = new FormData();
      if ('file' in edit) form.append('photo', edit.file);
      else form.append('remove_photo', '1');
      form.append('_method', 'PATCH');
      await api(`/maintenance-requests/${item.id}`, { method: 'POST', body: form });
      if ('previewUrl' in edit) URL.revokeObjectURL(edit.previewUrl);
      setPhotoEdits((current) => { const next = { ...current }; delete next[item.id]; return next; });
      announce('Maintenance photo updated.');
      await load();
    } catch (err: any) { announce(err.message || 'Could not update the maintenance photo.', 'error'); }
    finally { setSavingPhotoId(null); }
  };
  const changeStatus = async (item: MaintenanceItem, status: MaintenanceItem['status']) => {
    try { await api(`/maintenance-requests/${item.id}`, { method: 'PATCH', body: { status } }); announce('Request status updated.'); await load(); }
    catch (err: any) { announce(err.message || 'Could not update request.', 'error'); }
  };

  return <div className="feature-page">
    <div className="welcome-block"><div><h2>{tenant ? 'Maintenance requests' : 'Property maintenance'}</h2><p className="muted">{tenant ? 'Report an issue and follow its progress.' : 'Review maintenance issues for your leased rooms.'}</p></div></div>
    {tenant && <Panel title="Report a problem" description="Share enough detail to help your landlord respond."><form className="form-grid" onSubmit={submit}>
      <Field label="Rental / room" required><select value={leaseId} onChange={(event) => setLeaseId(event.target.value)} required><option value="">Choose your rental</option>{leases.filter((lease) => lease.status === 'active').map((lease) => <option key={lease.id} value={lease.id}>Room {lease.room?.room_number} · {lease.room?.title}</option>)}</select></Field>
      <Field label="Issue" required><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required placeholder="e.g. Leaking kitchen sink" /></Field>
      <Field label="Description" required><textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} required placeholder="Describe what happened and where." /></Field>
      <Field label="Photo (optional)" hint="JPG, PNG, or WebP, up to 4 MB" error={photoError}>
        <div className="maintenance-photo-picker">
          <input ref={photoInputRef} className="maintenance-file-input" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={selectPhoto} aria-label="Choose a maintenance photo" />
          <button type="button" className="button secondary sm" onClick={() => openPhotoPicker('new')}>{photo ? 'Replace Photo' : 'Choose Photo'}</button>
          {photo && <button type="button" className="button secondary sm" onClick={clearNewPhoto}>Remove</button>}
        </div>
        {photo && <span className="maintenance-file-name">{photo.name}</span>}
        {photoPreview && <img className="maintenance-preview" src={photoPreview} alt={`Selected photo preview: ${photo?.name || 'maintenance photo'}`} />}
      </Field>
      <div className="form-actions"><button className="button primary" disabled={saving || !leases.length}>{saving ? 'Submitting…' : 'Submit request'}</button></div>
      {!leases.some((lease) => lease.status === 'active') && !loading && <p className="muted">An active lease is required to submit a maintenance request.</p>}
    </form></Panel>}
    <Panel className="spaced-panel" title={tenant ? 'Your requests' : 'Requests'} description="Status updates are shared with the tenant.">
      {loading ? <LoadingState /> : error ? <ErrorState error={error} retry={() => void load()} /> : items.length ? <div className="maintenance-list">{items.map((item) => <article className="maintenance-card" key={item.id}>
        <div className="maintenance-card-head"><div><h3>{item.title}</h3><p className="muted">Room {item.lease?.room?.room_number} · {item.lease?.room?.title}{!tenant && item.tenant?.name ? ` · ${item.tenant.name}` : ''}</p></div><StatusBadge status={item.status} /></div>
        <p>{item.description}</p>
        {(() => {
          const edit = photoEdits[item.id];
          const savedPhotoVisible = Boolean(item.photo_url) && !(edit && 'remove' in edit);
          const displayedUrl = edit && 'previewUrl' in edit ? edit.previewUrl : savedPhotoVisible ? item.photo_url : null;
          const displayedName = edit && 'file' in edit ? edit.file.name : item.photo_path?.split('/').pop();
          return <>
            {displayedUrl && <a href={edit ? undefined : item.photo_url || undefined} target={edit ? undefined : '_blank'} rel="noreferrer"><img className="maintenance-photo" src={displayedUrl} alt={`Photo for ${item.title}`} /></a>}
            {displayedName && ((edit && 'file' in edit) || (savedPhotoVisible && !edit)) && <span className="maintenance-file-name">{displayedName}</span>}
            {tenant && item.status === 'pending' && <div className="maintenance-photo-edit">
              <button type="button" className="button secondary sm" onClick={() => openPhotoPicker(item.id)}>{savedPhotoVisible || (edit && 'file' in edit) ? 'Replace Photo' : 'Choose Photo'}</button>
              {(savedPhotoVisible || (edit && 'file' in edit)) && !(edit && 'remove' in edit) && <button type="button" className="button secondary sm" onClick={() => {
                if (edit && 'previewUrl' in edit) URL.revokeObjectURL(edit.previewUrl);
                if (item.photo_url) setPhotoEdits((current) => ({ ...current, [item.id]: { remove: true } }));
                else setPhotoEdits((current) => { const next = { ...current }; delete next[item.id]; return next; });
              }}>Remove</button>}
              {edit && 'remove' in edit && <><span className="muted">Photo will be removed when saved.</span><button type="button" className="button secondary sm" onClick={() => setPhotoEdits((current) => { const next = { ...current }; delete next[item.id]; return next; })}>Undo Remove</button></>}
              {edit && <button type="button" className="button primary sm" disabled={savingPhotoId === item.id} onClick={() => void savePhotoEdit(item)}>{savingPhotoId === item.id ? 'Saving…' : 'Save Photo Changes'}</button>}
              {photoEditErrors[item.id] && <small className="field-error" role="alert">{photoEditErrors[item.id]}</small>}
            </div>}
          </>;
        })()}
        <small className="muted">Submitted {formatBusinessDateTime(item.created_at)}</small>
        {!tenant && <Field label="Request status"><select value={item.status} onChange={(event) => void changeStatus(item, event.target.value as MaintenanceItem['status'])}><option value="pending">Pending</option><option value="in_progress">In Progress</option><option value="resolved">Resolved</option></select></Field>}
      </article>)}</div> : <EmptyState title="No requests yet" message={tenant ? 'Maintenance requests you submit will appear here.' : 'Your tenants have not reported any issues.'} />}
    </Panel>
  </div>;
};
