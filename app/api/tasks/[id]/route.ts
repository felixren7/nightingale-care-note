import { NextRequest, NextResponse } from 'next/server';
import { patchTask } from '@/src/server/mutations';
import { routeError } from '@/src/server/http';
import { readJson } from '@/src/server/request';
import { requireSession } from '@/src/server/session';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request);
    const { id } = await params;
    const body = await readJson<{ status: string }>(request);
    return NextResponse.json(await patchTask(user, id, body.status));
  } catch (error) {
    return routeError(error);
  }
}
