import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeEligibleConsolesForPruning, computeEnrichTargets } from '../pipeline';
import { CONSOLES } from '../consoleConfig';
import { JsonDb } from '../db';
import type { ScannedFile } from '../scanner';

describe('computeEligibleConsolesForPruning', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('a console removed from Setup entirely (not in romRoots at all) is eligible for pruning', async () => {
    // The real bug this guards against: an old console's leftover entries must
    // NOT be protected forever just because it's no longer configured.
    dir = await mkdtemp(path.join(tmpdir(), 'rom-curator-pipeline-'));
    const eligible = await computeEligibleConsolesForPruning([{ path: dir, consoleId: 'snes' }]);
    expect(eligible.has('nes')).toBe(true); // nes isn't configured at all — eligible
    expect(eligible.has('snes')).toBe(true); // configured and readable — eligible
  });

  it('a console still configured but whose root is unreadable right now is protected', async () => {
    const eligible = await computeEligibleConsolesForPruning([
      { path: 'C:\\this\\path\\does\\not\\exist\\right\\now', consoleId: 'n64' },
    ]);
    expect(eligible.has('n64')).toBe(false); // protected — could be a transient drive disconnect
  });

  it('with no roots configured at all, every console is eligible', async () => {
    const eligible = await computeEligibleConsolesForPruning([]);
    expect(eligible.size).toBe(CONSOLES.length);
  });
});

function scannedFile(overrides: Partial<ScannedFile>): ScannedFile {
  return { path: 'C:\\roms\\x.zip', filename: 'x.sfc', consoleId: 'snes', sizeBytes: 1, ...overrides };
}

describe('computeEnrichTargets', () => {
  let enrichDir: string;

  afterEach(async () => {
    if (enrichDir) await rm(enrichDir, { recursive: true, force: true });
  });

  async function freshDb(): Promise<JsonDb> {
    enrichDir = await mkdtemp(path.join(tmpdir(), 'rom-curator-enrich-'));
    return new JsonDb(path.join(enrichDir, 'rom-curator.json'));
  }

  it('collapses two files matching the same game into a single target', async () => {
    const db = await freshDb();
    const identified = [
      { file: scannedFile({ filename: 'Chrono Trigger (USA).sfc' }), matchedName: 'Chrono Trigger (USA)' },
      { file: scannedFile({ filename: 'Chrono Trigger (USA) [dup].sfc' }), matchedName: 'Chrono Trigger (USA)' },
    ];
    const targets = computeEnrichTargets(db, identified);
    expect(targets).toHaveLength(1);
    expect(targets[0].matchedName).toBe('Chrono Trigger (USA)');
  });

  it('skips a title that already has a cache entry', async () => {
    const db = await freshDb();
    db.setCachedIgdb('snes:chrono trigger (usa)', { igdbId: 1, name: 'Chrono Trigger', genres: [] }, 'exact');
    const identified = [
      { file: scannedFile({ filename: 'Chrono Trigger (USA).sfc' }), matchedName: 'Chrono Trigger (USA)' },
      { file: scannedFile({ filename: 'Super Mario World (USA).sfc' }), matchedName: 'Super Mario World (USA)' },
    ];
    const targets = computeEnrichTargets(db, identified);
    expect(targets).toHaveLength(1);
    expect(targets[0].matchedName).toBe('Super Mario World (USA)');
  });

  it('skips unidentified files (no matchedName)', async () => {
    const db = await freshDb();
    const identified = [{ file: scannedFile({ filename: 'Homebrew.sfc' }), matchedName: null }];
    expect(computeEnrichTargets(db, identified)).toEqual([]);
  });
});
