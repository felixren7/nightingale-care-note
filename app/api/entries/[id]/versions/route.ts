import { NextRequest, NextResponse } from 'next/server';
import { decryptText } from '@/src/core/crypto';
import { db } from '@/src/server/db';
import { routeError, notFound } from '@/src/server/http';
import { canViewEntry } from '@/src/server/rbac';
import { requireSession } from '@/src/server/session';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request);
    const { id } = await params;
    const entry = await db.entry.findUnique({ where: { id } });
    if (!entry || !canViewEntry(user, entry)) notFound();
    const rows = await db.entryVersion.findMany({ where: { entryId: id }, orderBy: { version: 'desc' } });
    return NextResponse.json({
      versions: rows.map((row) => ({
        id: row.id,
        version: row.version,
        content: row.contentCipher === '__ARCHIVED__'
          ? '[Cold archived — provenance retained]'
          : decryptText({ cipher: row.contentCipher, iv: row.contentIv, tag: row.contentTag }),
        revertedFromVersion: row.revertedFromVersion,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return routeError(error);
  }
}
