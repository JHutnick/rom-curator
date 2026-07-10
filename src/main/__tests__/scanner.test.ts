import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { identifyFile, scanRoots, type ScannedFile } from '../scanner';
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

describe('scanRoots — shared-extension disambiguation across disc consoles', () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('assigns .iso files to the console declared by each root, not a global guess', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'rom-curator-multiconsole-'));
    const ps2Dir = path.join(tmpDir, 'ps2');
    const gcDir = path.join(tmpDir, 'gamecube');
    const satDir = path.join(tmpDir, 'saturn');
    await mkdir(ps2Dir, { recursive: true });
    await mkdir(gcDir, { recursive: true });
    await mkdir(satDir, { recursive: true });

    // Same extension, same-looking filename, three different consoles — this is
    // exactly the case pure extension-sniffing can't handle.
    await writeFile(path.join(ps2Dir, 'Game.iso'), Buffer.from('ps2'));
    await writeFile(path.join(gcDir, 'Game.iso'), Buffer.from('gc'));
    await writeFile(path.join(satDir, 'Game.iso'), Buffer.from('sat'));

    const files = await scanRoots([
      { path: ps2Dir, consoleId: 'ps2' },
      { path: gcDir, consoleId: 'gamecube' },
      { path: satDir, consoleId: 'saturn' },
    ]);

    expect(files).toHaveLength(3);
    const byConsole = Object.fromEntries(files.map((f) => [f.consoleId, f.path]));
    expect(byConsole.ps2).toBe(path.join(ps2Dir, 'Game.iso'));
    expect(byConsole.gamecube).toBe(path.join(gcDir, 'Game.iso'));
    expect(byConsole.saturn).toBe(path.join(satDir, 'Game.iso'));
  });

  it('skips a file whose extension does not belong to its root-declared console', async () => {
    tmpDir = await mkdtemp(path.join(tmpdir(), 'rom-curator-multiconsole-'));
    // A Dreamcast-only extension (.cdi) sitting in a folder declared as PS2 — should
    // not show up, since .cdi isn't in PS2's extension list.
    await writeFile(path.join(tmpDir, 'Wrong Format.cdi'), Buffer.from('x'));

    const files = await scanRoots([{ path: tmpDir, consoleId: 'ps2' }]);
    expect(files).toHaveLength(0);
  });
});
