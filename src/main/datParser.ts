import { readFile } from 'node:fs/promises';

export interface DatEntry {
  /** Clean game name as published in the DAT, e.g. "Chrono Trigger (USA)". */
  gameName: string;
  /** Original ROM filename as published in the DAT. */
  romFilename: string;
  crc32: string | null;
  region: string | null;
}

export interface DatLookup {
  byCrc32: Map<string, DatEntry>;
  byFilename: Map<string, DatEntry>;
}

const REGION_RE = /\(([^)]*(?:USA|Europe|Japan|World|Asia|Korea|Brazil)[^)]*)\)/i;

function extractRegion(gameName: string): string | null {
  const match = gameName.match(REGION_RE);
  return match ? match[1] : null;
}

/** Strips the extension and normalizes a filename for lookup-key matching. */
export function normalizeFilenameKey(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim().toLowerCase();
}

/**
 * Strips romhacking-community bracket tags — "[T-En by Group v1.2]",
 * "[Add by X]", "[n]" — that mark a fan translation or hack. These are never
 * part of a No-Intro DAT's official filename, so removing them lets a
 * translated/hacked rom still resolve to the game it's a copy of.
 */
export function stripBracketTags(filename: string): string {
  return filename.replace(/\s*\[[^\]]*\]/g, '');
}

/**
 * Parses a Logiqx-format DAT XML file (the standard No-Intro / Redump format:
 * <datafile><game name="..."><rom name="..." crc="..."/></game></datafile>)
 * into CRC32 and filename lookup maps.
 */
export function parseDat(xml: string): DatLookup {
  const byCrc32 = new Map<string, DatEntry>();
  const byFilename = new Map<string, DatEntry>();

  const gameRe = /<game\b[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/game>/g;
  // Match whole <rom .../> tags, then pull name/crc out of each tag independently —
  // attribute order (name, size, crc, md5, sha1) varies enough between DAT sources
  // that anchoring name and crc to a single ordered pattern silently drops crc.
  const romTagRe = /<rom\b[^>]*\/?>/g;

  let gameMatch: RegExpExecArray | null;
  while ((gameMatch = gameRe.exec(xml))) {
    const gameName = decodeXmlEntities(gameMatch[1]);
    const body = gameMatch[2];
    const region = extractRegion(gameName);

    romTagRe.lastIndex = 0;
    let romMatch: RegExpExecArray | null;
    while ((romMatch = romTagRe.exec(body))) {
      const tag = romMatch[0];
      const nameAttr = tag.match(/\bname="([^"]*)"/);
      if (!nameAttr) continue;
      const crcAttr = tag.match(/\bcrc="([^"]*)"/);

      const romFilename = decodeXmlEntities(nameAttr[1]);
      const crc32 = crcAttr && crcAttr[1] ? crcAttr[1].toLowerCase() : null;
      const entry: DatEntry = { gameName, romFilename, crc32, region };

      if (crc32) byCrc32.set(crc32, entry);
      byFilename.set(normalizeFilenameKey(romFilename), entry);
    }
  }

  return { byCrc32, byFilename };
}

export async function parseDatFile(path: string): Promise<DatLookup> {
  const xml = await readFile(path, 'utf-8');
  return parseDat(xml);
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
