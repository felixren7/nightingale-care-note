import { NextRequest, NextResponse } from 'next/server';
import { patchComment } from '@/src/server/mutations';
import { routeError } from '@/src/server/http';
import { readJson } from '@/src/server/request';
import { requireSession } from '@/src/server/session';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request);
    const { id } = await params;
    const body = await readJson<{ status?: string; assignedToId?: string | null }>(request);
    return NextResponse.json(await patchComment(user, id, body));
  } catch (error) {
    return routeError(error);
  }
}
