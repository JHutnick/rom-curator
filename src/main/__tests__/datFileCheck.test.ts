import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkDatFiles } from '../datFileCheck';
import { CONSOLES } from '../consoleConfig';

describe('checkDatFiles', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('reports found for present DAT files and false for missing ones', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'rom-curator-datcheck-'));
    const snesDat = CONSOLES.find((c) => c.id === 'snes')!.datFile;
    const nesDat = CONSOLES.find((c) => c.id === 'nes')!.datFile;
    await writeFile(path.join(dir, snesDat), 'fake dat content');

    const result = await checkDatFiles(dir);
    expect(result.snes).toBe(true);
    expect(result.nes).toBe(false);
    void nesDat;
  });

  it('covers every console in CONSOLES', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'rom-curator-datcheck-'));
    const result = await checkDatFiles(dir);
    for (const c of CONSOLES) {
      expect(result).toHaveProperty(c.id);
    }
  });

  it('returns all-false for a nonexistent folder rather than throwing', async () => {
    const result = await checkDatFiles('C:\\this\\path\\does\\not\\exist\\at\\all');
    expect(Object.values(result).every((v) => v === false)).toBe(true);
  });
});
