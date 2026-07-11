import { CONSOLES, consoleById } from './consoleConfig';
import { scanRoots, identifyFile, isRootAccessible, type ScannedFile } from './scanner';
import { parseDatFile, type DatLookup } from './datParser';
import { findDatFilePath } from './datFileCheck';
import { resolveTitle, type IgdbCredentials } from './igdbClient';
import {
  upsertRom,
  getCachedIgdb,
  hasCachedIgdb,
  setCachedIgdb,
  getCurationMap,
  listRoms,
  pruneRomsNotIn,
  type JsonDb,
} from './db';
import type { AppConfig, ConsoleId, CuratedRom, RomRoot, ScanProgress } from '../shared/types';

export type ProgressCb = (p: ScanProgress) => void;

// IGDB's Twitch-auth'd API allows ~4 requests/second; pacing every call at
// 300ms keeps a full library scan comfortably under that regardless of how
// fast the network responds.
const IGDB_REQUEST_SPACING_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadDatLookups(datFolder: string): Promise<Map<string, DatLookup>> {
  const lookups = new Map<string, DatLookup>();
  for (const def of CONSOLES) {
    try {
      const datPath = await findDatFilePath(datFolder, def);
      if (!datPath) throw new Error('no matching DAT file');
      const lookup = await parseDatFile(datPath);
      lookups.set(def.id, lookup);
    } catch {
      // DAT file not present for this console yet — identification falls back to
      // "unmatched" for its files rather than failing the whole run.
      lookups.set(def.id, { byCrc32: new Map(), byFilename: new Map() });
    }
  }
  return lookups;
}

/**
 * Which consoles are safe to prune stale entries for on this scan. A console is
 * "protected" (excluded) only if it's still configured but its root couldn't be
 * read this run (e.g. an external drive briefly disconnected) — that's the one
 * ambiguous case where "zero files found" might not mean "zero files exist". A
 * console removed from Setup entirely is NOT protected: that's exactly the case
 * that should get cleaned up (a real bug hit in practice — an old console's
 * entries survived indefinitely after its ROM root was removed from Setup).
 */
export async function computeEligibleConsolesForPruning(romRoots: RomRoot[]): Promise<Set<ConsoleId>> {
  const protectedConsoles = new Set<ConsoleId>();
  for (const root of romRoots) {
    if (!(await isRootAccessible(root.path))) protectedConsoles.add(root.consoleId);
  }
  return new Set(CONSOLES.map((c) => c.id).filter((id) => !protectedConsoles.has(id)));
}

interface EnrichTarget {
  consoleId: ConsoleId;
  matchedName: string;
  cacheKey: string;
}

/**
 * Distinct (console, matched name) pairs across the identified files that
 * still need a fresh IGDB lookup — computed up front, after identification is
 * done, so the enrichment phase can report an exact "N of M" count and a real
 * ETA instead of a vague spinner. Two files matching the same game (region
 * variants, duplicates) collapse to a single lookup, same as before.
 */
export function computeEnrichTargets(
  db: JsonDb,
  identified: { file: ScannedFile; matchedName: string | null }[],
): EnrichTarget[] {
  const seen = new Set<string>();
  const targets: EnrichTarget[] = [];
  for (const { file, matchedName } of identified) {
    if (!matchedName) continue;
    const cacheKey = `${file.consoleId}:${matchedName.toLowerCase()}`;
    if (seen.has(cacheKey)) continue;
    seen.add(cacheKey);
    if (!hasCachedIgdb(db, cacheKey)) {
      targets.push({ consoleId: file.consoleId, matchedName, cacheKey });
    }
  }
  return targets;
}

