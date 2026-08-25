import 'server-only';
import { randomUUID } from 'node:crypto';
import type { SessionUser } from '@/src/core/types';
import { encryptText, sha256 } from '@/src/core/crypto';
import { calculateImportance, clamp, feedbackDelta } from '@/src/core/importance';
import { runMockScribe, type ScribeInteraction } from '@/src/core/mock-scribe';
import { db } from './db';
import { emitPatientEvent, recordAudit } from './audit';
import { HttpError, notFound } from './http';
import { readVersionContent } from './version-content';
import {
  assertCanCreateEntry,
  assertCanEditEntry,
  assertCanViewPatient,
  assertInternalCollaborator,
  canViewEntry,
} from './rbac';

function validateContent(content: unknown) {
  if (typeof content !== 'string' || !content.trim() || content.length > 20_000) {
    throw new HttpError(400, 'INVALID_CONTENT', 'Content must contain 1 to 20,000 characters.');
  }
  return content.trim();
}

async function entryForMutation(entryId: string) {
  const entry = await db.entry.findUnique({ where: { id: entryId } });
  if (!entry) notFound();
  return entry;
}

export async function createEntry(
  user: SessionUser,
  patientId: string,
  input: {
    type: string;
    section: string;
    content: unknown;
    visibility?: string;
    riskLevel?: string;
    supersedesEntryId?: string;
  },
) {
  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) notFound();
  assertCanViewPatient(user, patient);
  assertCanCreateEntry(user, input.type);
  const content = validateContent(input.content);
  const visibility = input.type === 'patient_instruction' ? 'patient' : 'internal';
  if (input.visibility && input.visibility !== visibility) {
    throw new HttpError(400, 'VISIBILITY_FIXED_BY_TYPE', 'Visibility is fixed by entry type.');
  }
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(input.section)) {
    throw new HttpError(400, 'INVALID_SECTION', 'Section must be a short snake_case identifier.');
  }
  if (input.supersedesEntryId && user.role !== 'clinician') {
    throw new HttpError(403, 'CLINICIAN_CORRECTION_REQUIRED', 'Only clinicians can supersede an entry.');
  }
  if (input.supersedesEntryId) {
    const target = await entryForMutation(input.supersedesEntryId);
    if (target.patientId !== patientId || !canViewEntry(user, target)) notFound();
  }

  const entryId = randomUUID();
  const versionId = randomUUID();
  const encrypted = encryptText(content);
  await db.$transaction(async (tx) => {
    await tx.entry.create({
      data: {
        id: entryId,
        clinicId: patient.clinicId,
        patientId,
        authorId: user.id,
        authorRole: user.role,
        type: input.type,
        visibility,
        section: input.section,
        riskLevel: input.riskLevel ?? 'low',
        supersedesEntryId: input.supersedesEntryId,
      },
    });
    await tx.entryVersion.create({
      data: {
        id: versionId,
        entryId,
        version: 1,
        contentCipher: encrypted.cipher,
        contentIv: encrypted.iv,
        contentTag: encrypted.tag,
        contentHash: sha256(content),
        createdById: user.id,
      },
    });
    if (input.supersedesEntryId) {
      await tx.entryRelation.create({
        data: {
          id: randomUUID(),
          patientId,
          fromEntryId: entryId,
          toEntryId: input.supersedesEntryId,
          relation: 'supersedes',
          createdById: user.id,
        },
      });
    }
    await recordAudit(tx, {
      clinicId: patient.clinicId,
      patientId,
      actorId: user.id,
      action: input.supersedesEntryId ? 'entry.corrected' : 'entry.created',
      entityType: 'entry',
      entityId: entryId,
      toVersion: 1,
      metadata: { type: input.type, visibility },
    });
    await emitPatientEvent(tx, {
      clinicId: patient.clinicId,
      patientId,
      eventType: 'entry.created',
      entityId: entryId,
      version: 1,
    });
  });
  return { id: entryId, versionId, version: 1 };
}

