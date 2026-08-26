import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/server/db';
import { routeError, notFound } from '@/src/server/http';
import { canViewEntry } from '@/src/server/rbac';
import { requireSession } from '@/src/server/session';
import { readVersionContent } from '@/src/server/version-content';
import { diffWords } from 'diff';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request);
    const { id } = await params;
    const entry = await db.entry.findUnique({ where: { id } });
    if (!entry || !canViewEntry(user, entry)) notFound();
    const rows = await db.entryVersion.findMany({ where: { entryId: id }, orderBy: { version: 'desc' } });
    const contents = new Map<number, string>();
    await Promise.all(rows.map(async (row) => contents.set(row.version, await readVersionContent(row))));
    return NextResponse.json({ versions: rows.map((row) => {
      const content = contents.get(row.version) ?? '';
      const previous = contents.get(row.version - 1);
      return {
        id: row.id,
        version: row.version,
        content,
        changes: previous ? diffWords(previous, content).map(({ value, added, removed }) => ({ value, added: Boolean(added), removed: Boolean(removed) })) : [],
        revertedFromVersion: row.revertedFromVersion,
        createdAt: row.createdAt.toISOString(),
      };
    }) });
  } catch (error) {
    return routeError(error);
  }
}
