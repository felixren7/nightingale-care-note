import { NextRequest, NextResponse } from 'next/server';
import { addComment } from '@/src/server/mutations';
import { routeError } from '@/src/server/http';
import { readJson } from '@/src/server/request';
import { requireSession } from '@/src/server/session';

type CommentBody = {
  body: unknown;
  parentId?: string;
  assignedToId?: string;
  startOffset?: number;
  endOffset?: number;
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSession(request);
    const { id } = await params;
    const body = await readJson<CommentBody>(request);
    return NextResponse.json(await addComment(user, id, body), { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
