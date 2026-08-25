import { gzipSync, gunzipSync } from 'node:zlib';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { decryptText, encryptText, sha256, type EncryptedText } from './crypto';

export type ArchivedVersionPayload = EncryptedText & { contentHash: string };

function resolveArchivePath(relativePath: string) {
  const archiveRoot = path.resolve(process.cwd(), 'data', 'archive');
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!absolutePath.startsWith(`${archiveRoot}${path.sep}`)) throw new Error('Archive path escaped the archive root.');
  return { archiveRoot, absolutePath };
}

export async function writeArchiveFile(relativePath: string, payload: ArchivedVersionPayload) {
  const { archiveRoot, absolutePath } = resolveArchivePath(relativePath);
  await mkdir(archiveRoot, { recursive: true });
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const envelope = encryptText(compressed.toString('base64'));
  const serialized = JSON.stringify({ version: 1, algorithm: 'aes-256-gcm+gzip', envelope });
  await writeFile(absolutePath, serialized, { encoding: 'utf8', flag: 'wx' });
  const reread = await readFile(absolutePath);
  if (sha256(reread) !== sha256(serialized)) throw new Error('Archive verification failed after write.');
  return { sha256: sha256(reread), bytes: reread.byteLength };
}

export async function readArchiveFile(relativePath: string, expectedSha256: string): Promise<ArchivedVersionPayload> {
  const { absolutePath } = resolveArchivePath(relativePath);
  const serialized = await readFile(absolutePath);
  if (sha256(serialized) !== expectedSha256) throw new Error('Archive blob hash mismatch.');
  const parsed = JSON.parse(serialized.toString('utf8')) as { version: number; envelope: EncryptedText };
  if (parsed.version !== 1) throw new Error('Unsupported archive version.');
  const compressed = Buffer.from(decryptText(parsed.envelope), 'base64');
  return JSON.parse(gunzipSync(compressed).toString('utf8')) as ArchivedVersionPayload;
}
