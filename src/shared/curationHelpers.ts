import { normalizeTitle, stripRomTags } from '../main/igdbClient';
import type { CuratedRom } from './types';

/** Lower = more preferred region, used to pick the "keeper" among duplicate/variant copies of a game. */
export function regionRank(region: string | null): number {
  if (!region) return 5;
  if (/USA/i.test(region)) return 0;
  if (/World/i.test(region)) return 1;
  if (/Europe/i.test(region)) return 2;
  if (/Japan/i.test(region)) return 3;
  return 4;
}

function duplicateGroupKey(rom: CuratedRom): string | null {
  if (!rom.matchedName) return null; // unidentified files can't be reliably grouped by title
  return `${rom.consoleId}::${normalizeTitle(stripRomTags(rom.matchedName))}`;
}

/**
 * Groups roms by console + base title (region/revision tags stripped), and for
 * every group with more than one member, returns the ids of every member
 * EXCEPT the most-preferred region — i.e. "what would get skipped if you kept
 * only the best copy of each game". Considers 'undecided', 'keep', and 'maybe'
 * roms as candidates — only a rom already marked 'skip' is left untouched, since
 * that's the one status that represents a real "I don't want this" decision.
 * ('keep' is deliberately included: a common flow is bulk-"keep all shown" as a
 * first pass, which would otherwise leave nothing 'undecided' for this to act on.)
 */
export function computeDuplicateSkipIds(roms: CuratedRom[]): number[] {
  const groups = new Map<string, CuratedRom[]>();
  for (const rom of roms) {
    if (rom.status === 'skip') continue;
    const key = duplicateGroupKey(rom);
    if (!key) continue;
    const group = groups.get(key);
    if (group) group.push(rom);
    else groups.set(key, [rom]);
  }

  const toSkip: number[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => regionRank(a.region) - regionRank(b.region));
    for (let i = 1; i < sorted.length; i++) toSkip.push(sorted[i].id);
  }
  return toSkip;
}
