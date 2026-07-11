import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ConsoleId, MatchConfidence, RomRoot } from '../shared/types';
import { CONSOLES, extensionBelongsToConsole } from './consoleConfig';
import { crc32File } from './hasher';
import { normalizeFilenameKey, stripBracketTags, type DatLookup } from './datParser';
import { readZipEntries } from './zipReader';

export interface ScannedFile {
  /** Actual file on disk — for zip-wrapped roms, this is the .zip itself. */
  path: string;
  /** Logical rom filename used for display/DAT-filename matching — the inner
   *  entry name for zips, otherwise the same as the on-disk filename. */
  filename: string;
  consoleId: ConsoleId;
  sizeBytes: number;
  /** For zip-wrapped roms: the CRC32 zip already stores for the uncompressed
   *  entry, so scanning doesn't need to decompress+hash it separately. */
  knownCrc32?: string;
}

const IGNORED_DIR_NAMES = new Set(['.git', '$RECYCLE.BIN', 'System Volume Information']);

/**
 * Recursively walks each root folder, tagging every file found with that root's
 * declared console. Extensions like .bin/.cue/.iso are shared across several
 * disc-based consoles (PS1/PS2/Saturn/Dreamcast), so — unlike a single-console
 * setup — extension alone can't disambiguate; the folder's assigned console is
 * authoritative, and the extension check just filters out non-rom files.
 */
export async function scanRoots(roots: RomRoot[]): Promise<ScannedFile[]> {
  const found: ScannedFile[] = [];
  for (const root of roots) {
    await walk(root.path, root.consoleId, found);
  }
  return found;
}

/**
 * True if a ROM root's top-level folder can currently be read at all. Used to
 * gate stale-data pruning: an external drive that's briefly disconnected would
 * otherwise look identical to "this console legitimately has zero files now",
 * which would wrongly wipe out real curation data for it.
 */
export async function isRootAccessible(rootPath: string): Promise<boolean> {
  try {
    await readdir(rootPath);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string, consoleId: ConsoleId, found: ScannedFile[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // unreadable/missing folder — skip rather than aborting the whole scan
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), consoleId, found);
      continue;
    }
    if (!entry.isFile()) continue;

    const filePath = path.join(dir, entry.name);
    const ext = path.extname(entry.name);

    if (ext.toLowerCase() === '.zip') {
      await collectZipRoms(filePath, consoleId, found);
      continue;
    }

    if (!extensionBelongsToConsole(ext, consoleId)) continue;

    const info = await stat(filePath);
    found.push({
      path: filePath,
      filename: entry.name,
      consoleId,
      sizeBytes: info.size,
    });
  }
}

/**
 * No-Intro-style romsets are typically distributed as one .zip per game, each
 * containing a single raw rom file. Zip's central directory already stores the
 * CRC32 of the *uncompressed* entry — the same value DAT files key on — so
 * this reads that directly instead of decompressing and re-hashing.
 */
async function collectZipRoms(zipPath: string, consoleId: ConsoleId, found: ScannedFile[]): Promise<void> {
  let entries;
  try {
    entries = await readZipEntries(zipPath);
  } catch {
    return; // corrupt/unreadable zip — skip rather than aborting the whole scan
  }

  for (const zipEntry of entries) {
    if (zipEntry.filename.endsWith('/')) continue; // directory entry
    const innerExt = path.extname(zipEntry.filename);
    if (!extensionBelongsToConsole(innerExt, consoleId)) continue; // not a rom (readme, scan image, etc.)

    found.push({
      path: zipPath,
      filename: path.basename(zipEntry.filename),
      consoleId,
      sizeBytes: zipEntry.uncompressedSize,
      knownCrc32: zipEntry.crc32,
    });
  }
}

export interface IdentificationResult {
  matchedName: string | null;
  region: string | null;
  crc32: string | null;
  confidence: MatchConfidence;
}

/**
 * Last-resort lookup for roms that don't match by hash or exact filename: strips
 * romhacking-style "[T-En by ...]" bracket tags and retries. A fan-translation
 * or hack will never hash-match the official DAT entry (its bytes are modified
 * by definition), but this still tells you *which game* it's a copy of — tagged
 * 'translated-hack' rather than 'filename-match' so it stays visibly distinct
 * from a verified-clean, unmodified dump.
 */
function lookupStrippedBrackets(filename: string, datLookup: DatLookup) {
  const stripped = stripBracketTags(filename);
  if (stripped === filename) return null;
  return datLookup.byFilename.get(normalizeFilenameKey(stripped)) ?? null;
}

/**
 * Identifies a scanned file against a console's DAT lookup. Hash-verifies
 * cartridge-era consoles (cheap, and catches bad/renamed dumps); for large
 * disc-based consoles it matches by cleaned filename only, since hashing
 * every disc image up front is too slow to do for a whole library.
 */
export async function identifyFile(
  file: ScannedFile,
  datLookup: DatLookup,
): Promise<IdentificationResult> {
  const consoleDef = CONSOLES.find((c) => c.id === file.consoleId);
  const shouldHash = consoleDef?.hashOnScan ?? false;

  if (shouldHash) {
    const crc32 = file.knownCrc32 ?? (await crc32File(file.path));
    const entry = datLookup.byCrc32.get(crc32);
    if (entry) {
      return {
        matchedName: entry.gameName,
        region: entry.region,
        crc32,
        confidence: 'hash-verified',
      };
    }
    // Hash didn't match any known-good dump, but filename might still resolve it.
    const byName = datLookup.byFilename.get(normalizeFilenameKey(file.filename));
    if (byName) {
      return {
        matchedName: byName.gameName,
        region: byName.region,
        crc32,
        confidence: 'filename-match',
      };
    }
    const hackMatch = lookupStrippedBrackets(file.filename, datLookup);
    if (hackMatch) {
      return {
        matchedName: hackMatch.gameName,
        region: hackMatch.region,
        crc32,
        confidence: 'translated-hack',
      };
    }
    return { matchedName: null, region: null, crc32, confidence: 'unmatched' };
  }

  const byName = datLookup.byFilename.get(normalizeFilenameKey(file.filename));
  if (byName) {
    return {
      matchedName: byName.gameName,
      region: byName.region,
      crc32: null,
      confidence: 'filename-match',
    };
  }
  const hackMatch = lookupStrippedBrackets(file.filename, datLookup);
  if (hackMatch) {
    return {
      matchedName: hackMatch.gameName,
      region: hackMatch.region,
      crc32: null,
      confidence: 'translated-hack',
    };
  }
  return { matchedName: null, region: null, crc32: null, confidence: 'unmatched' };
}
