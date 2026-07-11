import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonDb } from '../db';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

/** Fresh JsonDb backed by a unique temp file per call — sharing one path
 *  across tests would leak state, since JsonDb persists to disk on every
 *  mutation and reloads whatever's there on construction. */
async function freshDb(): Promise<JsonDb> {
  const dir = await mkdtemp(path.join(tmpdir(), 'rom-curator-db-'));
  dirs.push(dir);
  return new JsonDb(path.join(dir, 'rom-curator.json'));
}

describe('JsonDb.pruneRomsNotIn', () => {
  it('removes a rom whose key is not in keepKeys, for an eligible console', async () => {
    const db = await freshDb();
    const id = db.upsertRom({
      path: 'C:\\roms\\nes\\Game.zip',
      filename: 'Game.nes',
      console_id: 'nes',
      size_bytes: 1,
      crc32: null,
      matched_name: null,
      region: null,
      match_confidence: 'unmatched',
    });
    db.setCurationStatus(id, 'keep');

    const removed = db.pruneRomsNotIn(new Set(), new Set(['nes']));
    expect(removed).toBe(1);
    expect(db.listRoms()).toHaveLength(0);
    expect(db.getCurationMap().has(id)).toBe(false); // orphaned curation cleaned up too
  });

  it('does NOT remove a rom whose console is not in eligibleConsoleIds, even if not in keepKeys', async () => {
    // Simulates a root that failed to read this run (e.g. drive briefly
    // disconnected) — its console must not be treated as "now has zero files".
    const db = await freshDb();
    db.upsertRom({
      path: 'E:\\roms\\n64\\Game.zip',
      filename: 'Game.n64',
      console_id: 'n64',
      size_bytes: 1,
      crc32: null,
      matched_name: null,
      region: null,
      match_confidence: 'unmatched',
    });

    const removed = db.pruneRomsNotIn(new Set(), new Set()); // n64 not eligible this run
    expect(removed).toBe(0);
    expect(db.listRoms()).toHaveLength(1);
  });

  it('keeps a rom whose key IS in keepKeys', async () => {
    const db = await freshDb();
    db.upsertRom({
      path: 'C:\\roms\\nes\\Game.zip',
      filename: 'Game.nes',
      console_id: 'nes',
      size_bytes: 1,
      crc32: null,
      matched_name: null,
      region: null,
      match_confidence: 'unmatched',
    });

    const removed = db.pruneRomsNotIn(new Set(['C:\\roms\\nes\\Game.zip::Game.nes']), new Set(['nes']));
    expect(removed).toBe(0);
    expect(db.listRoms()).toHaveLength(1);
  });

  it('only removes eligible-console roms, leaving other consoles alone', async () => {
    const db = await freshDb();
    db.upsertRom({
      path: 'C:\\roms\\nes\\Stale.zip',
      filename: 'Stale.nes',
      console_id: 'nes',
      size_bytes: 1,
      crc32: null,
      matched_name: null,
      region: null,
      match_confidence: 'unmatched',
    });
    db.upsertRom({
      path: 'C:\\roms\\snes\\Fine.zip',
      filename: 'Fine.sfc',
      console_id: 'snes',
      size_bytes: 1,
      crc32: null,
      matched_name: null,
      region: null,
      match_confidence: 'unmatched',
    });

    // Only nes is eligible this run; snes's root wasn't scanned at all.
    const removed = db.pruneRomsNotIn(new Set(), new Set(['nes']));
    expect(removed).toBe(1);
    const remaining = db.listRoms();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].console_id).toBe('snes');
  });
});

describe('JsonDb.resetRomsAndCuration', () => {
  it('clears roms and curation but keeps the IGDB cache', async () => {
    const db = await freshDb();
    const id = db.upsertRom({
      path: 'C:\\roms\\nes\\Game.zip',
      filename: 'Game.nes',
      console_id: 'nes',
      size_bytes: 1,
      crc32: null,
      matched_name: 'Game (USA)',
      region: 'USA',
      match_confidence: 'hash-verified',
    });
    db.setCurationStatus(id, 'keep');
    db.setCachedIgdb('nes:game (usa)', { igdbId: 1, name: 'Game', genres: [] }, 'exact');

    db.resetRomsAndCuration();

    expect(db.listRoms()).toHaveLength(0);
    expect(db.getCurationMap().size).toBe(0);
    expect(db.getCachedIgdb('nes:game (usa)')).not.toBeNull(); // cache survives
  });

  it('a rom re-added after reset gets a fresh id starting from 1', async () => {
    const db = await freshDb();
    db.upsertRom({
      path: 'a',
      filename: 'a',
      console_id: 'nes',
      size_bytes: 1,
      crc32: null,
      matched_name: null,
      region: null,
      match_confidence: 'unmatched',
    });
    db.resetRomsAndCuration();
    const newId = db.upsertRom({
      path: 'b',
      filename: 'b',
      console_id: 'nes',
      size_bytes: 1,
      crc32: null,
      matched_name: null,
      region: null,
      match_confidence: 'unmatched',
    });
    expect(newId).toBe(1);
  });
});
