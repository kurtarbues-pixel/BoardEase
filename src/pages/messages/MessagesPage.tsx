import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, fetchAll } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Lease } from '../../types';
import { Panel } from '../../components/Common/Panel';
import { Field } from '../../components/Common/Field';
import { LoadingState, EmptyState, ErrorState } from '../../components/Common/States';
import { formatBusinessDateTime } from '../../utils/date';

interface Conversation { id: number; lease_id: number; unread_count: number; lease?: { room?: { room_number: string; title: string } }; tenant?: { id: number; name: string }; landlord?: { id: number; name: string }; }
interface Message { id: number; sender_id: number; body: string; created_at: string; sender?: { name: string }; }
interface Details { conversation: Conversation; messages: Message[]; }
interface Props {
  announce: (message: string, kind?: 'success' | 'error' | 'warning' | 'info') => void;
  initialLeaseId?: number | null;
  onInitialConversationHandled?: () => void;
}

export const MessagesPage: React.FC<Props> = ({ announce, initialLeaseId, onInitialConversationHandled }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [selected, setSelected] = useState<Details | null>(null);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const initialLeaseStarted = useRef<number | null>(null);
  const loadList = useCallback(async () => {
    try {
      const [rows, leaseRows] = await Promise.all([fetchAll<Conversation>('/conversations'), fetchAll<Lease>('/leases')]);
      setConversations(rows); setLeases(leaseRows);
    } catch (err: any) { setError(err.message || 'Could not load conversations.'); }
    finally { setLoading(false); }
  }, []);
  const openConversation = useCallback(async (id: number) => {
    try { const data = await api<Details>(`/conversations/${id}`); setSelected(data); await loadList(); }
    catch (err: any) { setError(err.message || 'Could not load messages.'); }
  }, [loadList]);
  useEffect(() => { void loadList(); const timer = window.setInterval(() => { void loadList(); }, 15000); return () => window.clearInterval(timer); }, [loadList]);
  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(() => { void api<Details>(`/conversations/${selected.conversation.id}`).then(setSelected).catch(() => undefined); }, 8000);
    return () => window.clearInterval(timer);
  }, [selected?.conversation.id]);
  const start = useCallback(async (lease: Lease) => {
    try { const data = await api<Details>(`/leases/${lease.id}/conversation`, { method: 'POST' }); setSelected(data); await loadList(); }
    catch (err: any) { announce(err.message || 'Could not start conversation.', 'error'); }
  }, [announce, loadList]);
  useEffect(() => {
    if (!initialLeaseId || loading || initialLeaseStarted.current === initialLeaseId) return;
    initialLeaseStarted.current = initialLeaseId;
    const lease = leases.find((item) => item.id === initialLeaseId && ['active', 'ended'].includes(item.status));
    if (!lease) {
      if (!error) announce('No landlord conversation is available for that rental. Try opening Messages from your current rental.', 'info');
      onInitialConversationHandled?.();
      return;
    }
    void start(lease).finally(() => onInitialConversationHandled?.());
  }, [initialLeaseId, loading, leases, error, start, onInitialConversationHandled]);
  const sendMessage = async () => {
    if (!selected || !body.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try { await api(`/conversations/${selected.conversation.id}/messages`, { method: 'POST', body: { body: body.trim() } }); setBody(''); await openConversation(selected.conversation.id); }
    catch (err: any) { announce(err.message || 'Message could not be sent.', 'error'); }
    finally { sendingRef.current = false; setSending(false); }
  };
  const submitMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };
  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void sendMessage();
  };
  const otherName = (conversation: Conversation) => user?.role === 'tenant' ? conversation.landlord?.name : conversation.tenant?.name;
  const availableLeases = leases.filter((lease) => ['active', 'ended'].includes(lease.status));
  return <div className="feature-page"><div className="welcome-block"><div><h2>Messages</h2><p className="muted">Private conversations linked to your rental. New messages refresh automatically.</p></div></div>
    {loading ? <LoadingState /> : error ? <ErrorState error={error} retry={() => void loadList()} /> : <div className="messages-layout">
      <Panel title="Conversations" description="Unread counts update automatically.">
        <div className="conversation-list">{conversations.map((conversation) => <button type="button" key={conversation.id} className={`conversation-item ${selected?.conversation.id === conversation.id ? 'selected' : ''}`} onClick={() => void openConversation(conversation.id)}><strong>{otherName(conversation) || 'Rental contact'}</strong><span>Room {conversation.lease?.room?.room_number} · {conversation.lease?.room?.title}</span>{conversation.unread_count > 0 && <b className="unread-count">{conversation.unread_count} unread</b>}</button>)}{!conversations.length && <EmptyState message="Your conversations will appear here." />}</div>
        {availableLeases.length > 0 && <div className="start-conversation"><p className="field-label">Start a conversation</p>{availableLeases.map((lease) => <button type="button" className="button secondary sm" key={lease.id} onClick={() => void start(lease)}>{lease.status === 'active' ? 'Message' : 'Contact'} · Room {lease.room?.room_number}</button>)}</div>}
      </Panel>
      <Panel title={selected ? `${otherName(selected.conversation) || 'Rental conversation'} · Room ${selected.conversation.lease?.room?.room_number}` : 'Message history'} description={selected ? 'Messages are saved to your rental record.' : 'Choose a conversation to view messages.'}>
        {selected ? <><div className="message-history" aria-live="polite">{selected.messages.map((message) => <div key={message.id} className={`message-bubble ${message.sender_id === user?.id ? 'mine' : ''}`}><span>{message.sender?.name || 'BoardEase user'}</span><p>{message.body}</p><small>{formatBusinessDateTime(message.created_at)}</small></div>)}{!selected.messages.length && <EmptyState message="No messages yet. Say hello." />}</div><form className="message-compose" onSubmit={submitMessage}><Field label="Your message"><textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={handleComposerKeyDown} enterKeyHint="send" maxLength={4000} rows={2} required placeholder="Write a message…" /></Field><button type="submit" className="button primary" disabled={sending || !body.trim()}>{sending ? 'Sending…' : 'Send'}</button></form></> : <EmptyState message="Start or select a conversation to get in touch." />}
      </Panel>
    </div>}</div>;
};
