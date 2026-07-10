import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { identifyFile, type ScannedFile } from '../scanner';
import { parseDat } from '../datParser';

const SNES_DAT = `<?xml version="1.0"?>
<datafile>
  <game name="Bahamut Lagoon (Japan)">
    <rom name="Bahamut Lagoon (Japan).sfc" size="16" crc="deadbeef"/>
  </game>
</datafile>`;

describe('identifyFile', () => {
  it('identifies a fan-translation patch by stripping [T-En by ...] tags, tagged translated-hack', async () => {
    const lookup = parseDat(SNES_DAT);
    const file: ScannedFile = {
      path: 'C:\\roms\\Bahamut Lagoon (Japan) [T-En by Tom & Near v1.2].zip',
      filename: 'Bahamut Lagoon (Japan) [T-En by Tom & Near v1.2].sfc',
      consoleId: 'snes',
      sizeBytes: 16,
      knownCrc32: 'ffffffff', // deliberately does NOT match the DAT — patch changes the bytes
    };

    const result = await identifyFile(file, lookup);
    expect(result.confidence).toBe('translated-hack');
    expect(result.matchedName).toBe('Bahamut Lagoon (Japan)');
    expect(result.region).toBe('Japan');
  });

  it('still prefers hash-verified over the bracket-stripped fallback when the hash actually matches', async () => {
    const lookup = parseDat(SNES_DAT);
    const file: ScannedFile = {
      path: 'C:\\roms\\Bahamut Lagoon (Japan).zip',
      filename: 'Bahamut Lagoon (Japan).sfc',
      consoleId: 'snes',
      sizeBytes: 16,
      knownCrc32: 'deadbeef',
    };

    const result = await identifyFile(file, lookup);
    expect(result.confidence).toBe('hash-verified');
  });

  it('leaves a genuinely unknown file unmatched even with bracket tags present', async () => {
    const lookup = parseDat(SNES_DAT);
    const file: ScannedFile = {
      path: 'C:\\roms\\Totally Unknown Homebrew [v1.0].zip',
      filename: 'Totally Unknown Homebrew [v1.0].sfc',
      consoleId: 'snes',
      sizeBytes: 16,
      knownCrc32: 'ffffffff',
    };

    const result = await identifyFile(file, lookup);
    expect(result.confidence).toBe('unmatched');
  });

  it('CRC32 fallback path (crc32File) also works when knownCrc32 is absent', async () => {
    const lookup = parseDat(SNES_DAT);
    const dir = await mkdtemp(path.join(tmpdir(), 'rom-curator-scanner-'));
    const filePath = path.join(dir, 'Bahamut Lagoon (Japan) [T-En by Tom v1.0].sfc');
    await writeFile(filePath, Buffer.from('not the real rom bytes'));

    const file: ScannedFile = {
      path: filePath,
      filename: 'Bahamut Lagoon (Japan) [T-En by Tom v1.0].sfc',
      consoleId: 'snes',
      sizeBytes: 23,
    };

    const result = await identifyFile(file, lookup);
    expect(result.confidence).toBe('translated-hack');
    expect(result.crc32).toBeTruthy(); // was actually hashed from disk, not just carried over

    await rm(dir, { recursive: true, force: true });
  });
});
