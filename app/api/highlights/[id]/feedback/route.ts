import { NextRequest, NextResponse } from 'next/server';
import { applyHighlightFeedback } from '@/src/server/mutations';
import { routeError } from '@/src/server/http';
import { readJson } from '@/src/server/request';
import { requireSession } from '@/src/server/session';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request);
    const { id } = await params;
    const body = await readJson<{ action: string }>(request);
    return NextResponse.json(await applyHighlightFeedback(user, id, body.action));
  } catch (error) {
    return routeError(error);
  }
}
