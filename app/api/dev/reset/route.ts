import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';
import { HttpError, routeError } from '@/src/server/http';
import { requireSession } from '@/src/server/session';

export const runtime = 'nodejs';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE !== 'true') {
      throw new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.');
    }
    const user = await requireSession(request);
    if (user.role !== 'admin') {
      throw new HttpError(403, 'ADMIN_REQUIRED', 'Clinic admin access required.');
    }

    const projectRoot = process.cwd();
    await execFileAsync(
      process.execPath,
      [path.join(projectRoot, 'node_modules/tsx/dist/cli.mjs'), path.join(projectRoot, 'prisma/seed.ts')],
      {
        cwd: projectRoot,
        env: process.env,
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      },
    );
    return NextResponse.json({ reset: true });
  } catch (error) {
    return routeError(error);
  }
}
