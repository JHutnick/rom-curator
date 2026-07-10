import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crc32Buffer } from '../hasher';
import { readZipEntries } from '../zipReader';

/** Hand-builds a minimal valid zip (STORED/uncompressed entries) — no external
 *  zip library needed just to produce a fixture for the reader to parse. */
function buildStoredZip(entries: { filename: string; data: Buffer }[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const { filename, data } of entries) {
    const nameBuf = Buffer.from(filename, 'utf-8');
    const crc = parseInt(crc32Buffer(data), 16);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(0, 8); // method: stored
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0, 12); // mod date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18); // compressed size
    localHeader.writeUInt32LE(data.length, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra length

    const localEntry = Buffer.concat([localHeader, nameBuf, data]);
    localParts.push(localEntry);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(0, 10); // method
    centralHeader.writeUInt16LE(0, 12); // time
    centralHeader.writeUInt16LE(0, 14); // date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20); // compressed size
    centralHeader.writeUInt32LE(data.length, 24); // uncompressed size
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // local header offset

    centralParts.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localEntry.length;
  }

  const localSection = Buffer.concat(localParts);
  const centralSection = Buffer.concat(centralParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSection.length, 12);
  eocd.writeUInt32LE(localSection.length, 16); // central dir offset = end of local section
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localSection, centralSection, eocd]);
}

describe('readZipEntries', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('reads filename, CRC32, and uncompressed size for a single-entry zip', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'rom-curator-zip-'));
    const romData = Buffer.from('FAKE SNES ROM CONTENT'.repeat(200));
    const zipBuf = buildStoredZip([{ filename: 'Zoop (USA).sfc', data: romData }]);
    const zipPath = path.join(tmpDir, 'Zoop (USA).zip');
    await writeFile(zipPath, zipBuf);

    const entries = await readZipEntries(zipPath);
    expect(entries).toHaveLength(1);
    expect(entries[0].filename).toBe('Zoop (USA).sfc');
    expect(entries[0].crc32).toBe(crc32Buffer(romData));
    expect(entries[0].uncompressedSize).toBe(romData.length);
  });

  it('reads multiple entries from a single zip', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'rom-curator-zip-'));
    const a = Buffer.from('ROM A CONTENT');
    const b = Buffer.from('ROM B CONTENT, LONGER THIS TIME');
    const zipBuf = buildStoredZip([
      { filename: 'Game A.sfc', data: a },
      { filename: 'Game B.sfc', data: b },
    ]);
    const zipPath = path.join(tmpDir, 'multi.zip');
    await writeFile(zipPath, zipBuf);

    const entries = await readZipEntries(zipPath);
    expect(entries.map((e) => e.filename)).toEqual(['Game A.sfc', 'Game B.sfc']);
    expect(entries[0].crc32).toBe(crc32Buffer(a));
    expect(entries[1].crc32).toBe(crc32Buffer(b));
  });

  it('rejects a file with no End Of Central Directory record', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'rom-curator-zip-'));
    const notAZip = path.join(tmpDir, 'not-a-zip.zip');
    await writeFile(notAZip, Buffer.from('this is definitely not a zip file'));

    await expect(readZipEntries(notAZip)).rejects.toThrow();
  });
});
