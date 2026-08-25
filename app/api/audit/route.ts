import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/server/db';
import { HttpError, routeError } from '@/src/server/http';
import { requireSession } from '@/src/server/session';

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request);
    if (user.role !== 'admin' || !user.clinicId) throw new HttpError(403, 'ADMIN_REQUIRED', 'Clinic admin access required.');
    const patientId = request.nextUrl.searchParams.get('patientId') ?? undefined;
    const events = await db.auditEvent.findMany({
      where: { clinicId: user.clinicId, patientId },
      select: { id: true, patientId: true, actorId: true, action: true, entityType: true, entityId: true, fromVersion: true, toVersion: true, metadataJson: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ events: events.map((event) => ({ ...event, metadata: JSON.parse(event.metadataJson), metadataJson: undefined })) });
  } catch (error) {
    return routeError(error);
  }
}
