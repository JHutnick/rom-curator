import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { CONSOLES, matchesDatFilename, type ConsoleDef } from './consoleConfig';
import type { ConsoleId } from '../shared/types';

/**
 * Finds the actual DAT file for a console in the given folder, tolerating the
 * descriptive filenames No-Intro/Redump downloads actually come with (see
 * matchesDatFilename). Returns the full path, or null if nothing matches.
 */
export async function findDatFilePath(datFolder: string, consoleDef: ConsoleDef): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(datFolder);
  } catch {
    return null;
  }
  const match = entries.find((f) => matchesDatFilename(f, consoleDef));
  return match ? path.join(datFolder, match) : null;
}

/** Checks, per console, whether a matching DAT file is present in the given folder. */
export async function checkDatFiles(datFolder: string): Promise<Record<ConsoleId, boolean>> {
  let entries: string[];
  try {
    entries = await readdir(datFolder);
  } catch {
    entries = [];
  }
  const result = {} as Record<ConsoleId, boolean>;
  for (const c of CONSOLES) {
    result[c.id] = entries.some((f) => matchesDatFilename(f, c));
  }
  return result;
}
