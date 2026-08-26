'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  FileClock,
  Link2,
  LockKeyhole,
  MessageSquare,
  Pin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import type { EntryDTO, HighlightDTO, SessionUser } from '@/src/core/types';

type CareNote = {
  viewer: SessionUser;
  patient: { id: string; displayName: string; birthYear: number; recordNumber: string; synthetic: boolean; clinicId: string; lastContactAt: string };
  glance: HighlightDTO[];
  timeline: EntryDTO[];
  tasks: Array<{ id: string; title: string; status: string; dueAt?: string; riskLevel: string; assignedToName?: string }>;
};
type Version = { id: string; version: number; content: string; changes?: Array<{ value: string; added: boolean; removed: boolean }>; revertedFromVersion?: number; createdAt: string };
type Provenance = {
  pointer: { entryId: string; versionId: string; version: number; startOffset: number; endOffset: number; sourceArtifactId?: string };
  source: { content: string; exactSpan: string; sessionRef?: string; interactionType?: string };
};

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, number>) { super(message); }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload.error ?? {};
    throw new ApiError(response.status, error.code ?? 'REQUEST_FAILED', error.message ?? 'Request failed.', error.details);
  }
  return payload as T;
}

const userLabels: Record<string, string> = {
  'user-clinician': 'Clinician · Dr Evan Lim',
  'user-staff': 'Staff · Aisha Rahman',
  'user-patient': 'Patient · Maya Tan',
  'user-admin': 'Admin · Sara Chen',
  'user-north-staff': 'North clinic staff · scope test',
};
const prettyType = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'No due date';
const canEdit = (viewer: SessionUser, entry: EntryDTO) => viewer.role === entry.authorRole && entry.authorName === viewer.displayName;

