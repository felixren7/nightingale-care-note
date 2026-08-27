'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Activity,
  Bot,
  Check,
  ChevronDown,
  ClipboardList,
  FileClock,
  FileText,
  HeartPulse,
  Link2,
  LockKeyhole,
  MessageSquare,
  Pin,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import type { EntryDTO, HighlightDTO, SessionUser } from '@/src/core/types';

type CareTask = {
  id: string;
  title: string;
  status: string;
  dueAt?: string;
  riskLevel: string;
  assignedToName?: string;
};

type CareNote = {
  viewer: SessionUser;
  patient: {
    id: string;
    displayName: string;
    birthYear: number;
    recordNumber: string;
    synthetic: boolean;
    clinicId: string;
    lastContactAt: string;
  };
  glance: HighlightDTO[];
  timeline: EntryDTO[];
  tasks: CareTask[];
};

type Version = {
  id: string;
  version: number;
  content: string;
  changes?: Array<{ value: string; added: boolean; removed: boolean }>;
  revertedFromVersion?: number;
  createdAt: string;
};

type Provenance = {
  pointer: {
    entryId: string;
    versionId: string;
    version: number;
    startOffset: number;
    endOffset: number;
    sourceArtifactId?: string;
  };
  source: { content: string; exactSpan: string; sessionRef?: string; interactionType?: string };
};

type TimelineView = 'care' | 'timeline' | 'tasks' | 'history' | 'comments';
type ScribeInteraction = 'doctor_patient' | 'nurse_patient' | 'ai_patient';
type ConnectionState = 'connecting' | 'live' | 'reconnecting';

type AuditEvent = {
  id: string;
  patientId?: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  fromVersion?: number;
  toVersion?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
};

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, number>,
  ) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload.error ?? {};
    throw new ApiError(
      response.status,
      error.code ?? 'REQUEST_FAILED',
      error.message ?? 'Request failed.',
      error.details,
    );
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

