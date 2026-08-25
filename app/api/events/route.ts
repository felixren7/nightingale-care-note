import { NextRequest } from 'next/server';
import { db } from '@/src/server/db';
import { routeError } from '@/src/server/http';
import { assertCanViewPatient } from '@/src/server/rbac';
import { requireSession } from '@/src/server/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request);
    const patientId = request.nextUrl.searchParams.get('patientId');
    if (!patientId) return Response.json({ error: { code: 'PATIENT_REQUIRED', message: 'patientId is required.' } }, { status: 400 });
    const patient = await db.patient.findUnique({ where: { id: patientId } });
    if (!patient) return Response.json({ error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } }, { status: 404 });
    assertCanViewPatient(user, patient);
    const after = Number(request.nextUrl.searchParams.get('after') ?? request.headers.get('last-event-id') ?? 0);
    const encoder = new TextEncoder();
    let cursor = Number.isFinite(after) ? after : 0;
    let stopped = false;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(': connected\n\n'));
        const poll = async () => {
          if (stopped) return;
          const events = await db.eventOutbox.findMany({ where: { patientId, id: { gt: cursor } }, orderBy: { id: 'asc' }, take: 50 });
          for (const event of events) {
            cursor = event.id;
            controller.enqueue(encoder.encode(`id: ${event.id}\nevent: ${event.eventType}\ndata: ${event.payloadJson}\n\n`));
          }
        };
        await poll();
        const interval = setInterval(() => { void poll().catch(() => undefined); }, 1000);
        setTimeout(() => {
          stopped = true;
          clearInterval(interval);
          try { controller.close(); } catch { /* client disconnected */ }
        }, 25_000);
      },
      cancel() { stopped = true; },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
