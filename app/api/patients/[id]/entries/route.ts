import { NextRequest, NextResponse } from 'next/server';
import { createEntry } from '@/src/server/mutations';
import { routeError } from '@/src/server/http';
import { readJson } from '@/src/server/request';
import { requireSession } from '@/src/server/session';

type CreateEntryBody = {
  type: string;
  section: string;
  content: unknown;
  visibility?: string;
  riskLevel?: string;
  supersedesEntryId?: string;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request);
    const { id } = await params;
    const body = await readJson<CreateEntryBody>(request);
    return NextResponse.json(await createEntry(user, id, body), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
