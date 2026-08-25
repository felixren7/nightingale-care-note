import 'server-only';
import type { EntryDTO, HighlightDTO, SessionUser } from '@/src/core/types';
import { decryptText } from '@/src/core/crypto';
import { db } from './db';
import { notFound } from './http';
import { assertCanViewPatient, canViewEntry } from './rbac';

const decrypt = (cipher: string, iv: string, tag: string) => decryptText({ cipher, iv, tag });

export async function getCareNote(user: SessionUser, patientId: string) {
  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) notFound();
  assertCanViewPatient(user, patient);

  const entryRows = await db.entry.findMany({
    where: { patientId },
    include: {
      author: { select: { displayName: true } },
      sourceArtifact: { select: { sessionRef: true } },
      versions: { orderBy: { version: 'desc' }, take: 1 },
      comments: {
        include: {
          author: { select: { displayName: true } },
          assignedTo: { select: { displayName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const timeline: EntryDTO[] = entryRows
    .filter((entry) => canViewEntry(user, entry))
    .map((entry) => {
      const version = entry.versions[0];
      if (!version) throw new Error(`Entry ${entry.id} has no version.`);
      const dto: EntryDTO = {
        id: entry.id,
        authorRole: entry.authorRole,
        authorName: entry.author?.displayName ?? 'Nightingale AI',
        type: entry.type,
        visibility: entry.visibility,
        section: entry.section,
        riskLevel: entry.riskLevel,
        version: version.version,
        content: decrypt(version.contentCipher, version.contentIv, version.contentTag),
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        sourceSessionRef: entry.sourceArtifact?.sessionRef,
        supersedesEntryId: entry.supersedesEntryId ?? undefined,
      };
      if (user.role !== 'patient') {
        dto.comments = entry.comments.map((comment) => ({
          id: comment.id,
          authorName: comment.author.displayName,
          body: decrypt(comment.bodyCipher, comment.bodyIv, comment.bodyTag),
          status: comment.status,
          assignedToName: comment.assignedTo?.displayName,
          createdAt: comment.createdAt.toISOString(),
        }));
      }
      return dto;
    });

  let glance: HighlightDTO[] = [];
  let tasks: Array<{
    id: string;
    title: string;
    status: string;
    dueAt?: string;
    riskLevel: string;
    assignedToName?: string;
  }> = [];

  if (user.role !== 'patient') {
    const highlights = await db.highlight.findMany({
      where: { patientId, status: { not: 'rejected' } },
      include: { entryVersion: { select: { version: true } } },
      orderBy: { finalScore: 'desc' },
      take: 5,
    });
    glance = highlights.map((highlight) => ({
      id: highlight.id,
      kind: highlight.kind,
      summary: decrypt(highlight.summaryCipher, highlight.summaryIv, highlight.summaryTag),
      riskReason: decrypt(highlight.riskReasonCipher, highlight.riskReasonIv, highlight.riskReasonTag),
      riskLevel: highlight.riskLevel,
      status: highlight.status,
      score: highlight.finalScore,
      featureKey: highlight.featureKey,
      provenance: {
        entryId: highlight.entryId,
        versionId: highlight.entryVersionId,
        version: highlight.entryVersion.version,
        startOffset: highlight.startOffset,
        endOffset: highlight.endOffset,
        sourceArtifactId: highlight.sourceArtifactId ?? undefined,
      },
    }));

    const taskRows = await db.task.findMany({
      where: { patientId },
      include: { assignedTo: { select: { displayName: true } } },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    });
    tasks = taskRows.map((task) => ({
      id: task.id,
      title: decrypt(task.titleCipher, task.titleIv, task.titleTag),
      status: task.status,
      dueAt: task.dueAt?.toISOString(),
      riskLevel: task.riskLevel,
      assignedToName: task.assignedTo?.displayName,
    }));
  }

  return {
    viewer: user,
    patient: {
      id: patient.id,
      displayName: patient.displayName,
      birthYear: patient.birthYear,
      recordNumber: patient.recordNumber,
      synthetic: patient.synthetic,
      clinicId: patient.clinicId,
      lastContactAt: patient.lastContactAt.toISOString(),
    },
    glance,
    timeline,
    tasks,
  };
}
