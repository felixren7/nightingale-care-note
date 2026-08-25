import { NextRequest, NextResponse } from 'next/server';
import { routeError } from '@/src/server/http';
import { readJson } from '@/src/server/request';
import {
  createDemoSession,
  getSessionUser,
  listDemoUsers,
  SESSION_COOKIE,
} from '@/src/server/session';

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ viewer: await getSessionUser(request), users: await listDemoUsers() });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<{ userId: string }>(request);
    const session = await createDemoSession(body.userId);
    const response = NextResponse.json({ viewer: session.user });
    response.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.SESSION_COOKIE_SECURE === 'true',
      path: '/',
      expires: session.expiresAt,
    });
    return response;
  } catch (error) {
    return routeError(error);
  }
}