const prettyType = (value: string) =>
  value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat('en-SG', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : 'No due date';

const canEdit = (viewer: SessionUser, entry: EntryDTO) =>
  viewer.role === entry.authorRole && entry.authorName === viewer.displayName;

export function CareNoteApp() {
  const [note, setNote] = useState<CareNote | null>(null);
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedHighlightId, setSelectedHighlightId] = useState('');
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
  const [scribeInteraction, setScribeInteraction] = useState<ScribeInteraction>('ai_patient');
  const [scribeText, setScribeText] = useState(
    'Maya Tan S1234567D called from +65 9123 4567 and reports worsening nightly cough.',
  );
  const [activeView, setActiveView] = useState<TimelineView>('care');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [lastRejected, setLastRejected] = useState<{ id: string; summary: string } | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [conflict, setConflict] = useState<{
    client: string;
    server: string;
    clientVersion?: number;
    serverVersion?: number;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const session = await api<{ viewer: SessionUser | null; users: SessionUser[] }>('/api/session');
      setUsers(session.users);
      if (!session.viewer) {
        await api('/api/session', {
          method: 'POST',
          body: JSON.stringify({ userId: 'user-clinician' }),
        });
        setSelectedUserId('user-clinician');
      } else {
        setSelectedUserId(session.viewer.id);
      }
      const careNote = await api<CareNote>('/api/patients/patient-maya/care-note');
      setNote(careNote);
      setSelectedHighlightId((current) =>
        careNote.glance.some((item) => item.id === current) ? current : (careNote.glance[0]?.id ?? ''),
      );
      setError('');
    } catch (requestError) {
      const nextError = requestError as ApiError;
      setError(
        nextError.status === 404
          ? 'This demo role cannot see Maya’s record. The 404 intentionally hides cross-clinic objects.'
          : nextError.message,
      );
      setNote(null);
    } finally {
      setLoading(false);
    }
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
    const refresh = () => {
      void load();
    };
    [
      'entry.created',
      'entry.updated',
      'entry.reverted',
      'comment.created',
      'comment.updated',
      'highlight.feedback',
      'task.updated',
      'scribe.ingested',
    ].forEach((name) => source.addEventListener(name, refresh));
    source.onopen = () => setConnectionState('live');
    source.onerror = () => setConnectionState('reconnecting');
    return () => {
      source.onopen = null;
      source.onerror = null;
      source.close();
    };
  }, [patientId, load]);

  const switchRole = async (userId: string) => {
    setLoading(true);
    setMessage('');
    setLastRejected(null);
    setActiveView('care');
    setConnectionState('connecting');
    setShowAudit(false);
    setSelectedUserId(userId);
    await api('/api/session', { method: 'POST', body: JSON.stringify({ userId }) });
    await load();
  };

  const mutate = async (label: string, operation: () => Promise<unknown>, success: string) => {
    setBusy(label);
    setMessage('');
    setError('');
    setLastRejected(null);
    try {
      await operation();
      setMessage(success);
      await load();
      return true;
    } catch (requestError) {
      setError((requestError as ApiError).message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(`edit-${editing.id}`);
    try {
      await api(`/api/entries/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ baseVersion: editing.version, content: draft }),
      });
      setEditing(null);
      setMessage('New immutable version saved.');
      await load();
    } catch (requestError) {
      const apiError = requestError as ApiError;
      if (apiError.code === 'VERSION_CONFLICT') {
        const versions = await api<{ versions: Version[] }>(`/api/entries/${editing.id}/versions`);
        setConflict({
          client: draft,
          server: versions.versions[0]?.content ?? '',
          clientVersion: apiError.details?.clientVersion,
          serverVersion: apiError.details?.serverVersion,
        });
        setEditing(null);
      } else {
        setError(apiError.message);
      }
    } finally {
      setBusy('');
    }
  };

  const createNote = async () => {
    if (!note) return;
    const type =
      note.viewer.role === 'staff'
        ? 'staff_note'
        : note.viewer.role === 'patient'
          ? 'patient_insight'
          : 'clinician_note';
    const section =
      note.viewer.role === 'staff'
        ? 'coordination'
        : note.viewer.role === 'patient'
          ? 'patient_context'
          : 'assessment_plan';
    const ok = await mutate(
      'create-note',
      () =>
        api(`/api/patients/${note.patient.id}/entries`, {
          method: 'POST',
          body: JSON.stringify({ type, section, content: newContent }),
        }),
      'Care note added with a traceable first version.',
    );
    if (ok) {
      setShowAdd(false);
      setNewContent('');
    }
  };

  const openHistory = async (entry: EntryDTO) =>
    setHistory({
      entry,
      versions: (await api<{ versions: Version[] }>(`/api/entries/${entry.id}/versions`)).versions,
    });

  const showSource = async (highlightId: string) =>
    setProvenance(await api<Provenance>(`/api/provenance/${highlightId}`));

  const topCount = note?.glance.length ?? 0;
  const openTasks = note?.tasks.filter((task) => task.status === 'open').length ?? 0;
  const canCollaborate = note ? ['staff', 'clinician'].includes(note.viewer.role) : false;
  const canAdd = note ? ['staff', 'clinician', 'patient'].includes(note.viewer.role) : false;
  const age = note ? new Date().getFullYear() - note.patient.birthYear : 0;
  const selectedHighlight = note?.glance.find((item) => item.id === selectedHighlightId) ?? note?.glance[0];

  const feedbackFor = async (item: HighlightDTO, action: string) => {
    const ok = await mutate(
      `highlight-${item.id}`,
      () =>
        api(`/api/highlights/${item.id}/feedback`, {
          method: 'POST',
          body: JSON.stringify({ action }),
        }),
      action === 'reject'
        ? `“${item.summary}” was rejected and removed from Glance.`
        : `Feedback applied. Similar “${item.featureKey}” signals were re-scored.`,
    );
    if (ok && action === 'reject') setLastRejected({ id: item.id, summary: item.summary });
  };

  const undoReject = async () => {
    if (!lastRejected) return;
    const rejected = lastRejected;
    const ok = await mutate(
      `highlight-${rejected.id}`,
      () => api(`/api/highlights/${rejected.id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ action: 'undo_reject' }),
      }),
      `“${rejected.summary}” was restored to Glance and its score was reversed.`,
    );
    if (ok) setLastRejected(null);
  };

  const navigateTo = (view: TimelineView, href: string) => {
    setActiveView(view);
    requestAnimationFrame(() => document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const openAuditTrail = async () => {
    if (!note) return;
    setShowAudit(true);
    setAuditLoading(true);
    setAuditError('');
    try {
      const result = await api<{ events: AuditEvent[] }>(`/api/audit?patientId=${note.patient.id}`);
      setAuditEvents(result.events);
    } catch (requestError) {
      setAuditError((requestError as ApiError).message);
    } finally {
      setAuditLoading(false);
    }
  };

  const resetDemo = async () => {
    setBusy('reset-demo');
    setError('');
    setMessage('');
    try {
      await api('/api/dev/reset', { method: 'POST' });
      setShowReset(false);
      await load();
      setMessage('Synthetic demo data reset to the clean seed. You are back in the clinician role.');
    } catch (requestError) {
      setError((requestError as ApiError).message);
    } finally {
      setBusy('');
    }
  };

  const timelineEntries = note?.timeline.filter((entry) =>
    activeView === 'history'
      ? entry.version > 1
      : activeView === 'comments'
        ? Boolean(entry.comments?.length)
        : true,
  ) ?? [];
  const timelineTitle = activeView === 'history' ? 'Entry history' : activeView === 'comments' ? 'Comment threads' : 'Patient story';

  return (
    <main className="clinical-app">
      <a className="skip-link" href="#patient-workspace">Skip to patient workspace</a>
      <div className="clinical-shell">
        <ClinicalSidebar
          viewer={note?.viewer}
          topCount={topCount}
          openTasks={openTasks}
          activeView={activeView}
          onNavigate={navigateTo}
        />
        <div className="clinical-workspace">
          <header className="app-bar">
            <div className="app-bar-title">
              <span className="mobile-brand">N</span>
              <div><strong>Nightingale</strong><span>Shared Care Note</span></div>
            </div>
            <div className="app-bar-controls">
              <span className="sync-status" aria-live="polite">
                <RefreshCw className={loading || connectionState !== 'live' ? 'is-spinning' : ''} aria-hidden="true" />
                {loading
                  ? 'Opening encrypted record'
                  : connectionState === 'live'
                    ? 'Live clinical workspace'
                    : connectionState === 'reconnecting'
                      ? 'Reconnecting live updates…'
                      : 'Connecting live updates…'}
              </span>
              <span className="synthetic-badge">Synthetic data</span>
              <label className="role-selector">
                <UserRound aria-hidden="true" />
                <span className="sr-only">Demo role</span>
                <select aria-label="Demo role" value={selectedUserId} onChange={(event) => void switchRole(event.target.value)}>
                  {users.map((user) => <option value={user.id} key={user.id}>{userLabels[user.id] ?? user.displayName}</option>)}
                </select>
                <ChevronDown aria-hidden="true" />
              </label>
            </div>
          </header>

          {loading ? <LoadingState /> : error && !note ? <ScopeError message={error} /> : note ? (
            <div className="record-workspace" id="patient-workspace">
              {(message || error) && (
                <div className={`notice ${error ? 'notice-error' : 'notice-success'}`} role="status" aria-live="polite">
                  <span>{error || message}</span>
                  <div className="notice-actions">
                    {lastRejected && !error && <button className="notice-undo" disabled={busy === `highlight-${lastRejected.id}`} onClick={() => void undoReject()}>Undo reject</button>}
                    <button aria-label="Dismiss notification" onClick={() => { setError(''); setMessage(''); setLastRejected(null); }}><X aria-hidden="true" /></button>
                  </div>
                </div>
              )}

              <section className="patient-strip" aria-labelledby="patient-name">
                <div className="patient-identity">
                  <div className="patient-avatar" aria-hidden="true">{note.patient.displayName.split(' ').map((part) => part[0]).join('')}</div>
                  <div>
                    <p className="record-overline">Patient record · {note.patient.clinicId === 'clinic-central' ? 'Central Clinic' : 'North Clinic'}</p>
                    <h1 id="patient-name">{note.patient.displayName}</h1>
                    <p>{note.patient.recordNumber} · {age} years · Asthma review</p>
                  </div>
                </div>
                <div className="encounter-meta">
                  <div><span>Last contact</span><strong>{formatDate(note.patient.lastContactAt)}</strong></div>
                  <div><span>Access</span><strong>{prettyType(note.viewer.role)} · scoped</strong></div>
                </div>
                <div className="patient-actions">
                  {canCollaborate && <button className="secondary-button" onClick={() => setShowScribe(true)}><Bot aria-hidden="true" />Mock scribe</button>}
                  {note.viewer.role === 'admin' && <button className="secondary-button" onClick={() => void openAuditTrail()}><FileClock aria-hidden="true" />Audit trail</button>}
                  {note.viewer.role === 'admin' && process.env.NODE_ENV !== 'production' && <button className="secondary-button" onClick={() => setShowReset(true)}><RefreshCw aria-hidden="true" />Reset demo</button>}
                  {canAdd && <button className="primary-button" onClick={() => setShowAdd(true)}><Plus aria-hidden="true" />{note.viewer.role === 'patient' ? 'Share an update' : 'Add care note'}</button>}
                </div>
              </section>

              {note.viewer.role === 'patient' ? <PatientSummary note={note} /> : (
                <div className="care-layout">
                  <div className="care-primary">
                    <section className="glance-panel" id="glance" aria-labelledby="glance-title">
                      <div className="panel-heading">
                        <div><p className="section-kicker">Consult glance · 10-second view</p><h2 id="glance-title">What needs attention now</h2></div>
                        <div className="panel-status"><span className="status-dot" />Top {topCount} of 5 explainable signals</div>
                      </div>
                      <div className="glance-list">
                        {note.glance.map((item) => (
                          <GlanceRow key={item.id} item={item} selected={item.id === selectedHighlight?.id} onSelect={() => setSelectedHighlightId(item.id)} onSource={() => void showSource(item.id)} />
                        ))}
                      </div>
                    </section>

                    <section className="timeline-panel" id="timeline" aria-labelledby="timeline-title">
                      <div className="panel-heading timeline-heading">
                        <div><p className="section-kicker">Longitudinal timeline</p><h2 id="timeline-title">{timelineTitle}</h2></div>
                        <span className="entry-count">{timelineEntries.length}{timelineEntries.length !== note.timeline.length ? ` of ${note.timeline.length}` : ''} traceable entries</span>
                      </div>
                      <div className="timeline-list">
                        {timelineEntries.map((entry) => (
                          <TimelineEntry
                            key={entry.id}
                            entry={entry}
                            viewer={note.viewer}
                            busy={busy}
                            onEdit={() => { setEditing(entry); setDraft(entry.content); }}
                            onHistory={() => void openHistory(entry)}
                            onComment={() => setCommentFor(entry.id)}
                            onResolveComment={(id, status) => void mutate(`comment-${id}`, () => api(`/api/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }), `Comment marked ${status}.`)}
                          />
                        ))}
                        {!timelineEntries.length && <div className="timeline-empty"><MessageSquare aria-hidden="true" /><strong>No matching entries</strong><span>{activeView === 'comments' ? 'No comment threads are visible for this record.' : 'No entries have more than one immutable version yet.'}</span></div>}
                      </div>
                    </section>
                  </div>

                  <ActionRail
                    item={selectedHighlight}
                    tasks={note.tasks}
                    openTasks={openTasks}
                    canCollaborate={canCollaborate}
                    busy={busy}
                    onFeedback={(action) => selectedHighlight && void feedbackFor(selectedHighlight, action)}
                    onSource={() => selectedHighlight && void showSource(selectedHighlight.id)}
                    onTask={(task) => void mutate(`task-${task.id}`, () => api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: task.status === 'done' ? 'open' : 'done' }) }), 'Task status updated.')}
                  />
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {showAdd && note && (
        <Modal title={note.viewer.role === 'patient' ? 'Share a patient update' : 'Add role-owned care note'} onClose={() => setShowAdd(false)}>
          <p className="modal-help">{note.viewer.role === 'patient' ? 'Your update is added to your care summary and shared with your care team.' : `This creates a new ${note.viewer.role} section. It cannot overwrite another role’s note.`}</p>
          <textarea autoFocus value={newContent} onChange={(event) => setNewContent(event.target.value)} placeholder="Add a concise, clinically useful update…" />
          <div className="modal-actions"><button className="secondary-button" onClick={() => setShowAdd(false)}>Cancel</button><button className="primary-button" disabled={!newContent.trim() || busy === 'create-note'} onClick={() => void createNote()}>{busy === 'create-note' ? 'Saving…' : 'Create version 1'}</button></div>
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${prettyType(editing.section)} · v${editing.version}`} onClose={() => setEditing(null)}>
          <p className="modal-help">Optimistic locking will reject this save if another browser changed the same entry.</p>
          <textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} />
          <div className="modal-actions"><button className="secondary-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" disabled={!draft.trim() || Boolean(busy)} onClick={() => void saveEdit()}>{busy ? 'Checking version…' : 'Save new version'}</button></div>
        </Modal>
      )}

      {history && note && (
        <Modal title={`Immutable history · ${prettyType(history.entry.section)}`} onClose={() => setHistory(null)}>
          <div className="version-legend" aria-label="Change legend"><span className="added">Added text</span><span className="removed">Removed text</span></div>
          <div className="version-list">
            {history.versions.map((version) => (
              <article key={version.id}>
                <div><strong>Version {version.version}</strong><span>{formatDate(version.createdAt)}{version.revertedFromVersion ? ` · reverted from v${version.revertedFromVersion}` : ''}</span></div>
                {version.changes?.length ? <p className="version-diff" aria-label={`Changes in version ${version.version}`}>{version.changes.map((change, index) => <span className={change.added ? 'added' : change.removed ? 'removed' : ''} aria-label={change.added ? `Added: ${change.value}` : change.removed ? `Removed: ${change.value}` : undefined} key={`${index}-${change.value}`}>{change.value}</span>)}</p> : <p>{version.content}</p>}
                {canEdit(note.viewer, history.entry) && version.version !== history.entry.version && <button onClick={() => void mutate(`revert-${version.version}`, () => api(`/api/entries/${history.entry.id}/revert`, { method: 'POST', body: JSON.stringify({ version: version.version, baseVersion: history.entry.version }) }), `Version ${version.version} restored as a new version.`).then((ok) => { if (ok) setHistory(null); })}>Revert by creating a new version</button>}
              </article>
            ))}
          </div>
        </Modal>
      )}

      {provenance && (
        <Modal title="Verified provenance pointer" onClose={() => setProvenance(null)}>
          <div className="provenance-meta"><span>Entry {provenance.pointer.entryId}</span><span>Version {provenance.pointer.version}</span><span>Version ID {provenance.pointer.versionId}</span><span>Span {provenance.pointer.startOffset}–{provenance.pointer.endOffset}</span>{provenance.pointer.sourceArtifactId && <span>Artifact {provenance.pointer.sourceArtifactId}</span>}{provenance.source.sessionRef && <span>Session {provenance.source.sessionRef}</span>}</div>
          <p className="source-copy">{provenance.source.content}</p>
          <div className="exact-span"><strong>Exact referenced span</strong><p>{provenance.source.exactSpan || 'The stored offsets resolve to an empty span.'}</p></div>
          <div className="modal-actions"><button className="primary-button" onClick={() => { const entryId = provenance.pointer.entryId; setProvenance(null); requestAnimationFrame(() => document.getElementById(`entry-${entryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })); }}><Link2 aria-hidden="true" />Jump to timeline entry</button></div>
        </Modal>
      )}

      {commentFor && (
        <Modal title="Add threaded comment" onClose={() => setCommentFor(null)}>
          <p className="modal-help">Internal collaboration only. The patient-facing response never contains this field.</p>
          <textarea autoFocus value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Use @mention context and a clear next action…" />
          <div className="modal-actions"><button className="secondary-button" onClick={() => setCommentFor(null)}>Cancel</button><button className="primary-button" disabled={!comment.trim() || Boolean(busy)} onClick={() => void mutate('add-comment', () => api(`/api/entries/${commentFor}/comments`, { method: 'POST', body: JSON.stringify({ body: comment, assignedToId: note?.viewer.role === 'staff' ? 'user-clinician' : 'user-staff' }) }), 'Thread comment added and assigned.').then((ok) => { if (ok) { setCommentFor(null); setComment(''); } })}>Comment & assign</button></div>
        </Modal>
      )}

      {showScribe && note && (
        <Modal title="Mock scribe · local provider" onClose={() => setShowScribe(false)}>
          <div className="provider-banner"><span><Bot aria-hidden="true" />Provider: deterministic local mock</span><strong>No external transmission</strong></div>
          <p className="modal-help">Names, Singapore IDs and phone numbers are redacted before the provider boundary. No network or LLM key is used.</p>
          <label className="modal-field"><span>Interaction type</span><select value={scribeInteraction} onChange={(event) => setScribeInteraction(event.target.value as ScribeInteraction)}><option value="ai_patient">Patient self-report</option><option value="doctor_patient">Clinician–patient consult</option><option value="nurse_patient">Nurse–patient consult</option></select></label>
          <textarea value={scribeText} onChange={(event) => setScribeText(event.target.value)} />
          <div className="modal-actions"><button className="secondary-button" onClick={() => setShowScribe(false)}>Cancel</button><button className="primary-button" disabled={!scribeText.trim() || Boolean(busy)} onClick={() => void mutate('scribe', () => api('/api/dev/scribe-ingest', { method: 'POST', body: JSON.stringify({ patientId: note.patient.id, sessionRef: `demo-${Date.now()}`, interactionType: scribeInteraction, transcript: scribeText }) }), 'Mock scribe entry created. PHI was redacted before provider processing.').then((ok) => { if (ok) setShowScribe(false); })}><Sparkles aria-hidden="true" />Redact & ingest</button></div>
        </Modal>
      )}

      {showAudit && note && (
        <Modal title="Clinic audit trail · Maya Tan" onClose={() => setShowAudit(false)}>
          <div className="audit-toolbar"><p className="modal-help">Admin-only metadata for this patient, newest first. Clinical free text is never included.</p><button className="secondary-button" disabled={auditLoading} onClick={() => void openAuditTrail()}><RefreshCw className={auditLoading ? 'is-spinning' : ''} aria-hidden="true" />Refresh</button></div>
          {auditError ? <p className="audit-error" role="alert">{auditError}</p> : auditLoading && !auditEvents.length ? <p className="audit-loading">Loading audit events…</p> : !auditEvents.length ? <p className="audit-loading">No audit events yet. Actions taken during the demo will appear here.</p> : <div className="audit-list">{auditEvents.map((event) => <article key={event.id}><div><strong>{prettyType(event.action.replace('.', '_'))}</strong><time>{formatDate(event.createdAt)}</time></div><p>{prettyType(event.entityType)} · <code>{event.entityId}</code></p><dl><div><dt>Actor</dt><dd>{event.actorId ?? 'System'}</dd></div>{(event.fromVersion || event.toVersion) && <div><dt>Version</dt><dd>{event.fromVersion ? `v${event.fromVersion} → ` : ''}{event.toVersion ? `v${event.toVersion}` : '—'}</dd></div>}<div><dt>Metadata</dt><dd>{Object.keys(event.metadata).length ? JSON.stringify(event.metadata) : 'None'}</dd></div></dl></article>)}</div>}
        </Modal>
      )}

      {showReset && (
        <Modal title="Reset synthetic demo data?" onClose={() => setShowReset(false)}>
          <p className="modal-help">This development-only action deletes current synthetic changes and restores the clean seed. It never targets a production database.</p>
          <div className="reset-warning"><ShieldAlert aria-hidden="true" /><div><strong>All demo edits, comments, feedback and sessions will be replaced.</strong><span>The page will reopen in the clinician role after the reset.</span></div></div>
          <div className="modal-actions"><button className="secondary-button" disabled={busy === 'reset-demo'} onClick={() => setShowReset(false)}>Cancel</button><button className="danger-button" disabled={busy === 'reset-demo'} onClick={() => void resetDemo()}>{busy === 'reset-demo' ? 'Resetting…' : 'Reset synthetic data'}</button></div>
        </Modal>
      )}

      {conflict && (
        <Modal title="409 · Concurrent edit detected" onClose={() => setConflict(null)}>
          <p className="modal-help">Your draft was preserved. Nothing was overwritten. Compare the two versions before deciding what to keep.</p>
          <div className="conflict-grid"><div><strong>Your draft · base v{conflict.clientVersion}</strong><p>{conflict.client}</p></div><div><strong>Server · current v{conflict.serverVersion}</strong><p>{conflict.server}</p></div></div>
          <div className="modal-actions"><button className="primary-button" onClick={() => { setConflict(null); setEditing(null); void load(); }}>Use server version</button></div>
        </Modal>
      )}
    </main>
  );
}

function ClinicalSidebar({ viewer, topCount, openTasks, activeView, onNavigate }: { viewer?: SessionUser; topCount: number; openTasks: number; activeView: TimelineView; onNavigate: (view: TimelineView, href: string) => void }) {
  const staffNavItems = [
    { href: '#glance', view: 'care' as const, label: 'Care note', icon: FileText, count: topCount },
    { href: '#timeline', view: 'timeline' as const, label: 'Timeline', icon: Activity },
    { href: '#tasks', view: 'tasks' as const, label: 'Tasks', icon: ClipboardList, count: openTasks },
    { href: '#timeline', view: 'history' as const, label: 'History', icon: FileClock },
    { href: '#timeline', view: 'comments' as const, label: 'Comments', icon: MessageSquare },
  ];
  const navItems = viewer?.role === 'patient'
    ? [{ href: '#patient-workspace', view: 'care' as const, label: 'Care summary', icon: HeartPulse }]
    : staffNavItems;
  return (
    <aside className="clinical-sidebar" aria-label="Clinical workspace navigation">
      <div className="brand-lockup"><div className="brand-mark" aria-hidden="true">N</div><div><strong>Nightingale</strong><span>Clinical workspace</span></div></div>
      <nav>{navItems.map((item) => { const Icon = item.icon; const active = item.view === activeView; return <a className={active ? 'active' : ''} href={item.href} aria-current={active ? 'page' : undefined} title={item.label} onClick={(event) => { event.preventDefault(); onNavigate(item.view, item.href); }} key={item.label}><Icon aria-hidden="true" /><span>{item.label}</span>{'count' in item && typeof item.count === 'number' && item.count > 0 && <small>{item.count}</small>}</a>; })}</nav>
      <div className="sidebar-trust"><ShieldCheck aria-hidden="true" /><div><strong>Central Clinic</strong><span>Encrypted · scoped access</span></div></div>
      {viewer && <div className="sidebar-user"><div className="user-initials" aria-hidden="true">{viewer.displayName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><strong>{viewer.displayName}</strong><span>{prettyType(viewer.role)}</span></div></div>}
    </aside>
  );
}

function GlanceRow({ item, selected, onSelect, onSource }: { item: HighlightDTO; selected: boolean; onSelect: () => void; onSource: () => void }) {
  const tone = item.riskLevel === 'critical' || item.riskLevel === 'high' ? 'critical' : item.kind === 'task' ? 'action' : 'context';
  const Icon = tone === 'critical' ? ShieldAlert : tone === 'action' ? ClipboardList : Activity;
  const label = item.kind === 'task' ? 'Open action' : tone === 'critical' ? 'Critical risk' : 'Recent change';
  return (
    <article className={`glance-row ${tone} ${selected ? 'selected' : ''}`}>
      <button className="glance-row-main" onClick={onSelect} aria-pressed={selected}><span className="glance-icon"><Icon aria-hidden="true" /></span><span className="glance-label">{label}</span><span className="glance-copy"><strong>{item.summary}</strong><small>{item.riskReason}</small></span><span className="score-chip">{Math.round(item.score)} pts</span></button>
      <button className="source-button" onClick={onSource} aria-label={`Verify source for ${item.summary}`}><Link2 aria-hidden="true" />Source · v{item.provenance.version}</button>
    </article>
  );
}

function ActionRail({ item, tasks, openTasks, canCollaborate, busy, onFeedback, onSource, onTask }: { item?: HighlightDTO; tasks: CareTask[]; openTasks: number; canCollaborate: boolean; busy: string; onFeedback: (action: string) => void; onSource: () => void; onTask: (task: CareTask) => void }) {
  return (
    <aside className="action-rail" aria-label="Selected signal actions">
      <section className="rail-section selected-signal">
        <p className="section-kicker">Selected signal</p><h2>{item?.summary ?? 'Select a Glance signal'}</h2>{item && <p>{item.riskReason}</p>}
        {item && canCollaborate && <div className="feedback-grid"><button disabled={busy === `highlight-${item.id}`} onClick={() => onFeedback('accept')}><Check aria-hidden="true" />Accept</button><button disabled={busy === `highlight-${item.id}`} onClick={() => onFeedback('pin')}><Pin aria-hidden="true" />Pin</button><button className="danger" disabled={busy === `highlight-${item.id}`} onClick={() => onFeedback('reject')}><X aria-hidden="true" />Reject</button></div>}
        {item && <button className="rail-link" onClick={onSource}><ShieldCheck aria-hidden="true" />Verify exact source</button>}
      </section>
      <section className="rail-section" id="tasks">
        <div className="rail-heading"><div><p className="section-kicker">Open actions</p><h2>Care coordination</h2></div><span>{openTasks} open</span></div>
        <div className="task-list">{tasks.map((task) => <label className="task-row" key={task.id}><input type="checkbox" checked={task.status === 'done'} disabled={!canCollaborate || busy === `task-${task.id}`} onChange={() => onTask(task)} /><span><strong className={task.status === 'done' ? 'is-complete' : ''}>{task.title}</strong><small>{task.assignedToName ?? 'Unassigned'} · {formatDate(task.dueAt)}</small></span></label>)}</div>
      </section>
      <section className="rail-section trust-section" id="trust"><ShieldCheck aria-hidden="true" /><p className="section-kicker">Trust signal</p><h2>Every insight is traceable</h2><p>Exact entry, immutable version and text span remain available. AI suggestions never overwrite owned notes.</p><strong>AES-256-GCM · clinic-scoped RBAC</strong></section>
    </aside>
  );
}

function LoadingState() {
  return <div className="loading-state"><RefreshCw className="is-spinning" aria-hidden="true" /><div><strong>Opening encrypted synthetic record</strong><span>Applying clinic scope and role permissions…</span></div></div>;
}

function ScopeError({ message }: { message: string }) {
  return <div className="scope-error"><LockKeyhole aria-hidden="true" /><h1>Record unavailable</h1><p>{message}</p><strong>Switch back to a Central Clinic demo role above.</strong></div>;
}

function PatientSummary({ note }: { note: CareNote }) {
  return (
    <div className="patient-summary-layout">
      <section className="patient-summary-card"><div className="panel-heading"><div><p className="section-kicker">Your care summary</p><h2>What your care team shared</h2></div><HeartPulse aria-hidden="true" /></div><div className="patient-entry-list">{note.timeline.map((entry) => <article key={entry.id}><p>{prettyType(entry.type)}</p><strong>{prettyType(entry.section)}</strong><span>{entry.content}</span></article>)}</div></section>
      <section className="patient-privacy-card"><ShieldCheck aria-hidden="true" /><h2>Private by construction</h2><p>This API response contains only patient-facing instructions and patient-submitted updates. Internal notes, raw AI summaries, comments, tasks and audit data are excluded on the server.</p></section>
    </div>
  );
}

function TimelineEntry({ entry, viewer, busy, onEdit, onHistory, onComment, onResolveComment }: { entry: EntryDTO; viewer: SessionUser; busy: string; onEdit: () => void; onHistory: () => void; onComment: () => void; onResolveComment: (id: string, status: string) => void }) {
  const accent = entry.authorRole === 'system' ? 'system' : entry.authorRole;
  return (
    <article id={`entry-${entry.id}`} className={`timeline-card ${accent}`}>
      <div className="timeline-meta"><time>{formatDate(entry.updatedAt)}</time><span>{prettyType(entry.authorRole)}</span></div>
      <div className="timeline-node" aria-hidden="true">{entry.authorRole === 'system' ? <Bot /> : <UserRound />}</div>
      <div className="timeline-body"><div className="timeline-title-row"><div><p>{entry.authorName} · {prettyType(entry.type)}</p><h3>{prettyType(entry.section)}</h3></div><div className="entry-badges"><span>v{entry.version}</span>{entry.sourceSessionRef && <span className="ai-badge">AI source preserved</span>}</div></div><p className="timeline-copy">{entry.content}</p><div className="entry-actions">{canEdit(viewer, entry) && <button disabled={Boolean(busy)} onClick={onEdit}>Edit owned section</button>}<button onClick={onHistory}><FileClock aria-hidden="true" />Version history</button>{['staff', 'clinician'].includes(viewer.role) && <button onClick={onComment}><MessageSquare aria-hidden="true" />Comment</button>}</div>{entry.comments?.length ? <div className="comment-thread">{entry.comments.map((item) => <div key={item.id}><div><strong>{item.authorName}{item.assignedToName ? ` → ${item.assignedToName}` : ''}</strong><span className={item.status === 'resolved' ? 'resolved' : 'open'}>{item.status}</span></div><p>{item.body}</p>{['staff', 'clinician'].includes(viewer.role) && <button onClick={() => onResolveComment(item.id, item.status === 'resolved' ? 'open' : 'resolved')}>{item.status === 'resolved' ? 'Reopen' : 'Resolve'}</button>}</div>)}</div> : null}</div>
    </article>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const cardRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const shell = document.querySelector<HTMLElement>('.clinical-shell');
    shell?.setAttribute('inert', '');
    const focusableSelector = 'button:not([disabled]), textarea:not([disabled]), select:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
    const focusFrame = requestAnimationFrame(() => {
      const card = cardRef.current;
      if (!card || card.contains(document.activeElement)) return;
      const firstFocusable = card.querySelector<HTMLElement>(focusableSelector);
      if (firstFocusable) firstFocusable.focus();
      else card.focus();
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !cardRef.current) return;
      const focusable = [...cardRef.current.querySelectorAll<HTMLElement>(focusableSelector)];
      if (!focusable.length) {
        event.preventDefault();
        cardRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      shell?.removeAttribute('inert');
      if (previousFocus?.isConnected) requestAnimationFrame(() => previousFocus.focus());
    };
  }, []);
  return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal-card" ref={cardRef} tabIndex={-1}><div className="modal-header"><h2 id={titleId}>{title}</h2><button aria-label="Close" onClick={onClose}><X aria-hidden="true" /></button></div><div className="modal-body">{children}</div></section></div>;
}
