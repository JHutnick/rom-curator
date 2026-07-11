import type { ConsoleId } from '../shared/types';

// Deliberately no `node:path` import here — this module is also bundled into
// the renderer (Vite, browser context) by src/renderer/ReviewScreen.tsx and
// SetupScreen.tsx, which have no Node built-ins available.
function basenameOf(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

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
    id: 'gb',
    label: 'Game Boy',
    extensions: ['.gb'],
    hashOnScan: true,
    igdbPlatformId: 33,
    datFile: 'Nintendo - Game Boy.dat',
  },
  {
    id: 'gbc',
    label: 'Game Boy Color',
    extensions: ['.gbc'],
    hashOnScan: true,
    igdbPlatformId: 22,
    datFile: 'Nintendo - Game Boy Color.dat',
  },
  {
    id: 'nds',
    label: 'Nintendo DS',
    extensions: ['.nds'],
    hashOnScan: true,
    igdbPlatformId: 20,
    datFile: 'Nintendo - Nintendo DS.dat',
  },
  {
    id: 'genesis',
    label: 'Genesis / Mega Drive',
    extensions: ['.md', '.gen', '.smd', '.bin'],
    hashOnScan: true,
    igdbPlatformId: 29,
    datFile: 'Sega - Mega Drive - Genesis.dat',
  },
  {
    id: 'mastersystem',
    label: 'Master System',
    extensions: ['.sms'],
    hashOnScan: true,
    igdbPlatformId: 64,
    datFile: 'Sega - Master System - Mark III.dat',
  },
  {
    id: 'gamegear',
    label: 'Game Gear',
    extensions: ['.gg'],
    hashOnScan: true,
    igdbPlatformId: 35,
    datFile: 'Sega - Game Gear.dat',
  },
  {
    id: 'pcengine',
    label: 'PC Engine / TurboGrafx-16',
    extensions: ['.pce'],
    hashOnScan: true,
    igdbPlatformId: 86,
    datFile: 'NEC - PC Engine - TurboGrafx-16.dat',
  },
  {
    id: 'atari2600',
    label: 'Atari 2600',
    extensions: ['.a26'],
    hashOnScan: true,
    igdbPlatformId: 59,
    datFile: 'Atari - 2600.dat',
  },
  {
    id: 'ps1',
    label: 'PlayStation',
    extensions: ['.cue', '.bin', '.chd', '.iso', '.pbp'],
    hashOnScan: false,
    igdbPlatformId: 7,
    datFile: 'Sony - PlayStation.dat',
  },
  {
    id: 'ps2',
    label: 'PlayStation 2',
    extensions: ['.iso', '.bin', '.cue', '.chd'],
    hashOnScan: false,
    igdbPlatformId: 8,
    datFile: 'Sony - PlayStation 2.dat',
  },
  {
    id: 'gamecube',
    label: 'GameCube',
    // .rvz/.gcz are Dolphin's compressed disc formats — not what Redump's DAT
    // catalogs, but filename-match doesn't care about container format, only
    // the extension-stripped name, so these still resolve correctly.
    extensions: ['.iso', '.rvz', '.gcz'],
    hashOnScan: false,
    igdbPlatformId: 21,
    datFile: 'Nintendo - GameCube.dat',
  },
  {
    id: 'dreamcast',
    label: 'Dreamcast',
    extensions: ['.cdi', '.gdi', '.chd'],
    hashOnScan: false,
    igdbPlatformId: 23,
    datFile: 'Sega - Dreamcast.dat',
  },
  {
    id: 'saturn',
    label: 'Saturn',
    extensions: ['.cue', '.bin', '.chd', '.iso'],
    hashOnScan: false,
    igdbPlatformId: 32,
    datFile: 'Sega - Saturn.dat',
  },
  {
    id: '3ds',
    label: 'Nintendo 3DS',
    // Cart dumps can run into several GB and are often encrypted — treated
    // like a disc console (filename-match, no hashing) rather than assuming
    // cartridge-sized like the other Nintendo handhelds.
    extensions: ['.3ds', '.cia'],
    hashOnScan: false,
    igdbPlatformId: 37,
    datFile: 'Nintendo - Nintendo 3DS.dat',
  },
  {
    id: 'psp',
    label: 'PSP',
    // .cso is a compressed UMD ISO (maxcso) — Redump's DAT only lists the raw
    // .iso, but filename-match doesn't care about container format, only the
    // extension-stripped name, so .cso dumps still resolve correctly.
    extensions: ['.iso', '.cso'],
    hashOnScan: false,
    igdbPlatformId: 38,
    datFile: 'Sony - PlayStation Portable.dat',
  },
  {
    id: '3do',
    label: '3DO',
    extensions: ['.iso', '.cue', '.bin', '.chd'],
    hashOnScan: false,
    igdbPlatformId: 50,
    datFile: 'Panasonic - 3DO Interactive Multiplayer.dat',
  },
  {
    id: 'atari5200',
    label: 'Atari 5200',
    extensions: ['.a52'],
    hashOnScan: true,
    igdbPlatformId: 66,
    datFile: 'Atari - 5200.dat',
  },
  {
    id: 'atari7800',
    label: 'Atari 7800',
    extensions: ['.a78'],
    hashOnScan: true,
    igdbPlatformId: 60,
    datFile: 'Atari - 7800.dat',
  },
  {
    id: 'lynx',
    label: 'Atari Lynx',
    extensions: ['.lnx'],
    hashOnScan: true,
    igdbPlatformId: 61,
    datFile: 'Atari - Lynx.dat',
  },
  {
    id: 'jaguar',
    label: 'Atari Jaguar',
    extensions: ['.j64'],
    hashOnScan: true,
    igdbPlatformId: 62,
    datFile: 'Atari - Jaguar.dat',
  },
];

