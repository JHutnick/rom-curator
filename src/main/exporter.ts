import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { consoleById } from './consoleConfig';
import type { ConsoleId, ExportManifestEntry } from '../shared/types';

export interface ExportableRom {
  id: number;
  path: string;
  consoleId: ConsoleId;
  matchedName: string | null;
  filename: string;
  region: string | null;
}

function sanitizeForFilesystem(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').trim();
}

function destFilenameFor(rom: ExportableRom): string {
  // Extension must come from rom.path (the file actually being copied), not
  // rom.filename — for zip-wrapped roms those differ (e.g. filename is the
  // inner "Zoop (USA).sfc" but path is the outer "Zoop (USA).zip"), and using
  // the wrong one would copy zip bytes into a file named ".sfc".
  const ext = path.extname(rom.path);
  const nameExt = path.extname(rom.filename);
  const base = rom.matchedName
    ? sanitizeForFilesystem(rom.matchedName)
    : sanitizeForFilesystem(rom.filename.slice(0, rom.filename.length - nameExt.length));
  return `${base}${ext}`;
}

export interface ExportOutcome {
  manifest: ExportManifestEntry[];
  /** How many files were actually copied this run — the rest were already
   *  present from a prior export and got skipped, so re-exporting after
   *  curating a few more games doesn't re-copy the whole library every time. */
  copiedCount: number;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies (never moves) the given roms into `<destRoot>/<Console>/<clean name>.<ext>`
 * — the per-system folder layout RetroArch/ES-DE/Cocoon all auto-scan. Writes/updates
 * a manifest.json in destRoot so a future run can tell what's already been exported,
 * and skips re-copying a rom whose destination file is already there from a prior run.
 */
export async function exportRoms(destRoot: string, roms: ExportableRom[]): Promise<ExportOutcome> {
  const manifestPath = path.join(destRoot, 'manifest.json');
  const existing = await loadManifest(manifestPath);
  const byRomId = new Map(existing.map((e) => [e.romId, e]));

  let copiedCount = 0;
  for (const rom of roms) {
    const consoleDef = consoleById(rom.consoleId);
    const consoleDir = path.join(destRoot, consoleDef.label);
    const destPath = path.join(consoleDir, destFilenameFor(rom));

    const prior = byRomId.get(rom.id);
    const alreadyExported =
      prior?.sourcePath === rom.path && prior?.destPath === destPath && (await fileExists(destPath));

    if (!alreadyExported) {
      await mkdir(consoleDir, { recursive: true });
      await copyFile(rom.path, destPath);
      copiedCount++;
    }

    byRomId.set(rom.id, {
      romId: rom.id,
      sourcePath: rom.path,
      destPath,
      copiedAt: alreadyExported ? prior!.copiedAt : new Date().toISOString(),
    });
  }

  const manifest = Array.from(byRomId.values());
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  return { manifest, copiedCount };
}

async function loadManifest(manifestPath: string): Promise<ExportManifestEntry[]> {
  try {
    const raw = await readFile(manifestPath, 'utf-8');
    return JSON.parse(raw) as ExportManifestEntry[];
  } catch {
    return [];
  }
}
