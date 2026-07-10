import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crc32Buffer, crc32File } from '../hasher';

describe('crc32Buffer', () => {
  it('matches the standard CRC-32/ISO-HDLC check value for "123456789"', () => {
    expect(crc32Buffer(Buffer.from('123456789'))).toBe('cbf43926');
  });

  it('returns 0 for an empty buffer', () => {
    expect(crc32Buffer(Buffer.from(''))).toBe('00000000');
  });

  it('matches a known value for "a"', () => {
    expect(crc32Buffer(Buffer.from('a'))).toBe('e8b7be43');
  });
});

describe('crc32File', () => {
  it('matches crc32Buffer for the same content, streamed from disk', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'rom-curator-hasher-'));
    const filePath = path.join(dir, 'sample.bin');
    const content = Buffer.from('the quick brown fox jumps over the lazy dog'.repeat(1000));
    await writeFile(filePath, content);

    const fromFile = await crc32File(filePath);
    const fromBuffer = crc32Buffer(content);

    expect(fromFile).toBe(fromBuffer);
    await rm(dir, { recursive: true, force: true });
  });
});
