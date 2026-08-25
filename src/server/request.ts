import type { NextRequest } from 'next/server';
import { HttpError } from './http';

export async function readJson<T>(request: NextRequest): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new HttpError(400, 'INVALID_JSON', 'A valid JSON request body is required.');
  }
}
