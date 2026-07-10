import { describe, expect, it } from 'vitest';
import { computeDuplicateSkipIds, regionRank } from '../curationHelpers';
import type { CuratedRom } from '../types';

function rom(overrides: Partial<CuratedRom>): CuratedRom {
  return {
    id: 1,
    path: 'C:\\roms\\x.zip',
    filename: 'x.sfc',
    consoleId: 'snes',
    sizeBytes: 1,
    crc32: null,
    matchedName: null,
    region: null,
    matchConfidence: 'unmatched',
    igdb: null,
    status: 'undecided',
    ...overrides,
  };
}

describe('regionRank', () => {
  it('ranks USA best, then World, Europe, Japan, then unknown/other', () => {
    expect(regionRank('USA')).toBeLessThan(regionRank('World'));
    expect(regionRank('World')).toBeLessThan(regionRank('Europe'));
    expect(regionRank('Europe')).toBeLessThan(regionRank('Japan'));
    expect(regionRank('Japan')).toBeLessThan(regionRank('Some Other Region'));
    expect(regionRank('Some Other Region')).toBeLessThan(regionRank(null));
  });
});

describe('computeDuplicateSkipIds', () => {
  it('picks the most-preferred region as keeper and flags the rest for skip', () => {
    const roms = [
      rom({ id: 1, matchedName: 'Chrono Trigger (Japan)', region: 'Japan' }),
      rom({ id: 2, matchedName: 'Chrono Trigger (USA)', region: 'USA' }),
      rom({ id: 3, matchedName: 'Chrono Trigger (Europe)', region: 'Europe' }),
    ];
    const toSkip = computeDuplicateSkipIds(roms);
    expect(toSkip.sort()).toEqual([1, 3]);
  });

  it('ignores region/revision tags when grouping — same base title matches', () => {
    const roms = [
      rom({ id: 1, matchedName: 'Super Mario World (USA)', region: 'USA' }),
      rom({ id: 2, matchedName: 'Super Mario World (USA) (Rev 1)', region: 'USA' }),
    ];
    const toSkip = computeDuplicateSkipIds(roms);
    // Same region rank for both — one is kept, the other flagged; exactly one survives.
    expect(toSkip).toHaveLength(1);
  });

  it('treats "keep" as a candidate too — a bulk "keep all shown" first pass should not block dedup', () => {
    const roms = [
      rom({ id: 1, matchedName: 'Chrono Trigger (Japan)', region: 'Japan', status: 'keep' }),
      rom({ id: 2, matchedName: 'Chrono Trigger (USA)', region: 'USA', status: 'keep' }),
    ];
    const toSkip = computeDuplicateSkipIds(roms);
    expect(toSkip).toEqual([1]); // USA (id 2) is preferred and left as-is; Japan duplicate flagged
  });

  it('never touches a rom already explicitly marked skip', () => {
    const roms = [
      rom({ id: 1, matchedName: 'Chrono Trigger (Japan)', region: 'Japan', status: 'skip' }),
      rom({ id: 2, matchedName: 'Chrono Trigger (USA)', region: 'USA', status: 'keep' }),
    ];
    const toSkip = computeDuplicateSkipIds(roms);
    expect(toSkip).toEqual([]); // id 1 is already skipped (nothing to do), id 2 has no other candidate to pair with
  });

  it('leaves unique (non-duplicated) games alone', () => {
    const roms = [
      rom({ id: 1, matchedName: 'Chrono Trigger (USA)', region: 'USA' }),
      rom({ id: 2, matchedName: 'Super Mario World (USA)', region: 'USA' }),
    ];
    expect(computeDuplicateSkipIds(roms)).toEqual([]);
  });

  it('ignores unidentified files (no matchedName) — cannot be grouped reliably', () => {
    const roms = [
      rom({ id: 1, matchedName: null, filename: 'Homebrew1.sfc' }),
      rom({ id: 2, matchedName: null, filename: 'Homebrew2.sfc' }),
    ];
    expect(computeDuplicateSkipIds(roms)).toEqual([]);
  });
});