export async function updateEntry(
  user: SessionUser,
  entryId: string,
  input: { baseVersion: number; content: unknown },
) {
  const entry = await entryForMutation(entryId);
  assertCanEditEntry(user, entry);
  const content = validateContent(input.content);
  if (!Number.isInteger(input.baseVersion) || input.baseVersion < 1) {
    throw new HttpError(400, 'INVALID_BASE_VERSION', 'A positive baseVersion is required.');
  }
  const nextVersion = input.baseVersion + 1;
  const versionId = randomUUID();
  const encrypted = encryptText(content);

  await db.$transaction(async (tx) => {
    const updated = await tx.entry.updateMany({
      where: { id: entryId, currentVersion: input.baseVersion },
      data: { currentVersion: { increment: 1 } },
    });
    if (updated.count !== 1) {
      const current = await tx.entry.findUnique({ where: { id: entryId }, select: { currentVersion: true } });
      throw new HttpError(409, 'VERSION_CONFLICT', 'This section changed after editing began.', {
        clientVersion: input.baseVersion,
        serverVersion: current?.currentVersion,
      });
    }
    await tx.entryVersion.create({
      data: {
        id: versionId,
        entryId,
        version: nextVersion,
        contentCipher: encrypted.cipher,
        contentIv: encrypted.iv,
        contentTag: encrypted.tag,
        contentHash: sha256(content),
        createdById: user.id,
      },
    });
    await recordAudit(tx, {
      clinicId: entry.clinicId,
      patientId: entry.patientId,
      actorId: user.id,
      action: 'entry.updated',
      entityType: 'entry',
      entityId: entryId,
      fromVersion: input.baseVersion,
      toVersion: nextVersion,
      metadata: { section: entry.section },
    });
    await emitPatientEvent(tx, {
      clinicId: entry.clinicId,
      patientId: entry.patientId,
      eventType: 'entry.updated',
      entityId: entryId,
      version: nextVersion,
    });
  });
  return { id: entryId, versionId, version: nextVersion };
}

export async function revertEntry(
  user: SessionUser,
  entryId: string,
  input: { version: number; baseVersion: number },
) {
  const entry = await entryForMutation(entryId);
  assertCanEditEntry(user, entry);
  const source = await db.entryVersion.findUnique({
    where: { entryId_version: { entryId, version: input.version } },
  });
  if (!source) notFound();
  const sourceContent = await readVersionContent(source);
  const sourceEncrypted = encryptText(sourceContent);
  const nextVersion = input.baseVersion + 1;
  const versionId = randomUUID();
  await db.$transaction(async (tx) => {
    const updated = await tx.entry.updateMany({
      where: { id: entryId, currentVersion: input.baseVersion },
      data: { currentVersion: { increment: 1 }, storageTier: 'hot' },
    });
    if (updated.count !== 1) {
      const current = await tx.entry.findUnique({ where: { id: entryId }, select: { currentVersion: true } });
      throw new HttpError(409, 'VERSION_CONFLICT', 'The entry changed before revert could be applied.', {
        clientVersion: input.baseVersion,
        serverVersion: current?.currentVersion,
      });
    }
    await tx.entryVersion.create({
      data: {
        id: versionId,
        entryId,
        version: nextVersion,
        contentCipher: sourceEncrypted.cipher,
        contentIv: sourceEncrypted.iv,
        contentTag: sourceEncrypted.tag,
        contentHash: source.contentHash,
        createdById: user.id,
        revertedFromVersion: source.version,
      },
    });
    await recordAudit(tx, {
      clinicId: entry.clinicId,
      patientId: entry.patientId,
      actorId: user.id,
      action: 'entry.reverted',
      entityType: 'entry',
      entityId: entryId,
      fromVersion: input.baseVersion,
      toVersion: nextVersion,
      metadata: { revertedFromVersion: source.version },
    });
    await emitPatientEvent(tx, {
      clinicId: entry.clinicId,
      patientId: entry.patientId,
      eventType: 'entry.reverted',
      entityId: entryId,
      version: nextVersion,
    });
  });
  return { id: entryId, versionId, version: nextVersion, revertedFromVersion: source.version };
}

export async function addComment(
  user: SessionUser,
  entryId: string,
  input: { body: unknown; parentId?: string; assignedToId?: string; startOffset?: number; endOffset?: number },
) {
  assertInternalCollaborator(user);
  const entry = await entryForMutation(entryId);
  if (!canViewEntry(user, entry)) notFound();
  const body = validateContent(input.body);
  if (input.assignedToId) {
    const assignee = await db.user.findUnique({ where: { id: input.assignedToId } });
    if (!assignee || assignee.clinicId !== entry.clinicId || !['staff', 'clinician'].includes(assignee.role)) notFound();
  }
  if (input.parentId) {
    const parent = await db.comment.findUnique({ where: { id: input.parentId } });
    if (!parent || parent.entryId !== entryId) notFound();
  }
  const commentId = randomUUID();
  const encrypted = encryptText(body);
  await db.$transaction(async (tx) => {
    await tx.comment.create({
      data: {
        id: commentId,
        entryId,
        parentId: input.parentId,
        authorId: user.id,
        assignedToId: input.assignedToId,
        bodyCipher: encrypted.cipher,
        bodyIv: encrypted.iv,
        bodyTag: encrypted.tag,
        startOffset: input.startOffset,
        endOffset: input.endOffset,
      },
    });
    await recordAudit(tx, {
      clinicId: entry.clinicId,
      patientId: entry.patientId,
      actorId: user.id,
      action: 'comment.created',
      entityType: 'comment',
      entityId: commentId,
      metadata: { assigned: Boolean(input.assignedToId), threaded: Boolean(input.parentId) },
    });
    await emitPatientEvent(tx, { clinicId: entry.clinicId, patientId: entry.patientId, eventType: 'comment.created', entityId: commentId });
  });
  return { id: commentId };
}

