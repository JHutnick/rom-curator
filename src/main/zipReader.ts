import { open } from 'node:fs/promises';

export interface ZipEntry {
  /** Filename as stored in the zip (may include a path prefix if the zip has subfolders). */
  filename: string;
  /** CRC32 of the *uncompressed* entry data — zip stores this natively, so no decompression needed. */
  crc32: string;
  uncompressedSize: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
const CENTRAL_DIR_HEADER_SIZE = 46;
const MAX_COMMENT_SIZE = 65535;

/**
 * Reads just the central directory of a zip file (filename/crc32/size per entry) —
 * deliberately does not decompress entry contents. No-Intro-style ROM zips store
 * the CRC32 of the *uncompressed* ROM data right in this directory, which is
 * exactly the value DAT files use, so this is all identification needs.
 */
export async function readZipEntries(zipPath: string): Promise<ZipEntry[]> {
  const handle = await open(zipPath, 'r');
  try {
    const stat = await handle.stat();
    const tailSize = Math.min(stat.size, EOCD_MIN_SIZE + MAX_COMMENT_SIZE);
    const tailBuf = Buffer.alloc(tailSize);
    await handle.read(tailBuf, 0, tailSize, stat.size - tailSize);

    let eocdOffset = -1;
    for (let i = tailBuf.length - EOCD_MIN_SIZE; i >= 0; i--) {
      if (tailBuf.readUInt32LE(i) === EOCD_SIGNATURE) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) {
      throw new Error(`Not a valid zip (no End Of Central Directory record found): ${zipPath}`);
    }

    const centralDirSize = tailBuf.readUInt32LE(eocdOffset + 12);
    const centralDirOffset = tailBuf.readUInt32LE(eocdOffset + 16);

    const centralDirBuf = Buffer.alloc(centralDirSize);
    await handle.read(centralDirBuf, 0, centralDirSize, centralDirOffset);

    const entries: ZipEntry[] = [];
    let pos = 0;
    while (pos + CENTRAL_DIR_HEADER_SIZE <= centralDirBuf.length) {
      if (centralDirBuf.readUInt32LE(pos) !== CENTRAL_DIR_SIGNATURE) break;

      const crc32 = centralDirBuf.readUInt32LE(pos + 16);
      const uncompressedSize = centralDirBuf.readUInt32LE(pos + 24);
      const filenameLen = centralDirBuf.readUInt16LE(pos + 28);
      const extraLen = centralDirBuf.readUInt16LE(pos + 30);
      const commentLen = centralDirBuf.readUInt16LE(pos + 32);
      const filename = centralDirBuf.toString(
        'utf-8',
        pos + CENTRAL_DIR_HEADER_SIZE,
        pos + CENTRAL_DIR_HEADER_SIZE + filenameLen,
      );

      entries.push({
        filename,
        crc32: (crc32 >>> 0).toString(16).padStart(8, '0'),
        uncompressedSize,
      });

      pos += CENTRAL_DIR_HEADER_SIZE + filenameLen + extraLen + commentLen;
    }
    return entries;
  } finally {
    await handle.close();
  }
}
