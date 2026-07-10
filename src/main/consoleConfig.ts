import type { ConsoleId } from '../shared/types';

export interface ConsoleDef {
  id: ConsoleId;
  label: string;
  extensions: string[];
  /** Full-file CRC32 hashing is cheap for these (cartridge dumps, small files). */
  hashOnScan: boolean;
  /** IGDB platform id, used to scope searches and avoid matching the wrong platform's release. */
  igdbPlatformId: number;
  /** No-Intro/Redump DAT filename expected in the configured DAT folder. */
  datFile: string;
}

export const CONSOLES: ConsoleDef[] = [
  {
    id: 'nes',
    label: 'NES',
    extensions: ['.nes'],
    hashOnScan: true,
    igdbPlatformId: 18,
    datFile: 'Nintendo - Nintendo Entertainment System.dat',
  },
  {
    id: 'snes',
    label: 'SNES',
    extensions: ['.sfc', '.smc'],
    hashOnScan: true,
    igdbPlatformId: 19,
    datFile: 'Nintendo - Super Nintendo Entertainment System.dat',
  },
  {
    id: 'n64',
    label: 'N64',
    extensions: ['.n64', '.z64', '.v64'],
    hashOnScan: true,
    igdbPlatformId: 4,
    datFile: 'Nintendo - Nintendo 64.dat',
  },
  {
    id: 'gba',
    label: 'Game Boy Advance',
    extensions: ['.gba'],
    hashOnScan: true,
    igdbPlatformId: 24,
    datFile: 'Nintendo - Game Boy Advance.dat',
  },
  {
    id: 'genesis',
    label: 'Genesis / Mega Drive',
    // .bin deliberately excluded: it's ambiguous with PS1 bin/cue dumps, and Genesis
    // dumps in practice are almost always .md/.gen/.smd.
    extensions: ['.md', '.gen', '.smd'],
    hashOnScan: true,
    igdbPlatformId: 29,
    datFile: 'Sega - Mega Drive - Genesis.dat',
  },
  {
    id: 'ps1',
    label: 'PlayStation',
    extensions: ['.cue', '.bin', '.chd', '.iso', '.pbp'],
    hashOnScan: false,
    igdbPlatformId: 7,
    datFile: 'Sony - PlayStation.dat',
  },
];

export function consoleForExtension(ext: string): ConsoleDef | null {
  const lower = ext.toLowerCase();
  return CONSOLES.find((c) => c.extensions.includes(lower)) ?? null;
}

export function consoleById(id: ConsoleId): ConsoleDef {
  const def = CONSOLES.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown console id: ${id}`);
  return def;
}