export async function patchComment(
  user: SessionUser,
  commentId: string,
  input: { status?: string; assignedToId?: string | null },
) {
  assertInternalCollaborator(user);
  const comment = await db.comment.findUnique({ where: { id: commentId }, include: { entry: true } });
  if (!comment || !canViewEntry(user, comment.entry)) notFound();
  if (input.status && !['open', 'resolved'].includes(input.status)) {
    throw new HttpError(400, 'INVALID_COMMENT_STATUS', 'Status must be open or resolved.');
  }
  if (input.assignedToId) {
    const assignee = await db.user.findUnique({ where: { id: input.assignedToId } });
    if (!assignee || assignee.clinicId !== comment.entry.clinicId || !['staff', 'clinician'].includes(assignee.role)) notFound();
  }
  await db.$transaction(async (tx) => {
    await tx.comment.update({
      where: { id: commentId },
      data: {
        status: input.status,
        resolvedAt: input.status === 'resolved' ? new Date() : input.status === 'open' ? null : undefined,
        assignedToId: input.assignedToId,
      },
    });
    await recordAudit(tx, {
      clinicId: comment.entry.clinicId,
      patientId: comment.entry.patientId,
      actorId: user.id,
      action: input.status === 'resolved' ? 'comment.resolved' : 'comment.updated',
      entityType: 'comment',
      entityId: commentId,
      metadata: { status: input.status ?? comment.status },
    });
    await emitPatientEvent(tx, { clinicId: comment.entry.clinicId, patientId: comment.entry.patientId, eventType: 'comment.updated', entityId: commentId });
  });
  return { id: commentId, status: input.status ?? comment.status };
}

export async function applyHighlightFeedback(user: SessionUser, highlightId: string, action: string) {
  assertInternalCollaborator(user);
  if (!['accept', 'reject', 'pin', 'resolve'].includes(action)) {
    throw new HttpError(400, 'INVALID_FEEDBACK_ACTION', 'Unknown highlight feedback action.');
  }
  const highlight = await db.highlight.findUnique({ where: { id: highlightId }, include: { patient: true } });
  if (!highlight) notFound();
  assertCanViewPatient(user, highlight.patient);
  const delta = feedbackDelta(action);
  const current = await db.featureWeight.findUnique({
    where: { clinicId_featureKey: { clinicId: highlight.patient.clinicId, featureKey: highlight.featureKey } },
  });
  const nextWeight = clamp((current?.weight ?? 0) + delta, -15, 15);
  const status = action === 'reject' ? 'rejected' : action === 'pin' ? 'pinned' : action === 'resolve' ? 'resolved' : 'accepted';

  await db.$transaction(async (tx) => {
    await tx.featureWeight.upsert({
      where: { clinicId_featureKey: { clinicId: highlight.patient.clinicId, featureKey: highlight.featureKey } },
      create: { id: randomUUID(), clinicId: highlight.patient.clinicId, featureKey: highlight.featureKey, weight: nextWeight, observations: 1 },
      update: { weight: nextWeight, observations: { increment: 1 } },
    });
    const matching = await tx.highlight.findMany({ where: { patientId: highlight.patientId, featureKey: highlight.featureKey } });
    for (const item of matching) {
      await tx.highlight.update({
        where: { id: item.id },
        data: {
          learnedScore: nextWeight,
          finalScore: clamp(item.baseScore + nextWeight, 0, 100),
          ...(item.id === highlightId ? { status } : {}),
        },
      });
    }
    await tx.highlightFeedback.create({
      data: { id: randomUUID(), highlightId, userId: user.id, action, featureKey: highlight.featureKey, delta },
    });
    await recordAudit(tx, {
      clinicId: highlight.patient.clinicId,
      patientId: highlight.patientId,
      actorId: user.id,
      action: `highlight.${action}`,
      entityType: 'highlight',
      entityId: highlightId,
      metadata: { featureKey: highlight.featureKey, delta, learnedWeight: nextWeight },
    });
    await emitPatientEvent(tx, { clinicId: highlight.patient.clinicId, patientId: highlight.patientId, eventType: 'highlight.feedback', entityId: highlightId });
  });
  return { id: highlightId, status, featureKey: highlight.featureKey, learnedWeight: nextWeight };
}

