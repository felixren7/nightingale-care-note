import 'dotenv/config';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { encryptText, decryptText } from '@/src/core/crypto';
import { redactPhi } from '@/src/core/redaction';
import { runMockScribe } from '@/src/core/mock-scribe';
import { calculateImportance, feedbackDelta } from '@/src/core/importance';
import { readArchiveFile, writeArchiveFile } from '@/src/core/archive';

describe('security primitives', () => {
  it('round-trips AES-256-GCM ciphertext without retaining plaintext', () => {
    const plaintext = 'Synthetic clinical note: penicillin allergy.';
    const encrypted = encryptText(plaintext);
    expect(encrypted.cipher).not.toContain(plaintext);
    expect(decryptText(encrypted)).toBe(plaintext);
  });

  it('redacts name, Singapore ID and telephone before MockScribe', () => {
    const raw = 'Maya Tan S1234567D called +65 9123 4567 about nightly cough.';
    const result = runMockScribe('ai_patient', raw, ['Maya Tan']);
    expect(result.redaction.counts).toEqual({ names: 1, ids: 1, phones: 1 });
    expect(result.summary).toContain('[NAME]');
    expect(result.summary).toContain('[ID]');
    expect(result.summary).toContain('[PHONE]');
    expect(result.summary).not.toContain('Maya Tan');
    expect(result.summary).not.toContain('S1234567D');
    expect(result.summary).not.toContain('9123 4567');
  });

  it('handles direct redaction independently', () => {
    const result = redactPhi('Maya Tan at 8123-4567', ['Maya Tan']);
    expect(result.text).toBe('[NAME] at [PHONE]');
  });
});

describe('importance learning', () => {
  it('clamps learned feedback and retains an explainable base score', () => {
    const score = calculateImportance({ riskLevel: 'high', unresolvedTask: true, clinicianConfirmed: true, entityType: 'allergy', learnedWeight: 40 });
    expect(score.baseScore).toBe(95);
    expect(score.learnedScore).toBe(15);
    expect(score.finalScore).toBe(100);
    expect(feedbackDelta('pin')).toBe(2);
    expect(feedbackDelta('reject')).toBe(-2);
  });
});

describe('cold archive envelope', () => {
  it('gzip-compresses, encrypts, hashes and restores a version payload', async () => {
    const id = `vitest-${crypto.randomUUID()}.archive.json`;
    const relativePath = `data/archive/${id}`;
    const payload = { ...encryptText('old synthetic note'), contentHash: 'content-hash' };
    const written = await writeArchiveFile(relativePath, payload);
    try {
      expect(await readArchiveFile(relativePath, written.sha256)).toEqual(payload);
      await expect(readArchiveFile(relativePath, 'wrong-hash')).rejects.toThrow('hash mismatch');
    } finally {
      await unlink(path.resolve(process.cwd(), relativePath));
    }
  });
});
