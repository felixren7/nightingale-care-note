import { NextRequest, NextResponse } from 'next/server';
import { getCareNote } from '@/src/server/care-note';
import { routeError } from '@/src/server/http';
import { requireSession } from '@/src/server/session';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request);
    const { id } = await params;
    return NextResponse.json(await getCareNote(user, id));
  } catch (error) {
    return routeError(error);
  }
}
