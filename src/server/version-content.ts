import 'server-only';
import { decryptText, sha256 } from '@/src/core/crypto';
import { readArchiveFile } from '@/src/core/archive';
import { db } from './db';

type VersionContent = {
  id: string;
  contentCipher: string;
  contentIv: string;
  contentTag: string;
  contentHash: string;
};

export async function readVersionContent(version: VersionContent) {
  let encrypted = { cipher: version.contentCipher, iv: version.contentIv, tag: version.contentTag };
  if (version.contentCipher === '__ARCHIVED__') {
    const archive = await db.archiveBlob.findUnique({ where: { entryVersionId: version.id } });
    if (!archive) throw new Error(`Missing archive metadata for version ${version.id}.`);
    const payload = await readArchiveFile(archive.path, archive.sha256);
    encrypted = { cipher: payload.cipher, iv: payload.iv, tag: payload.tag };
  }
  const content = decryptText(encrypted);
  if (sha256(content) !== version.contentHash) throw new Error(`Content hash mismatch for version ${version.id}.`);
  return content;
}
