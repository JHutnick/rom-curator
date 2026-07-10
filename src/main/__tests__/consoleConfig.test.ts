import { describe, expect, it } from 'vitest';
import { consoleById, extensionBelongsToConsole, guessConsoleFromFolderName, matchesDatFilename } from '../consoleConfig';

describe('guessConsoleFromFolderName', () => {
  it('matches common short-name folder conventions', () => {
    expect(guessConsoleFromFolderName('E:\\Emulation\\ROMS\\snes')).toBe('snes');
    expect(guessConsoleFromFolderName('E:\\Emulation\\ROMS\\psx')).toBe('ps1');
    expect(guessConsoleFromFolderName('E:\\Emulation\\ROMS\\ps2')).toBe('ps2');
    expect(guessConsoleFromFolderName('E:\\Emulation\\ROMS\\gamecube')).toBe('gamecube');
    expect(guessConsoleFromFolderName('E:\\Emulation\\ROMS\\dreamcast')).toBe('dreamcast');
    expect(guessConsoleFromFolderName('E:\\Emulation\\ROMS\\saturn')).toBe('saturn');
    expect(guessConsoleFromFolderName('E:\\Emulation\\ROMS\\megadrive')).toBe('genesis');
  });

  it('is case-insensitive and works with forward slashes', () => {
    expect(guessConsoleFromFolderName('/mnt/roms/SNES')).toBe('snes');
    expect(guessConsoleFromFolderName('/mnt/roms/GameCube')).toBe('gamecube');
  });

  it('returns null for an unrecognized folder name', () => {
    expect(guessConsoleFromFolderName('E:\\Emulation\\ROMS\\my_weird_folder')).toBeNull();
  });
});

describe('extensionBelongsToConsole', () => {
  it('is case-insensitive', () => {
    expect(extensionBelongsToConsole('.ISO', 'ps2')).toBe(true);
    expect(extensionBelongsToConsole('.iso', 'ps2')).toBe(true);
  });

  it('a shared extension like .iso belongs to multiple disc consoles independently', () => {
    expect(extensionBelongsToConsole('.iso', 'ps1')).toBe(true);
    expect(extensionBelongsToConsole('.iso', 'ps2')).toBe(true);
    expect(extensionBelongsToConsole('.iso', 'gamecube')).toBe(true);
    expect(extensionBelongsToConsole('.iso', 'saturn')).toBe(true);
  });

  it('rejects an extension that does not belong to the given console', () => {
    expect(extensionBelongsToConsole('.nes', 'snes')).toBe(false);
    expect(extensionBelongsToConsole('.cdi', 'ps2')).toBe(false); // Dreamcast-only format
  });
});

describe('matchesDatFilename', () => {
  it('matches the exact expected filename', () => {
    expect(matchesDatFilename('Sony - PlayStation 2.dat', consoleById('ps2'))).toBe(true);
  });

  it('matches Redump-style descriptive suffixes ("- Datfile (N) (date).dat")', () => {
    expect(
      matchesDatFilename(
        'Sony - PlayStation 2 - Datfile (11774) (2026-06-15 03-41-38).dat',
        consoleById('ps2'),
      ),
    ).toBe(true);
  });

  it('matches No-Intro-style descriptive suffixes ("(Parent-Clone) (date).dat")', () => {
    expect(
      matchesDatFilename(
        'Nintendo - Super Nintendo Entertainment System (Parent-Clone) (20260614-014159).dat',
        consoleById('snes'),
      ),
    ).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesDatFilename('SONY - PLAYSTATION 2.DAT', consoleById('ps2'))).toBe(true);
  });

  it('does NOT let a shorter console name false-match a longer one with a shared prefix', () => {
    // Real collision risk: "Game Boy" is a string-prefix of "Game Boy Advance"/"Game Boy Color",
    // and "PlayStation" is a string-prefix of "PlayStation 2" — naive prefix matching would
    // wrongly claim the wrong console's DAT file.
    expect(matchesDatFilename('Nintendo - Game Boy Advance.dat', consoleById('gb'))).toBe(false);
    expect(matchesDatFilename('Nintendo - Game Boy Color.dat', consoleById('gb'))).toBe(false);
    expect(matchesDatFilename('Sony - PlayStation 2.dat', consoleById('ps1'))).toBe(false);
  });

  it('rejects a completely unrelated filename', () => {
    expect(matchesDatFilename('Nintendo - Nintendo 64.dat', consoleById('ps2'))).toBe(false);
  });

  it('rejects a non-.dat file even if the name matches', () => {
    expect(matchesDatFilename('Sony - PlayStation 2.dat.txt', consoleById('ps2'))).toBe(false);
  });
});
