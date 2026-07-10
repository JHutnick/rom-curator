import { access } from 'node:fs/promises';
import path from 'node:path';
import { CONSOLES } from './consoleConfig';
import type { ConsoleId } from '../shared/types';

/** Checks, per console, whether its expected DAT file is present in the given folder. */
export async function checkDatFiles(datFolder: string): Promise<Record<ConsoleId, boolean>> {
  const entries = await Promise.all(
    CONSOLES.map(async (c) => {
      try {
        await access(path.join(datFolder, c.datFile));
        return [c.id, true] as const;
      } catch {
        return [c.id, false] as const;
      }
    }),
  );
  return Object.fromEntries(entries) as Record<ConsoleId, boolean>;
}
