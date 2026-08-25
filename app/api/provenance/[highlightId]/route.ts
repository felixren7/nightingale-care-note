import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/server/db';
import { routeError, notFound } from '@/src/server/http';
import { canViewEntry } from '@/src/server/rbac';
import { requireSession } from '@/src/server/session';
import { readVersionContent } from '@/src/server/version-content';

export async function GET(request: NextRequest, { params }: { params: Promise<{ highlightId: string }> }) {
  try {
    const user = await requireSession(request);
    const { highlightId } = await params;
    const highlight = await db.highlight.findUnique({
      where: { id: highlightId },
      include: { entry: true, entryVersion: true, sourceArtifact: true },
    });
    if (!highlight || !canViewEntry(user, highlight.entry)) notFound();
    const content = await readVersionContent(highlight.entryVersion);
    return NextResponse.json({
      pointer: {
        entryId: highlight.entryId,
        versionId: highlight.entryVersionId,
        version: highlight.entryVersion.version,
        startOffset: highlight.startOffset,
        endOffset: highlight.endOffset,
        sourceArtifactId: highlight.sourceArtifactId,
      },
      source: {
        content,
        exactSpan: content.slice(highlight.startOffset, highlight.endOffset),
        sessionRef: highlight.sourceArtifact?.sessionRef,
        interactionType: highlight.sourceArtifact?.interactionType,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
