import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ConsoleId, CurationStatus, IgdbInfo, MatchConfidence } from '../shared/types';

// A flat JSON-file store, not SQLite: this tool's access pattern is simple keyed
// lookups/upserts (no joins/queries needed), and a native module (better-sqlite3)
// isn't worth the node-gyp/Python build-toolchain dependency for a personal utility.

export interface RomRow {
  id: number;
  path: string;
  filename: string;
  console_id: ConsoleId;
  size_bytes: number;
  crc32: string | null;
  matched_name: string | null;
  region: string | null;
  match_confidence: MatchConfidence;
}

interface IgdbCacheRow {
  igdbId: number | null;
  name: string | null;
  coverUrl?: string;
  releaseYear?: number;
  genres: string[];
  rating?: number;
  aggregatedRating?: number;
  ratingCount?: number;
  summary?: string;
  matchQuality: string;
  fetchedAt: string;
}

interface StoreData {
  roms: RomRow[];
  nextRomId: number;
  igdbCache: Record<string, IgdbCacheRow>;
  curation: Record<number, CurationStatus>;
}

function emptyStore(): StoreData {
  return { roms: [], nextRomId: 1, igdbCache: {}, curation: {} };
}

export class JsonDb {
  private data: StoreData;

  constructor(private filePath: string) {
    this.data = this.load();
  }

  private load(): StoreData {
    if (existsSync(this.filePath)) {
      try {
        return { ...emptyStore(), ...JSON.parse(readFileSync(this.filePath, 'utf-8')) };
      } catch {
        // corrupt/unreadable file — start fresh rather than crashing the app
      }
    }
    return emptyStore();
  }

  private save(): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  upsertRom(rom: Omit<RomRow, 'id'>): number {
    // Keyed on path+filename, not path alone: a zip that wraps more than one
    // rom entry (rare, but possible) shares one path across multiple distinct
    // roms — path alone would make the second upsert overwrite the first.
    const existing = this.data.roms.find(
      (r) => r.path === rom.path && r.filename === rom.filename,
    );
    if (existing) {
      Object.assign(existing, rom);
      this.save();
      return existing.id;
    }
    const id = this.data.nextRomId++;
    this.data.roms.push({ ...rom, id });
    this.save();
    return id;
  }

  listRoms(consoleId?: ConsoleId): RomRow[] {
    return consoleId ? this.data.roms.filter((r) => r.console_id === consoleId) : this.data.roms;
  }

  /** True once a lookup for this key has completed (successfully) at all —
   *  including a confirmed "not on IGDB" result. Distinct from getCachedIgdb
   *  returning null, which is ambiguous between "never looked up" and "looked
   *  up, genuinely no match" — callers deciding whether to re-query need this. */
  hasCachedIgdb(cacheKey: string): boolean {
    return cacheKey in this.data.igdbCache;
  }

  getCachedIgdb(cacheKey: string): IgdbInfo | null {
    const row = this.data.igdbCache[cacheKey];
    if (!row || row.igdbId == null) return null;
    return {
      igdbId: row.igdbId,
      name: row.name ?? '',
      coverUrl: row.coverUrl,
      releaseYear: row.releaseYear,
      genres: row.genres ?? [],
      rating: row.rating,
      aggregatedRating: row.aggregatedRating,
      ratingCount: row.ratingCount,
      summary: row.summary,
    };
  }

  setCachedIgdb(cacheKey: string, info: IgdbInfo | null, matchQuality: string): void {
    this.data.igdbCache[cacheKey] = {
      igdbId: info?.igdbId ?? null,
      name: info?.name ?? null,
      coverUrl: info?.coverUrl,
      releaseYear: info?.releaseYear,
      genres: info?.genres ?? [],
      rating: info?.rating,
      aggregatedRating: info?.aggregatedRating,
      ratingCount: info?.ratingCount,
      summary: info?.summary,
      matchQuality,
      fetchedAt: new Date().toISOString(),
    };
    this.save();
  }

  setCurationStatus(romId: number, status: CurationStatus): void {
    this.data.curation[romId] = status;
    this.save();
  }

  getCurationMap(): Map<number, CurationStatus> {
    return new Map(Object.entries(this.data.curation).map(([id, status]) => [Number(id), status]));
  }
}

export function openDb(dbPath: string): JsonDb {
  return new JsonDb(dbPath);
}

export function defaultDbPath(userDataDir: string): string {
  return path.join(userDataDir, 'rom-curator.json');
}

export function upsertRom(db: JsonDb, rom: Omit<RomRow, 'id'>): number {
  return db.upsertRom(rom);
}

export function listRoms(db: JsonDb, consoleId?: ConsoleId): RomRow[] {
  return db.listRoms(consoleId);
}

export function getCachedIgdb(db: JsonDb, cacheKey: string): IgdbInfo | null {
  return db.getCachedIgdb(cacheKey);
}

export function hasCachedIgdb(db: JsonDb, cacheKey: string): boolean {
  return db.hasCachedIgdb(cacheKey);
}

export function setCachedIgdb(db: JsonDb, cacheKey: string, info: IgdbInfo | null, matchQuality: string): void {
  db.setCachedIgdb(cacheKey, info, matchQuality);
}

export function setCurationStatus(db: JsonDb, romId: number, status: CurationStatus): void {
  db.setCurationStatus(romId, status);
}

export function getCurationMap(db: JsonDb): Map<number, CurationStatus> {
  return db.getCurationMap();
}
