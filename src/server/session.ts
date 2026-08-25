import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type { Role, SessionUser } from '@/src/core/types';
import { db } from './db';
import { HttpError } from './http';

export const SESSION_COOKIE = 'nightingale_session';
export const DEMO_USER_IDS = [
  'user-patient',
  'user-staff',
  'user-clinician',
  'user-admin',
  'user-north-staff',
] as const;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function safeUser(user: {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  role: string;
  displayName: string;
}): SessionUser {
  return {
    id: user.id,
    clinicId: user.clinicId,
    patientId: user.patientId,
    role: user.role as Role,
    displayName: user.displayName,
  };
}

export async function createDemoSession(userId: string) {
  if (!DEMO_USER_IDS.includes(userId as (typeof DEMO_USER_IDS)[number])) {
    throw new HttpError(400, 'INVALID_DEMO_USER', 'Unknown demo user.');
  }
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(400, 'INVALID_DEMO_USER', 'Unknown demo user.');

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
  await db.session.create({
    data: { idHash: hashToken(token), userId, expiresAt },
  });
  return { token, expiresAt, user: safeUser(user) };
}

export async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { idHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return safeUser(session.user);
}

export async function requireSession(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) throw new HttpError(401, 'UNAUTHENTICATED', 'Select a demo role to continue.');
  return user;
}

export async function listDemoUsers() {
  const users = await db.user.findMany({
    where: { id: { in: [...DEMO_USER_IDS] } },
    select: { id: true, role: true, displayName: true, clinicId: true, patientId: true },
    orderBy: { id: 'asc' },
  });
  return users.map(safeUser);
}
