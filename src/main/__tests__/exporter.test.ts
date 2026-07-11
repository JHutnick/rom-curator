import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { exportRoms, type ExportableRom } from '../exporter';
import type { ExportProgress } from '../../shared/types';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function freshDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rom-curator-export-'));
  dirs.push(dir);
  return dir;
}

describe('exportRoms progress reporting', () => {
  it('reports one progress event per rom, in order, before each copy', async () => {
    const srcDir = await freshDir();
    const destDir = await freshDir();
    const romA = path.join(srcDir, 'a.nes');
    const romB = path.join(srcDir, 'b.nes');
    await writeFile(romA, 'rom-a');
    await writeFile(romB, 'rom-b');

    const roms: ExportableRom[] = [
      { id: 1, path: romA, consoleId: 'nes', matchedName: 'Game A', filename: 'a.nes', region: 'USA' },
      { id: 2, path: romB, consoleId: 'nes', matchedName: 'Game B', filename: 'b.nes', region: 'USA' },
    ];

    const events: ExportProgress[] = [];
    await exportRoms(destDir, roms, (p) => events.push(p));

    expect(events).toEqual([
      { current: 1, total: 2, filename: 'a.nes' },
      { current: 2, total: 2, filename: 'b.nes' },
    ]);
  });

  it('works without a progress callback (optional param)', async () => {
    const srcDir = await freshDir();
    const destDir = await freshDir();
    const romA = path.join(srcDir, 'a.nes');
    await writeFile(romA, 'rom-a');

    const roms: ExportableRom[] = [
      { id: 1, path: romA, consoleId: 'nes', matchedName: 'Game A', filename: 'a.nes', region: 'USA' },
    ];

    const outcome = await exportRoms(destDir, roms);
    expect(outcome.copiedCount).toBe(1);
  });
});
