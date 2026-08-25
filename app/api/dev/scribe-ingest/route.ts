import { NextRequest, NextResponse } from 'next/server';
import { ingestMockScribe } from '@/src/server/mutations';
import { routeError } from '@/src/server/http';
import { readJson } from '@/src/server/request';
import { requireSession } from '@/src/server/session';
import type { ScribeInteraction } from '@/src/core/mock-scribe';

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request);
    const body = await readJson<{ patientId: string; sessionRef: string; interactionType: ScribeInteraction; transcript: unknown }>(request);
    return NextResponse.json(await ingestMockScribe(user, body), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
