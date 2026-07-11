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

  it('PSP recognizes .chd alongside .iso/.cso (regression: .chd dumps went unscanned)', () => {
    expect(extensionBelongsToConsole('.chd', 'psp')).toBe(true);
    expect(extensionBelongsToConsole('.iso', 'psp')).toBe(true);
    expect(extensionBelongsToConsole('.cso', 'psp')).toBe(true);
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

  it('does not let PS1 false-match a PSP DAT ("PlayStation" prefixes "PlayStation Portable")', () => {
    expect(matchesDatFilename('Sony - PlayStation Portable.dat', consoleById('ps1'))).toBe(false);
    expect(matchesDatFilename('Sony - PlayStation Portable.dat', consoleById('psp'))).toBe(true);
  });

  it('does not let Nintendo DS false-match a 3DS DAT', () => {
    expect(matchesDatFilename('Nintendo - Nintendo 3DS.dat', consoleById('nds'))).toBe(false);
    expect(matchesDatFilename('Nintendo - Nintendo 3DS.dat', consoleById('3ds'))).toBe(true);
  });

  it('matches real downloaded Atari DAT filenames ("Atari - Atari 2600...", not "Atari - 2600...")', () => {
    // Regression test: the console's actual name repeats "Atari" (it's
    // literally called "Atari 2600"), same as "Nintendo - Nintendo 64" — a
    // real bug shipped with the wrong expected base name ("Atari - 2600.dat"),
    // which isn't even a prefix of the real file, so no rescan ever found it.
    expect(
      matchesDatFilename('Atari - Atari 2600 (20260710-075425).dat', consoleById('atari2600')),
    ).toBe(true);
    expect(
      matchesDatFilename('Atari - Atari 5200 (20260412-121350).dat', consoleById('atari5200')),
    ).toBe(true);
    expect(
      matchesDatFilename('Atari - Atari 7800 (BIN) (20260601-051249).dat', consoleById('atari7800')),
    ).toBe(true);
  });

  it('rejects a completely unrelated filename', () => {
    expect(matchesDatFilename('Nintendo - Nintendo 64.dat', consoleById('ps2'))).toBe(false);
  });

  it('rejects a non-.dat file even if the name matches', () => {
    expect(matchesDatFilename('Sony - PlayStation 2.dat.txt', consoleById('ps2'))).toBe(false);
  });
});
