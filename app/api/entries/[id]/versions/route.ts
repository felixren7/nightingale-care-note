import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/server/db';
import { routeError, notFound } from '@/src/server/http';
import { canViewEntry } from '@/src/server/rbac';
import { requireSession } from '@/src/server/session';
import { readVersionContent } from '@/src/server/version-content';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request);
    const { id } = await params;
    const entry = await db.entry.findUnique({ where: { id } });
    if (!entry || !canViewEntry(user, entry)) notFound();
    const rows = await db.entryVersion.findMany({ where: { entryId: id }, orderBy: { version: 'desc' } });
    return NextResponse.json({
      versions: await Promise.all(rows.map(async (row) => ({
        id: row.id,
        version: row.version,
        content: await readVersionContent(row),
        revertedFromVersion: row.revertedFromVersion,
        createdAt: row.createdAt.toISOString(),
      }))),
    });
  } catch (error) {
    return routeError(error);
  }
}
