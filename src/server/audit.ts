import 'server-only';
import type { Prisma } from '@/generated/prisma/client';

type DatabaseClient = Prisma.TransactionClient;

export async function recordAudit(
  tx: DatabaseClient,
  input: {
    clinicId: string;
    patientId?: string | null;
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    fromVersion?: number | null;
    toVersion?: number | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
) {
  await tx.auditEvent.create({
    data: {
      id: crypto.randomUUID(),
      clinicId: input.clinicId,
      patientId: input.patientId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      fromVersion: input.fromVersion,
      toVersion: input.toVersion,
      metadataJson: JSON.stringify(input.metadata ?? {}),
    },
  });
}

export async function emitPatientEvent(
  tx: DatabaseClient,
  input: {
    clinicId: string;
    patientId: string;
    eventType: string;
    entityId: string;
    version?: number;
  },
) {
  await tx.eventOutbox.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      eventType: input.eventType,
      payloadJson: JSON.stringify({ entityId: input.entityId, version: input.version }),
    },
  });
}
