import { createReadStream } from 'node:fs';

// CRC32 lookup table (standard polynomial 0xEDB88320), built once at module load.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC32 of an in-memory buffer, returned as lowercase 8-char hex. */
export function crc32Buffer(buf: Buffer | Uint8Array): string {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  return crc.toString(16).padStart(8, '0');
}

/** CRC32 of a file, streamed in chunks so large files don't blow up memory. */
export function crc32File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let crc = 0xffffffff;
    const stream = createReadStream(filePath);
    stream.on('data', (chunk: string | Buffer) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      for (let i = 0; i < buf.length; i++) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
      }
    });
    stream.on('end', () => {
      crc = (crc ^ 0xffffffff) >>> 0;
      resolve(crc.toString(16).padStart(8, '0'));
    });
    stream.on('error', reject);
  });
}