export function CareNoteApp() {
  const [note, setNote] = useState<CareNote | null>(null);
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<EntryDTO | null>(null);
  const [draft, setDraft] = useState('');
  const [history, setHistory] = useState<{ entry: EntryDTO; versions: Version[] } | null>(null);
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [showScribe, setShowScribe] = useState(false);
  const [scribeText, setScribeText] = useState('Maya Tan S1234567D called from +65 9123 4567 and reports worsening nightly cough.');
  const [conflict, setConflict] = useState<{ client: string; server: string; clientVersion?: number; serverVersion?: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const session = await api<{ viewer: SessionUser | null; users: SessionUser[] }>('/api/session');
      setUsers(session.users);
      if (!session.viewer) {
        await api('/api/session', { method: 'POST', body: JSON.stringify({ userId: 'user-clinician' }) });
        setSelectedUserId('user-clinician');
      } else setSelectedUserId(session.viewer.id);
      const careNote = await api<CareNote>('/api/patients/patient-maya/care-note');
      setNote(careNote);
      setError('');
    } catch (requestError) {
      const nextError = requestError as ApiError;
      setError(nextError.status === 404 ? 'This demo role cannot see Maya’s record. The 404 intentionally hides cross-clinic objects.' : nextError.message);
      setNote(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // Initial data fetching is the effect's external synchronization boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  const patientId = note?.patient.id;
  useEffect(() => {
    if (!patientId) return;
    const source = new EventSource(`/api/events?patientId=${patientId}`);
    const refresh = () => { void load(); };
    ['entry.created', 'entry.updated', 'entry.reverted', 'comment.created', 'comment.updated', 'highlight.feedback', 'task.updated', 'scribe.ingested'].forEach((name) => source.addEventListener(name, refresh));
    return () => source.close();
  }, [patientId, load]);

  const switchRole = async (userId: string) => {
    setLoading(true);
    setMessage('');
    setSelectedUserId(userId);
    await api('/api/session', { method: 'POST', body: JSON.stringify({ userId }) });
    await load();
  };
  const mutate = async (label: string, operation: () => Promise<unknown>, success: string) => {
    setBusy(label); setMessage(''); setError('');
    try { await operation(); setMessage(success); await load(); return true; }
    catch (requestError) { setError((requestError as ApiError).message); return false; }
    finally { setBusy(''); }
  };
  const saveEdit = async () => {
    if (!editing) return;
    setBusy(`edit-${editing.id}`);
    try {
      await api(`/api/entries/${editing.id}`, { method: 'PATCH', body: JSON.stringify({ baseVersion: editing.version, content: draft }) });
      setEditing(null); setMessage('New immutable version saved.'); await load();
    } catch (requestError) {
      const apiError = requestError as ApiError;
      if (apiError.code === 'VERSION_CONFLICT') {
        const versions = await api<{ versions: Version[] }>(`/api/entries/${editing.id}/versions`);
        setConflict({ client: draft, server: versions.versions[0]?.content ?? '', clientVersion: apiError.details?.clientVersion, serverVersion: apiError.details?.serverVersion });
      } else setError(apiError.message);
    } finally { setBusy(''); }
  };
  const createNote = async () => {
    if (!note) return;
    const type = note.viewer.role === 'staff' ? 'staff_note' : note.viewer.role === 'patient' ? 'patient_insight' : 'clinician_note';
    const section = note.viewer.role === 'staff' ? 'coordination' : note.viewer.role === 'patient' ? 'patient_context' : 'assessment_plan';
    const ok = await mutate('create-note', () => api(`/api/patients/${note.patient.id}/entries`, { method: 'POST', body: JSON.stringify({ type, section, content: newContent }) }), 'Care note added with a traceable first version.');
    if (ok) { setShowAdd(false); setNewContent(''); }
  };
  const openHistory = async (entry: EntryDTO) => setHistory({ entry, versions: (await api<{ versions: Version[] }>(`/api/entries/${entry.id}/versions`)).versions });
  const showSource = async (highlightId: string) => setProvenance(await api<Provenance>(`/api/provenance/${highlightId}`));

  const topCount = note?.glance.length ?? 0;
  const openTasks = note?.tasks.filter((task) => task.status === 'open').length ?? 0;
  const canCollaborate = note ? ['staff', 'clinician'].includes(note.viewer.role) : false;
  const canAdd = note ? ['staff', 'clinician', 'patient'].includes(note.viewer.role) : false;
  const age = note ? new Date().getFullYear() - note.patient.birthYear : 0;

  return (
    <main className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <div className="border-b border-white/10 bg-[var(--navy)] text-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--mint)] text-sm font-black text-[var(--navy)]">N</div><div><p className="text-sm font-semibold tracking-tight">Nightingale</p><p className="text-[11px] text-slate-300">Shared Care Note</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1.5 text-[11px] font-bold tracking-wide text-emerald-100">SYNTHETIC DATA</span><label className="relative flex items-center"><select aria-label="Demo role" className="appearance-none rounded-full border border-white/15 bg-white/10 py-1.5 pl-3 pr-8 text-xs font-medium text-slate-100 outline-none" value={selectedUserId} onChange={(event) => void switchRole(event.target.value)}>{users.map((user) => <option className="text-slate-900" value={user.id} key={user.id}>{userLabels[user.id] ?? user.displayName}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5" /></label></div>
        </div>
      </div>

      {loading ? <LoadingState /> : error && !note ? <ScopeError message={error} /> : note ? (
        <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
          {(message || error) && <div className={`mb-5 flex items-start justify-between rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><span>{error || message}</span><button aria-label="Dismiss notification" onClick={() => { setError(''); setMessage(''); }}><X className="h-4 w-4" /></button></div>}
          <header className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div><div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"><span>Patient record</span><span className="h-1 w-1 rounded-full bg-[var(--muted)]" /><span>{note.patient.clinicId === 'clinic-central' ? 'Central Clinic' : 'North Clinic'}</span><span className="h-1 w-1 rounded-full bg-[var(--muted)]" /><span>{note.patient.recordNumber}</span></div><h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{note.patient.displayName}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{age} years · Asthma review · Last contact {formatDate(note.patient.lastContactAt)}</p></div>
            <div className="flex flex-wrap gap-2">{canCollaborate && <button className="secondary-button" onClick={() => setShowScribe(true)}><Bot className="h-4 w-4" />Mock scribe</button>}{canAdd && <button className="primary-button" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" />Add care note</button>}</div>
          </header>

          {note.viewer.role === 'patient' ? <PatientSummary note={note} /> : <>
            <section className="glance-shell mb-7 overflow-hidden rounded-[24px] border border-[var(--line)] bg-white shadow-[0_18px_50px_rgba(16,35,51,0.08)]">
              <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] bg-[linear-gradient(105deg,#102638_0%,#18394c_58%,#1e4e56_100%)] px-5 py-5 text-white sm:flex-row sm:items-center lg:px-7"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Consult glance · 10-second view</p><h2 className="mt-1 text-xl font-semibold tracking-tight">What needs attention now</h2></div><div className="flex items-center gap-2 text-xs text-slate-200"><span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.14)]" />Top {topCount} explainable signals</div></div>
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3 lg:p-5">{note.glance.map((item) => <GlanceCard key={item.id} item={item} canFeedback={canCollaborate} busy={busy} onSource={() => void showSource(item.id)} onFeedback={(action) => void mutate(`highlight-${item.id}`, () => api(`/api/highlights/${item.id}/feedback`, { method: 'POST', body: JSON.stringify({ action }) }), `Feedback applied. Similar “${item.featureKey}” signals were re-scored.`)} />)}</div>
            </section>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section><div className="mb-4 flex items-end justify-between"><div><p className="section-kicker">Longitudinal timeline</p><h2 className="text-xl font-semibold tracking-tight">Patient story</h2></div><span className="text-xs font-semibold text-[var(--muted)]">{note.timeline.length} traceable entries</span></div><div className="space-y-3">{note.timeline.map((entry) => <TimelineEntry key={entry.id} entry={entry} viewer={note.viewer} busy={busy} onEdit={() => { setEditing(entry); setDraft(entry.content); }} onHistory={() => void openHistory(entry)} onComment={() => setCommentFor(entry.id)} onResolveComment={(id, status) => void mutate(`comment-${id}`, () => api(`/api/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }), `Comment marked ${status}.`)} />)}</div></section>
              <aside className="space-y-5"><section className="side-card"><div className="flex items-center justify-between"><div><p className="section-kicker">Open actions</p><h2 className="text-lg font-semibold">Care coordination</h2></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{openTasks} open</span></div><div className="mt-4 space-y-3">{note.tasks.map((task) => <label className="task-row" key={task.id}><input type="checkbox" checked={task.status === 'done'} disabled={!canCollaborate || busy === `task-${task.id}`} onChange={() => void mutate(`task-${task.id}`, () => api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: task.status === 'done' ? 'open' : 'done' }) }), 'Task status updated.')} /><span><strong className={task.status === 'done' ? 'line-through opacity-60' : ''}>{task.title}</strong><small>{task.assignedToName ?? 'Unassigned'} · {formatDate(task.dueAt)}</small></span></label>)}</div></section><section className="side-card border-l-4 border-l-[var(--mint-strong)]"><p className="section-kicker">Trust signal</p><h2 className="text-lg font-semibold">Every insight is traceable</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Highlights preserve the exact source entry, immutable version and text span. AI suggestions never overwrite clinician or staff notes.</p><div className="mt-4 flex items-center gap-2 text-xs font-bold text-[var(--link)]"><ShieldCheck className="h-4 w-4" />AES-256-GCM · clinic-scoped RBAC</div></section></aside>
            </div>
          </>}
        </div>
      ) : null}

      {showAdd && note && <Modal title="Add role-owned care note" onClose={() => setShowAdd(false)}><p className="modal-help">This creates a new {note.viewer.role} section. It cannot overwrite another role’s note.</p><textarea autoFocus value={newContent} onChange={(event) => setNewContent(event.target.value)} placeholder="Add a concise, clinically useful update…" /><div className="modal-actions"><button className="secondary-button" onClick={() => setShowAdd(false)}>Cancel</button><button className="primary-button" disabled={!newContent.trim() || busy === 'create-note'} onClick={() => void createNote()}>{busy === 'create-note' ? 'Saving…' : 'Create version 1'}</button></div></Modal>}
      {editing && <Modal title={`Edit ${prettyType(editing.section)} · v${editing.version}`} onClose={() => setEditing(null)}><p className="modal-help">Optimistic locking will reject this save if another browser changed the same entry.</p><textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} /><div className="modal-actions"><button className="secondary-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" disabled={!draft.trim() || Boolean(busy)} onClick={() => void saveEdit()}>{busy ? 'Checking version…' : 'Save new version'}</button></div></Modal>}
      {history && note && <Modal title={`Immutable history · ${prettyType(history.entry.section)}`} onClose={() => setHistory(null)}><div className="version-list">{history.versions.map((version) => <article key={version.id}><div><strong>Version {version.version}</strong><span>{formatDate(version.createdAt)}{version.revertedFromVersion ? ` · reverted from v${version.revertedFromVersion}` : ''}</span></div>{version.changes?.length ? <p className="version-diff" aria-label={`Changes in version ${version.version}`}>{version.changes.map((change, index) => <span className={change.added ? 'added' : change.removed ? 'removed' : ''} key={`${index}-${change.value}`}>{change.value}</span>)}</p> : <p>{version.content}</p>}{canEdit(note.viewer, history.entry) && version.version !== history.entry.version && <button onClick={() => void mutate(`revert-${version.version}`, () => api(`/api/entries/${history.entry.id}/revert`, { method: 'POST', body: JSON.stringify({ version: version.version, baseVersion: history.entry.version }) }), `Version ${version.version} restored as a new version.`).then((ok) => { if (ok) setHistory(null); })}>Revert by creating a new version</button>}</article>)}</div></Modal>}
      {provenance && <Modal title="Verified provenance pointer" onClose={() => setProvenance(null)}><div className="provenance-meta"><span>Entry {provenance.pointer.entryId}</span><span>Version {provenance.pointer.version}</span><span>Span {provenance.pointer.startOffset}–{provenance.pointer.endOffset}</span>{provenance.source.sessionRef && <span>Session {provenance.source.sessionRef}</span>}</div><p className="source-copy">{provenance.source.content}</p><div className="exact-span"><strong>Exact referenced span</strong><p>{provenance.source.exactSpan || 'The stored offsets resolve to an empty span.'}</p></div><div className="modal-actions"><button className="primary-button" onClick={() => { const entryId = provenance.pointer.entryId; setProvenance(null); requestAnimationFrame(() => document.getElementById(`entry-${entryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })); }}><Link2 className="h-4 w-4" />Jump to timeline entry</button></div></Modal>}
      {commentFor && <Modal title="Add threaded comment" onClose={() => setCommentFor(null)}><p className="modal-help">Internal collaboration only. The patient-facing response never contains this field.</p><textarea autoFocus value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Use @mention context and a clear next action…" /><div className="modal-actions"><button className="secondary-button" onClick={() => setCommentFor(null)}>Cancel</button><button className="primary-button" disabled={!comment.trim() || Boolean(busy)} onClick={() => void mutate('add-comment', () => api(`/api/entries/${commentFor}/comments`, { method: 'POST', body: JSON.stringify({ body: comment, assignedToId: note?.viewer.role === 'staff' ? 'user-clinician' : 'user-staff' }) }), 'Thread comment added and assigned.').then((ok) => { if (ok) { setCommentFor(null); setComment(''); } })}>Comment & assign</button></div></Modal>}
      {showScribe && note && <Modal title="Deterministic MockScribe ingest" onClose={() => setShowScribe(false)}><p className="modal-help">No network or LLM key is used. Names, Singapore IDs and phone numbers are redacted before the provider boundary.</p><textarea value={scribeText} onChange={(event) => setScribeText(event.target.value)} /><div className="modal-actions"><button className="secondary-button" onClick={() => setShowScribe(false)}>Cancel</button><button className="primary-button" disabled={!scribeText.trim() || Boolean(busy)} onClick={() => void mutate('scribe', () => api('/api/dev/scribe-ingest', { method: 'POST', body: JSON.stringify({ patientId: note.patient.id, sessionRef: `demo-${Date.now()}`, interactionType: 'ai_patient', transcript: scribeText }) }), 'Mock scribe entry created. PHI was redacted before provider processing.').then((ok) => { if (ok) setShowScribe(false); })}><Sparkles className="h-4 w-4" />Redact & ingest</button></div></Modal>}
      {conflict && <Modal title="409 · Concurrent edit detected" onClose={() => setConflict(null)}><p className="modal-help">Your draft was preserved. Nothing was overwritten. Compare the two versions before deciding what to keep.</p><div className="conflict-grid"><div><strong>Your draft · base v{conflict.clientVersion}</strong><p>{conflict.client}</p></div><div><strong>Server · current v{conflict.serverVersion}</strong><p>{conflict.server}</p></div></div><div className="modal-actions"><button className="primary-button" onClick={() => { setConflict(null); setEditing(null); void load(); }}>Use server version</button></div></Modal>}
    </main>
  );
}

function LoadingState() { return <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-5 py-20 text-sm text-[var(--muted)] lg:px-8"><RefreshCw className="h-5 w-5 animate-spin" />Opening encrypted synthetic record…</div>; }
function ScopeError({ message }: { message: string }) { return <div className="mx-auto max-w-xl px-5 py-20"><div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-amber-700" /><h1 className="mt-4 text-xl font-semibold">Record unavailable</h1><p className="mt-2 text-sm leading-6 text-amber-900/75">{message}</p><p className="mt-5 text-xs font-semibold text-amber-800">Switch back to a Central Clinic demo role above.</p></div></div>; }
function PatientSummary({ note }: { note: CareNote }) { return <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><section className="side-card"><div className="flex items-center gap-3"><div className="rounded-2xl bg-emerald-100 p-3 text-emerald-800"><UserRound className="h-5 w-5" /></div><div><p className="section-kicker">Your care summary</p><h2 className="text-xl font-semibold">What your care team shared</h2></div></div><div className="mt-5 space-y-3">{note.timeline.map((entry) => <article className="rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-4" key={entry.id}><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{prettyType(entry.type)}</p><p className="mt-2 text-sm leading-6">{entry.content}</p></article>)}</div></section><section className="side-card h-fit"><ShieldCheck className="h-6 w-6 text-[var(--mint-strong)]" /><h2 className="mt-3 text-lg font-semibold">Private by construction</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">This API response contains only patient-facing instructions. Internal notes, raw AI summaries, comments, tasks and audit data are excluded on the server.</p></section></div>; }

function GlanceCard({ item, canFeedback, busy, onSource, onFeedback }: { item: HighlightDTO; canFeedback: boolean; busy: string; onSource: () => void; onFeedback: (action: string) => void }) {
  const tone = item.riskLevel === 'critical' || item.riskLevel === 'high' ? 'critical' : item.kind === 'task' ? 'action' : 'context';
  return <article className={`glance-card ${tone}`}><div className="mb-3 flex items-center justify-between gap-3"><span className="eyebrow">{item.kind === 'task' ? 'Open action' : item.riskLevel === 'critical' ? 'Critical risk' : 'What changed'}</span><span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-bold text-[var(--muted)]">{Math.round(item.score)} pts</span></div><h3 className="text-[15px] font-semibold leading-6 tracking-[-0.012em]">{item.summary}</h3><p className="mt-3 text-xs leading-5 text-[var(--muted)]">{item.riskReason}</p><button className="mt-4 flex items-center gap-1.5 text-xs font-bold text-[var(--link)]" onClick={onSource}><Link2 className="h-3.5 w-3.5" />Verify source · v{item.provenance.version}</button>{canFeedback && <div className="mt-4 flex flex-wrap gap-2 border-t border-black/5 pt-3"><button className="chip-button" disabled={busy === `highlight-${item.id}`} onClick={() => onFeedback('accept')}><Check className="h-3 w-3" />Accept</button><button className="chip-button" disabled={busy === `highlight-${item.id}`} onClick={() => onFeedback('pin')}><Pin className="h-3 w-3" />Pin</button><button className="chip-button danger" disabled={busy === `highlight-${item.id}`} onClick={() => onFeedback('reject')}><X className="h-3 w-3" />Reject</button></div>}</article>;
}

function TimelineEntry({ entry, viewer, busy, onEdit, onHistory, onComment, onResolveComment }: { entry: EntryDTO; viewer: SessionUser; busy: string; onEdit: () => void; onHistory: () => void; onComment: () => void; onResolveComment: (id: string, status: string) => void }) {
  const accent = entry.authorRole === 'system' ? 'system' : entry.authorRole;
  return <article id={`entry-${entry.id}`} className="timeline-card scroll-mt-5"><div className={`timeline-mark ${accent}`} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">{entry.authorRole === 'system' ? <Bot className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}{entry.authorName} · {prettyType(entry.type)}</p><time className="text-xs text-[var(--muted)]">{formatDate(entry.updatedAt)}</time></div><div className="mt-2 flex flex-wrap items-center gap-2"><h3 className="font-semibold">{prettyType(entry.section)}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">v{entry.version}</span>{entry.sourceSessionRef && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">AI source preserved</span>}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--muted)]">{entry.content}</p><div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-[var(--link)]">{canEdit(viewer, entry) && <button disabled={Boolean(busy)} onClick={onEdit}>Edit owned section</button>}<button onClick={onHistory} className="flex items-center gap-1"><FileClock className="h-3.5 w-3.5" />Version history</button>{['staff', 'clinician'].includes(viewer.role) && <button onClick={onComment} className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />Comment</button>}</div>{entry.comments?.length ? <div className="mt-4 space-y-2 border-t border-[var(--line)] pt-4">{entry.comments.map((item) => <div className="rounded-xl bg-slate-50 p-3 text-xs" key={item.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.authorName}{item.assignedToName ? ` → ${item.assignedToName}` : ''}</strong><span className={item.status === 'resolved' ? 'text-emerald-700' : 'text-amber-700'}>{item.status}</span></div><p className="mt-1.5 leading-5 text-[var(--muted)]">{item.body}</p>{['staff', 'clinician'].includes(viewer.role) && <button className="mt-2 font-bold text-[var(--link)]" onClick={() => onResolveComment(item.id, item.status === 'resolved' ? 'open' : 'resolved')}>{item.status === 'resolved' ? 'Reopen' : 'Resolve'}</button>}</div>)}</div> : null}</div></article>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal-card"><div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-5 py-4"><h2 className="font-semibold">{title}</h2><button className="rounded-full p-1 text-[var(--muted)] hover:bg-slate-100" aria-label="Close" onClick={onClose}><X className="h-5 w-5" /></button></div><div className="p-5">{children}</div></section></div>;
}
