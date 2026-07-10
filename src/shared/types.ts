export type ConsoleId = 'nes' | 'snes' | 'n64' | 'gba' | 'genesis' | 'ps1';

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

export interface AppConfig {
  romRoots: string[];
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
}

export interface ExportManifestEntry {
  romId: number;
  sourcePath: string;
  destPath: string;
  copiedAt: string;
}