/** Scans configured ROM roots, identifies files against DAT data, and enriches matches via IGDB. */
export async function runPipeline(
  db: JsonDb,
  config: AppConfig,
  onProgress: ProgressCb,
): Promise<CuratedRom[]> {
  onProgress({ phase: 'scanning', current: 0, total: 0, message: 'Scanning ROM folders…' });
  const files = await scanRoots(config.romRoots);

  onProgress({ phase: 'identifying', current: 0, total: files.length, message: 'Loading DAT files…' });
  const datLookups = await loadDatLookups(config.datFolder);

  const creds: IgdbCredentials | null =
    config.twitchClientId && config.twitchClientSecret
      ? { clientId: config.twitchClientId, clientSecret: config.twitchClientSecret }
      : null;

  // Phase 1: identify every file (fast — hashing/filename lookups, no network)
  // and record it, before touching IGDB at all.
  const identified: { file: ScannedFile; matchedName: string | null }[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress({ phase: 'identifying', current: i + 1, total: files.length, message: file.filename });

    const lookup = datLookups.get(file.consoleId)!;
    const id = await identifyFile(file, lookup);
    upsertRom(db, {
      path: file.path,
      filename: file.filename,
      console_id: file.consoleId,
      size_bytes: file.sizeBytes,
      crc32: id.crc32,
      matched_name: id.matchedName,
      region: id.region,
      match_confidence: id.confidence,
    });
    identified.push({ file, matchedName: id.matchedName });
  }

  // Phase 2: enrich, now that we know exactly how many distinct new lookups
  // are needed — lets the UI show a real "N of M" count and ETA rather than
  // riding along on the file-scan progress bar, which finishes almost
  // instantly and gives no sense of how long the IGDB-rate-limited part
  // (the genuinely slow part on a big first scan) will actually take.
  if (creds) {
    const targets = computeEnrichTargets(db, identified);
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const remaining = targets.length - (i + 1);
      onProgress({
        phase: 'enriching',
        current: i + 1,
        total: targets.length,
        message: `Looking up "${target.matchedName}" on IGDB…`,
        etaSeconds: Math.round((remaining * IGDB_REQUEST_SPACING_MS) / 1000),
      });
      const consoleDef = consoleById(target.consoleId);
      try {
        const resolution = await resolveTitle(creds, target.matchedName, consoleDef.igdbPlatformId);
        setCachedIgdb(db, target.cacheKey, resolution.info, resolution.quality);
      } catch {
        // Request itself failed (network blip, IGDB rate-limit, etc.) — do NOT
        // cache this as "no match", so a later rescan retries it instead of
        // permanently treating a transient failure as a confirmed non-match.
        onProgress({
          phase: 'enriching',
          current: i + 1,
          total: targets.length,
          message: `IGDB lookup failed for "${target.matchedName}", will retry on next scan`,
          etaSeconds: Math.round((remaining * IGDB_REQUEST_SPACING_MS) / 1000),
        });
      }
      await sleep(IGDB_REQUEST_SPACING_MS);
    }
  }

  // Remove stale entries from previous scans (a removed ROM root, or a file
  // that's since been deleted/moved).
  const eligibleConsoles = await computeEligibleConsolesForPruning(config.romRoots);
  const currentKeys = new Set(files.map((f) => `${f.path}::${f.filename}`));
  const prunedCount = pruneRomsNotIn(db, currentKeys, eligibleConsoles);

  onProgress({
    phase: 'done',
    current: files.length,
    total: files.length,
    message: prunedCount > 0 ? `Done — removed ${prunedCount} stale entries from previous scans` : 'Done',
  });
  return buildCuratedList(db);
}

export function buildCuratedList(db: JsonDb): CuratedRom[] {
  const rows = listRoms(db);
  const curationMap = getCurationMap(db);

  return rows.map((row) => {
    const igdb = row.matched_name
      ? getCachedIgdb(db, `${row.console_id}:${row.matched_name.toLowerCase()}`)
      : null;
    return {
      id: row.id,
      path: row.path,
      filename: row.filename,
      consoleId: row.console_id,
      sizeBytes: row.size_bytes,
      crc32: row.crc32,
      matchedName: row.matched_name,
      region: row.region,
      matchConfidence: row.match_confidence,
      igdb,
      status: curationMap.get(row.id) ?? 'undecided',
    };
  });
}
