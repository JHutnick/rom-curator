import { describe, expect, it } from 'vitest';
import { computeDuplicateSkipIds, formatBytes, formatCount, regionRank } from '../curationHelpers';
import type { CuratedRom } from '../types';

describe('formatBytes', () => {
  it('formats sub-KB sizes in bytes', () => {
    expect(formatBytes(512)).toBe('512B');
  });

  it('formats KB/MB/GB with one decimal under 10, whole numbers above', () => {
    expect(formatBytes(2048)).toBe('2.0KB');
    expect(formatBytes(1536 * 1024)).toBe('1.5MB');
    expect(formatBytes(200 * 1024 * 1024)).toBe('200MB');
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5GB');
  });
});

describe('formatCount', () => {
  it('shows raw numbers under 1000', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(842)).toBe('842');
  });

  it('abbreviates thousands with one decimal below 10k, whole above', () => {
    expect(formatCount(1400)).toBe('1.4k');
    expect(formatCount(25000)).toBe('25k');
  });

  it('abbreviates millions', () => {
    expect(formatCount(2_300_000)).toBe('2.3M');
  });
});

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
