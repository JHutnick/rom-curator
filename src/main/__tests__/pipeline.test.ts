import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { computeEligibleConsolesForPruning } from '../pipeline';
import { CONSOLES } from '../consoleConfig';

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
