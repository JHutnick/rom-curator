export type ConsoleId =
  | 'nes'
  | 'snes'
  | 'n64'
  | 'gba'
  | 'genesis'
  | 'ps1'
  | 'atari2600'
  | 'gb'
  | 'gbc'
  | 'mastersystem'
  | 'gamegear'
  | 'pcengine'
  | 'nds'
  | 'ps2'
  | 'gamecube'
  | 'dreamcast'
  | 'saturn'
  | '3ds'
  | 'psp'
  | 'atari5200'
  | 'atari7800'
  | 'lynx'
  | 'jaguar'
  | '3do';

export type MatchConfidence = 'hash-verified' | 'filename-match' | 'translated-hack' | 'unmatched';

export type CurationStatus = 'undecided' | 'keep' | 'maybe' | 'skip';

export interface RomFile {
  id: number;
  path: string;
  filename: string;
  consoleId: ConsoleId;
  sizeBytes: number;
  crc32: string | null;
  matchedName: string | null;
  region: string | null;
  matchConfidence: MatchConfidence;
}

export interface IgdbInfo {
  igdbId: number;
  name: string;
  coverUrl?: string;
  releaseYear?: number;
  genres: string[];
  rating?: number;
  aggregatedRating?: number;
  ratingCount?: number;
  summary?: string;
}

export interface CuratedRom extends RomFile {
  igdb: IgdbInfo | null;
  status: CurationStatus;
}

/** A ROM folder tagged with the console it holds. Extensions like .bin/.cue/.iso
 *  are shared across several disc-based consoles (PS1/PS2/Saturn/Dreamcast), so
 *  scanning can't reliably guess the console from extension alone once there are
 *  more than a couple of disc systems configured — the folder's declared console
 *  is authoritative instead. */
export interface RomRoot {
  path: string;
  consoleId: ConsoleId;
}

export interface AppConfig {
  romRoots: RomRoot[];
  datFolder: string;
  destFolder: string;
  twitchClientId: string;
  twitchClientSecret: string;
}

export interface ScanProgress {
  phase: 'scanning' | 'identifying' | 'enriching' | 'done';
  current: number;
  total: number;
  message: string;
  /** Only meaningful during 'enriching' — computed from the exact count of
   *  remaining new IGDB lookups × the fixed request-pacing interval, so a
   *  large first scan across several consoles doesn't look stuck partway
   *  through a long, deliberately-throttled queue of lookups. */
  etaSeconds?: number;
}

export interface ExportManifestEntry {
  romId: number;
  sourcePath: string;
  destPath: string;
  copiedAt: string;
}
