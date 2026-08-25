export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function notFound(): never {
  throw new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.');
}

export function routeError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  console.error('Request failed without exposing sensitive payloads.', {
    name: error instanceof Error ? error.name : 'UnknownError',
  });
  return Response.json(
    { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } },
    { status: 500 },
  );
}
