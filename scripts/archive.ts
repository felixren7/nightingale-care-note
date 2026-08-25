import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';
import { writeArchiveFile } from '../src/core/archive';
import { getDatabaseUrl } from '../src/server/database-url';

const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: getDatabaseUrl() }) });
const apply = process.argv.includes('--apply');
const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

async function main() {
  const candidates = await db.entryVersion.findMany({
    where: {
      createdAt: { lt: cutoff },
      contentCipher: { not: '__ARCHIVED__' },
      archive: null,
      entry: {
        riskLevel: 'low',
        supersedesEntryId: null,
        type: { notIn: ['clinician_correction', 'allergy', 'critical_risk'] },
        tasks: { none: { status: 'open' } },
      },
      highlights: { none: { OR: [{ status: 'pinned' }, { status: 'accepted' }, { riskLevel: { in: ['high', 'critical'] } }] } },
    },
    include: { entry: { select: { id: true, clinicId: true, patientId: true, type: true, currentVersion: true } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`${apply ? 'APPLY' : 'PREVIEW'}: ${candidates.length} cold-archive candidate(s) before ${cutoff.toISOString()}.`);
  for (const version of candidates) {
    console.log(`- ${version.entry.id} v${version.version} · ${version.entry.type} · ${version.createdAt.toISOString()}`);
    if (!apply) continue;
    const relativePath = `data/archive/${version.id}.archive.json`;
    const verified = await writeArchiveFile(relativePath, {
      cipher: version.contentCipher,
      iv: version.contentIv,
      tag: version.contentTag,
      contentHash: version.contentHash,
    });
    await db.$transaction(async (tx) => {
      await tx.archiveBlob.create({ data: { id: randomUUID(), entryVersionId: version.id, path: relativePath, sha256: verified.sha256 } });
      await tx.entryVersion.update({ where: { id: version.id }, data: { contentCipher: '__ARCHIVED__', contentIv: '', contentTag: '' } });
      if (version.version === version.entry.currentVersion) await tx.entry.update({ where: { id: version.entry.id }, data: { storageTier: 'cold' } });
      await tx.auditEvent.create({
        data: {
          id: randomUUID(), clinicId: version.entry.clinicId, patientId: version.entry.patientId, action: 'entry_version.archived', entityType: 'entry_version', entityId: version.id,
          fromVersion: version.version, toVersion: version.version, metadataJson: JSON.stringify({ bytes: verified.bytes, sha256: verified.sha256 }),
        },
      });
    });
  }
  if (!apply) console.log('No data changed. Run npm run archive:apply to archive eligible versions.');
}

main().finally(async () => db.$disconnect());