export async function patchTask(user: SessionUser, taskId: string, status: string) {
  assertInternalCollaborator(user);
  if (!['open', 'done'].includes(status)) throw new HttpError(400, 'INVALID_TASK_STATUS', 'Status must be open or done.');
  const task = await db.task.findUnique({ where: { id: taskId }, include: { patient: true } });
  if (!task) notFound();
  assertCanViewPatient(user, task.patient);
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id: taskId }, data: { status } });
    await recordAudit(tx, { clinicId: task.patient.clinicId, patientId: task.patientId, actorId: user.id, action: 'task.updated', entityType: 'task', entityId: taskId, metadata: { status } });
    await emitPatientEvent(tx, { clinicId: task.patient.clinicId, patientId: task.patientId, eventType: 'task.updated', entityId: taskId });
  });
  return { id: taskId, status };
}

export async function ingestMockScribe(
  user: SessionUser,
  input: { patientId: string; sessionRef: string; interactionType: ScribeInteraction; transcript: unknown },
) {
  if (process.env.DEMO_MODE !== 'true') throw new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.');
  assertInternalCollaborator(user);
  const patient = await db.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) notFound();
  assertCanViewPatient(user, patient);
  const transcript = validateContent(input.transcript);
  if (!['doctor_patient', 'nurse_patient', 'ai_patient'].includes(input.interactionType)) {
    throw new HttpError(400, 'INVALID_INTERACTION_TYPE', 'Unknown scribe interaction type.');
  }
  const result = runMockScribe(input.interactionType, transcript, [patient.displayName]);
  const raw = encryptText(transcript);
  const redacted = encryptText(result.redaction.text);
  const content = encryptText(result.summary);
  const reasonText = `Deterministic MockScribe ${input.interactionType} output; review before clinical use.`;
  const reason = encryptText(reasonText);
  const scores = calculateImportance({ riskLevel: result.riskLevel, entityType: result.featureKey.split(':')[1], ageDays: 0 });
  const artifactId = randomUUID();
  const entryId = randomUUID();
  const versionId = randomUUID();
  const highlightId = randomUUID();

  await db.$transaction(async (tx) => {
    await tx.sourceArtifact.create({
      data: {
        id: artifactId,
        clinicId: patient.clinicId,
        patientId: patient.id,
        sessionRef: input.sessionRef,
        interactionType: input.interactionType,
        rawCipher: raw.cipher,
        rawIv: raw.iv,
        rawTag: raw.tag,
        redactedCipher: redacted.cipher,
        redactedIv: redacted.iv,
        redactedTag: redacted.tag,
        redactionMetadata: JSON.stringify(result.redaction.counts),
      },
    });
    await tx.entry.create({
      data: {
        id: entryId,
        clinicId: patient.clinicId,
        patientId: patient.id,
        authorRole: 'system',
        type: result.entryType,
        visibility: 'internal',
        section: 'scribe_summary',
        riskLevel: result.riskLevel,
        sourceArtifactId: artifactId,
      },
    });
    await tx.entryVersion.create({
      data: {
        id: versionId,
        entryId,
        version: 1,
        contentCipher: content.cipher,
        contentIv: content.iv,
        contentTag: content.tag,
        contentHash: sha256(result.summary),
      },
    });
    await tx.highlight.create({
      data: {
        id: highlightId,
        patientId: patient.id,
        entryId,
        entryVersionId: versionId,
        sourceArtifactId: artifactId,
        startOffset: 0,
        endOffset: result.summary.length,
        kind: 'scribe_suggestion',
        summaryCipher: content.cipher,
        summaryIv: content.iv,
        summaryTag: content.tag,
        riskReasonCipher: reason.cipher,
        riskReasonIv: reason.iv,
        riskReasonTag: reason.tag,
        riskLevel: result.riskLevel,
        entityType: result.featureKey.split(':')[1],
        featureKey: result.featureKey,
        baseScore: scores.baseScore,
        learnedScore: scores.learnedScore,
        finalScore: scores.finalScore,
      },
    });
    await recordAudit(tx, {
      clinicId: patient.clinicId,
      patientId: patient.id,
      actorId: user.id,
      action: 'scribe.ingested',
      entityType: 'source_artifact',
      entityId: artifactId,
      metadata: { interactionType: input.interactionType, redactionCount: Object.values(result.redaction.counts).reduce((sum, count) => sum + count, 0) },
    });
    await emitPatientEvent(tx, { clinicId: patient.clinicId, patientId: patient.id, eventType: 'scribe.ingested', entityId: entryId, version: 1 });
  });
  return { artifactId, entryId, versionId, highlightId, redaction: result.redaction.counts };
}
