import { resolve } from 'node:path';

export function getDatabasePath() {
  const configured = process.env.DATABASE_URL ?? 'file:../data/nightingale.db';
  if (!configured.startsWith('file:')) {
    throw new Error('Nightingale requires a local SQLite file DATABASE_URL.');
  }

  const filePath = decodeURIComponent(configured.slice('file:'.length));
  if (filePath.startsWith('/')) return filePath;
  if (filePath.startsWith('../')) return resolve(process.cwd(), 'prisma', filePath);
  return resolve(/* turbopackIgnore: true */ process.cwd(), filePath);
}

export function getDatabaseUrl() {
  return `file:${getDatabasePath()}`;
}
