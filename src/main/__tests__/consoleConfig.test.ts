import { describe, expect, it } from 'vitest';
import { extensionBelongsToConsole, guessConsoleFromFolderName } from '../consoleConfig';

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
