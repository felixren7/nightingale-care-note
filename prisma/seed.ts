import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';
import { encryptText, sha256 } from '../src/core/crypto';
import { getDatabaseUrl } from '../src/server/database-url';

const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: getDatabaseUrl() }),
});

const enc = (value: string) => {
  const encrypted = encryptText(value);
  return {
    cipher: encrypted.cipher,
    iv: encrypted.iv,
    tag: encrypted.tag,
  };
};

async function main() {
  await db.highlightFeedback.deleteMany();
  await db.featureWeight.deleteMany();
  await db.comment.deleteMany();
  await db.task.deleteMany();
  await db.entryRelation.deleteMany();
  await db.highlight.deleteMany();
  await db.archiveBlob.deleteMany();
  await db.entryVersion.deleteMany();
  await db.entry.deleteMany();
  await db.sourceArtifact.deleteMany();
  await db.glanceCache.deleteMany();
  await db.eventOutbox.deleteMany();
  await db.auditEvent.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.patient.deleteMany();
  await db.clinic.deleteMany();

  await db.clinic.createMany({
    data: [
      { id: 'clinic-central', name: 'Central Clinic' },
      { id: 'clinic-north', name: 'North Clinic' },
    ],
  });

  await db.patient.createMany({
    data: [
      {
        id: 'patient-maya',
        clinicId: 'clinic-central',
        displayName: 'Maya Tan',
        birthYear: 1990,
        recordNumber: 'SYN-C-0001',
        lastContactAt: new Date('2026-08-25T09:18:00+08:00'),
      },
      {
        id: 'patient-north',
        clinicId: 'clinic-north',
        displayName: 'Jordan Lee',
        birthYear: 1978,
        recordNumber: 'SYN-N-0001',
        lastContactAt: new Date('2026-08-20T11:00:00+08:00'),
      },
    ],
  });

  await db.user.createMany({
    data: [
      { id: 'user-patient', clinicId: 'clinic-central', patientId: 'patient-maya', role: 'patient', displayName: 'Maya Tan', email: 'maya@example.test' },
      { id: 'user-staff', clinicId: 'clinic-central', role: 'staff', displayName: 'Aisha Rahman', email: 'aisha@example.test' },
      { id: 'user-clinician', clinicId: 'clinic-central', role: 'clinician', displayName: 'Dr. Evan Lim', email: 'evan@example.test' },
      { id: 'user-admin', clinicId: 'clinic-central', role: 'admin', displayName: 'Sara Chen', email: 'sara@example.test' },
      { id: 'user-north-staff', clinicId: 'clinic-north', role: 'staff', displayName: 'Noah Wong', email: 'noah@example.test' },
    ],
  });

  const rawPatient = 'Maya Tan S1234567D called from +65 9123 4567 and reported nightly cough.';
  const redactedPatient = '[NAME] [ID] called from [PHONE] and reported nightly cough.';
  const rawEncrypted = enc(rawPatient);
  const redactedEncrypted = enc(redactedPatient);
  await db.sourceArtifact.create({
    data: {
      id: 'artifact-ai-patient-1',
      clinicId: 'clinic-central',
      patientId: 'patient-maya',
      sessionRef: 'ai-session-20260825-0842',
      interactionType: 'ai_patient',
      rawCipher: rawEncrypted.cipher,
      rawIv: rawEncrypted.iv,
      rawTag: rawEncrypted.tag,
      redactedCipher: redactedEncrypted.cipher,
      redactedIv: redactedEncrypted.iv,
      redactedTag: redactedEncrypted.tag,
      redactionMetadata: JSON.stringify({ names: 1, ids: 1, phones: 1 }),
      createdAt: new Date('2026-08-25T08:42:00+08:00'),
    },
  });

  const rawDoctor = 'Doctor-patient consult: nocturnal symptoms increased; inhaler technique reviewed.';
  const doctorEncrypted = enc(rawDoctor);
  await db.sourceArtifact.create({
    data: {
      id: 'artifact-ai-doctor-1',
      clinicId: 'clinic-central',
      patientId: 'patient-maya',
      sessionRef: 'doctor-session-20260825-0910',
      interactionType: 'doctor_patient',
      rawCipher: doctorEncrypted.cipher,
      rawIv: doctorEncrypted.iv,
      rawTag: doctorEncrypted.tag,
      redactedCipher: doctorEncrypted.cipher,
      redactedIv: doctorEncrypted.iv,
      redactedTag: doctorEncrypted.tag,
      redactionMetadata: JSON.stringify({ names: 0, ids: 0, phones: 0 }),
      createdAt: new Date('2026-08-25T09:10:00+08:00'),
    },
  });

  const entries = [
    {
      id: 'entry-clinician-plan', authorId: 'user-clinician', authorRole: 'clinician', type: 'clinician_note', visibility: 'internal', section: 'assessment_plan', riskLevel: 'high', currentVersion: 2, createdAt: new Date('2026-08-18T10:00:00+08:00'), updatedAt: new Date('2026-08-25T09:18:00+08:00'), sourceArtifactId: null,
    },
    {
      id: 'entry-ai-patient', authorId: null, authorRole: 'system', type: 'ai_patient_session_summary', visibility: 'internal', section: 'patient_context', riskLevel: 'medium', currentVersion: 1, createdAt: new Date('2026-08-25T08:42:00+08:00'), updatedAt: new Date('2026-08-25T08:42:00+08:00'), sourceArtifactId: 'artifact-ai-patient-1',
    },
    {
      id: 'entry-ai-doctor', authorId: null, authorRole: 'system', type: 'ai_doctor_consult_summary', visibility: 'internal', section: 'consult_summary', riskLevel: 'medium', currentVersion: 1, createdAt: new Date('2026-08-25T09:10:00+08:00'), updatedAt: new Date('2026-08-25T09:10:00+08:00'), sourceArtifactId: 'artifact-ai-doctor-1',
    },
    {
      id: 'entry-staff-followup', authorId: 'user-staff', authorRole: 'staff', type: 'staff_note', visibility: 'internal', section: 'coordination', riskLevel: 'low', currentVersion: 1, createdAt: new Date('2026-08-21T16:05:00+08:00'), updatedAt: new Date('2026-08-21T16:05:00+08:00'), sourceArtifactId: null,
    },
    {
      id: 'entry-patient-instructions', authorId: 'user-clinician', authorRole: 'clinician', type: 'patient_instruction', visibility: 'patient', section: 'instructions', riskLevel: 'medium', currentVersion: 1, createdAt: new Date('2026-08-25T09:20:00+08:00'), updatedAt: new Date('2026-08-25T09:20:00+08:00'), sourceArtifactId: null,
    },
    {
      id: 'entry-archive-candidate', authorId: 'user-staff', authorRole: 'staff', type: 'staff_note', visibility: 'internal', section: 'historic_admin', riskLevel: 'low', currentVersion: 1, createdAt: new Date('2025-04-15T09:00:00+08:00'), updatedAt: new Date('2025-04-15T09:00:00+08:00'), sourceArtifactId: null,
    },
  ];

  for (const entry of entries) {
    await db.entry.create({ data: { ...entry, clinicId: 'clinic-central', patientId: 'patient-maya' } });
  }

  const versionData = [
    { id: 'version-plan-1', entryId: 'entry-clinician-plan', version: 1, author: 'user-clinician', content: 'Known penicillin allergy. Continue controller inhaler. Review after spirometry.', createdAt: new Date('2026-08-18T10:00:00+08:00') },
    { id: 'version-plan-2', entryId: 'entry-clinician-plan', version: 2, author: 'user-clinician', content: 'Known penicillin allergy must be confirmed before prescribing. Continue controller inhaler. Order HbA1c and renal panel before the next review.', createdAt: new Date('2026-08-25T09:18:00+08:00') },
    { id: 'version-ai-patient-1', entryId: 'entry-ai-patient', version: 1, author: null, content: 'Patient reports night cough increased from twice weekly to nightly, two missed workdays, and uncertainty about inhaler technique.', createdAt: new Date('2026-08-25T08:42:00+08:00') },
    { id: 'version-ai-doctor-1', entryId: 'entry-ai-doctor', version: 1, author: null, content: 'Post-consult summary: symptoms suggest worsening nocturnal asthma. Inhaler technique reviewed and spirometry planned.', createdAt: new Date('2026-08-25T09:10:00+08:00') },
    { id: 'version-staff-1', entryId: 'entry-staff-followup', version: 1, author: 'user-staff', content: 'Spirometry slot held for Friday. Waiting for the patient to confirm availability.', createdAt: new Date('2026-08-21T16:05:00+08:00') },
    { id: 'version-instructions-1', entryId: 'entry-patient-instructions', version: 1, author: 'user-clinician', content: 'Continue your controller inhaler daily. Seek urgent care if breathing becomes difficult at rest.', createdAt: new Date('2026-08-25T09:20:00+08:00') },
    { id: 'version-archive-1', entryId: 'entry-archive-candidate', version: 1, author: 'user-staff', content: 'Historic appointment reminder was completed with no unresolved clinical action.', createdAt: new Date('2025-04-15T09:00:00+08:00') },
  ];

  for (const version of versionData) {
    const encrypted = enc(version.content);
    await db.entryVersion.create({
      data: {
        id: version.id,
        entryId: version.entryId,
        version: version.version,
        contentCipher: encrypted.cipher,
        contentIv: encrypted.iv,
        contentTag: encrypted.tag,
        contentHash: sha256(version.content),
        createdById: version.author,
        createdAt: version.createdAt,
      },
    });
  }

  const taskOne = enc('Confirm spirometry slot');
  const taskTwo = enc('Order HbA1c and renal panel');
  await db.task.createMany({
    data: [
      { id: 'task-spirometry', patientId: 'patient-maya', entryId: 'entry-staff-followup', assignedToId: 'user-staff', titleCipher: taskOne.cipher, titleIv: taskOne.iv, titleTag: taskOne.tag, status: 'open', dueAt: new Date('2026-08-26T17:00:00+08:00'), riskLevel: 'medium' },
      { id: 'task-labs', patientId: 'patient-maya', entryId: 'entry-clinician-plan', assignedToId: 'user-staff', titleCipher: taskTwo.cipher, titleIv: taskTwo.iv, titleTag: taskTwo.tag, status: 'open', dueAt: new Date('2026-08-28T12:00:00+08:00'), riskLevel: 'medium' },
    ],
  });

  const commentText = enc('@clinician Please confirm whether the lab order should include fasting glucose.');
  await db.comment.create({
    data: {
      id: 'comment-staff-1',
      entryId: 'entry-staff-followup',
      authorId: 'user-staff',
      assignedToId: 'user-clinician',
      bodyCipher: commentText.cipher,
      bodyIv: commentText.iv,
      bodyTag: commentText.tag,
      status: 'open',
      createdAt: new Date('2026-08-25T09:30:00+08:00'),
    },
  });

  const highlights = [
    { id: 'highlight-allergy', entryId: 'entry-clinician-plan', versionId: 'version-plan-2', artifactId: null, start: 6, end: 59, kind: 'risk', summary: 'Penicillin allergy must be confirmed before prescribing', reason: 'Clinician-confirmed allergy with prescribing impact', risk: 'critical', entity: 'allergy', feature: 'entity:allergy', status: 'accepted', base: 92, learned: 4, final: 96 },
    { id: 'highlight-labs', entryId: 'entry-clinician-plan', versionId: 'version-plan-2', artifactId: null, start: 88, end: 136, kind: 'task', summary: 'Order HbA1c and renal panel before the next review', reason: 'Unresolved task due this week', risk: 'medium', entity: 'medication', feature: 'task:lab_order', status: 'accepted', base: 78, learned: 2, final: 80 },
    { id: 'highlight-cough', entryId: 'entry-ai-patient', versionId: 'version-ai-patient-1', artifactId: 'artifact-ai-patient-1', start: 16, end: 67, kind: 'change', summary: 'Night cough increased from twice weekly to nightly', reason: 'Recent patient-reported symptom change; awaiting clinician confirmation', risk: 'medium', entity: 'chief_complaint', feature: 'topic:respiratory', status: 'suggested', base: 70, learned: 0, final: 70 },
  ];

  for (const highlight of highlights) {
    const summary = enc(highlight.summary);
    const reason = enc(highlight.reason);
    await db.highlight.create({
      data: {
        id: highlight.id,
        patientId: 'patient-maya',
        entryId: highlight.entryId,
        entryVersionId: highlight.versionId,
        sourceArtifactId: highlight.artifactId,
        startOffset: highlight.start,
        endOffset: highlight.end,
        kind: highlight.kind,
        summaryCipher: summary.cipher,
        summaryIv: summary.iv,
        summaryTag: summary.tag,
        riskReasonCipher: reason.cipher,
        riskReasonIv: reason.iv,
        riskReasonTag: reason.tag,
        riskLevel: highlight.risk,
        entityType: highlight.entity,
        featureKey: highlight.feature,
        status: highlight.status,
        baseScore: highlight.base,
        learnedScore: highlight.learned,
        finalScore: highlight.final,
      },
    });
  }

  console.log('Seeded two clinics and the synthetic Nightingale demo record.');
}

main()
  .finally(async () => db.$disconnect());
