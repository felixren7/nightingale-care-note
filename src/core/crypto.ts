import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type EncryptedText = {
  cipher: string;
  iv: string;
  tag: string;
};

function getKey() {
  const encoded = process.env.DATA_ENCRYPTION_KEY;
  if (!encoded) throw new Error('DATA_ENCRYPTION_KEY is required. Run npm run setup.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to 32 bytes.');
  return key;
}

export function encryptText(value: string): EncryptedText {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    cipher: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptText(value: EncryptedText) {
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(value.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(value.cipher, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function sha256(value: string | Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