/** Folder-basename hints for auto-suggesting a console when adding a ROM root
 *  in Setup — matches the short names common ROM-set tools/collections use
 *  (emulationstation, RetroArch playlists, etc.), including this app's own
 *  labels normalized the same way. */
const FOLDER_NAME_HINTS: Record<string, ConsoleId> = {
  nes: 'nes',
  snes: 'snes',
  sfc: 'snes',
  n64: 'n64',
  gba: 'gba',
  gb: 'gb',
  gbc: 'gbc',
  nds: 'nds',
  ds: 'nds',
  genesis: 'genesis',
  megadrive: 'genesis',
  md: 'genesis',
  mastersystem: 'mastersystem',
  sms: 'mastersystem',
  gamegear: 'gamegear',
  gg: 'gamegear',
  pcengine: 'pcengine',
  tg16: 'pcengine',
  turbografx: 'pcengine',
  turbografx16: 'pcengine',
  atari2600: 'atari2600',
  a2600: 'atari2600',
  2600: 'atari2600',
  psx: 'ps1',
  ps1: 'ps1',
  playstation: 'ps1',
  ps2: 'ps2',
  playstation2: 'ps2',
  gamecube: 'gamecube',
  gc: 'gamecube',
  ngc: 'gamecube',
  dreamcast: 'dreamcast',
  dc: 'dreamcast',
  saturn: 'saturn',
  '3ds': '3ds',
  n3ds: '3ds',
  psp: 'psp',
  '3do': '3do',
  atari5200: 'atari5200',
  a5200: 'atari5200',
  5200: 'atari5200',
  atari7800: 'atari7800',
  a7800: 'atari7800',
  7800: 'atari7800',
  lynx: 'lynx',
  atarilynx: 'lynx',
  jaguar: 'jaguar',
  atarijaguar: 'jaguar',
};

/** Normalizes a folder name for hint lookup: lowercase, strip non-alphanumerics. */
function normalizeFolderHintKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function guessConsoleFromFolderName(folderPath: string): ConsoleId | null {
  const base = normalizeFolderHintKey(basenameOf(folderPath));
  return FOLDER_NAME_HINTS[base] ?? null;
}

/** True if the given file extension is one this console's dumps normally use. */
export function extensionBelongsToConsole(ext: string, consoleId: ConsoleId): boolean {
  const def = consoleById(consoleId);
  return def.extensions.includes(ext.toLowerCase());
}

export function consoleById(id: ConsoleId): ConsoleDef {
  const def = CONSOLES.find((c) => c.id === id);
  if (!def) throw new Error(`Unknown console id: ${id}`);
  return def;
}

/**
 * No-Intro/Redump DAT downloads never keep the plain name we expect — they
 * come as e.g. "Sony - PlayStation 2 - Datfile (11774) (2026-06-15
 * 03-41-38).dat" or "Nintendo - ... (Parent-Clone) (20260614-014159).dat".
 * Requiring an exact filename match means the user has to manually rename
 * every single DAT file they ever download — so this matches by prefix
 * instead, as long as whatever follows the expected base name looks like a
 * metadata suffix (starts with " (" or " - ") rather than a genuinely
 * different, longer console name that happens to share a prefix (e.g. "Game
 * Boy" vs "Game Boy Advance", or "PlayStation" vs "PlayStation 2").
 */
export function matchesDatFilename(actualFilename: string, consoleDef: ConsoleDef): boolean {
  const lower = actualFilename.toLowerCase();
  if (!lower.endsWith('.dat')) return false;
  const base = consoleDef.datFile.replace(/\.dat$/i, '').toLowerCase();
  if (!lower.startsWith(base)) return false;
  const rest = lower.slice(base.length, lower.length - '.dat'.length);
  return rest === '' || rest.startsWith(' (') || rest.startsWith(' - ');
}
