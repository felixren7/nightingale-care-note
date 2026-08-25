import { NextRequest, NextResponse } from 'next/server';
import { revertEntry } from '@/src/server/mutations';
import { routeError } from '@/src/server/http';
import { readJson } from '@/src/server/request';
import { requireSession } from '@/src/server/session';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request);
    const { id } = await params;
    const body = await readJson<{ version: number; baseVersion: number }>(request);
    return NextResponse.json(await revertEntry(user, id, body));
  } catch (error) {
    return routeError(error);
  }
}
