import { CONSOLES, consoleById } from './consoleConfig';
import { scanRoots, identifyFile } from './scanner';
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
  type JsonDb,
} from './db';
import type { AppConfig, CuratedRom, ScanProgress } from '../shared/types';

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

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress({
      phase: 'identifying',
      current: i + 1,
      total: files.length,
      message: file.filename,
    });

    const lookup = datLookups.get(file.consoleId)!;
    const id = await identifyFile(file, lookup);
    const romId = upsertRom(db, {
      path: file.path,
      filename: file.filename,
      console_id: file.consoleId,
      size_bytes: file.sizeBytes,
      crc32: id.crc32,
      matched_name: id.matchedName,
      region: id.region,
      match_confidence: id.confidence,
    });

    if (creds && id.matchedName) {
      const cacheKey = `${file.consoleId}:${id.matchedName.toLowerCase()}`;
      if (!hasCachedIgdb(db, cacheKey)) {
        onProgress({
          phase: 'enriching',
          current: i + 1,
          total: files.length,
          message: `Looking up "${id.matchedName}" on IGDB…`,
        });
        const consoleDef = consoleById(file.consoleId);
        try {
          const resolution = await resolveTitle(creds, id.matchedName, consoleDef.igdbPlatformId);
          setCachedIgdb(db, cacheKey, resolution.info, resolution.quality);
        } catch {
          // Request itself failed (network blip, IGDB rate-limit, etc.) — do NOT
          // cache this as "no match", so a later rescan retries it instead of
          // permanently treating a transient failure as a confirmed non-match.
          onProgress({
            phase: 'enriching',
            current: i + 1,
            total: files.length,
            message: `IGDB lookup failed for "${id.matchedName}", will retry on next scan`,
          });
        }
        await sleep(IGDB_REQUEST_SPACING_MS);
      }
    }

    void romId;
  }

  onProgress({ phase: 'done', current: files.length, total: files.length, message: 'Done' });
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
