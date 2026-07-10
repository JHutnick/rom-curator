import { describe, expect, it } from 'vitest';
import { parseDat, normalizeFilenameKey } from '../datParser';

const SAMPLE_DAT = `<?xml version="1.0"?>
<datafile>
  <header><name>Test Console</name></header>
  <game name="Chrono Trigger (USA)">
    <rom name="Chrono Trigger (USA).sfc" size="4194304" crc="AABBCCDD" md5="deadbeef" sha1="cafebabe"/>
  </game>
  <game name="Super Mario World (Europe) (Rev 1)">
    <rom name="Super Mario World (Europe) (Rev 1).sfc" size="524288" crc="12345678"/>
  </game>
</datafile>`;

describe('parseDat', () => {
  const lookup = parseDat(SAMPLE_DAT);

  it('indexes entries by lowercased CRC32', () => {
    const entry = lookup.byCrc32.get('aabbccdd');
    expect(entry?.gameName).toBe('Chrono Trigger (USA)');
    expect(entry?.romFilename).toBe('Chrono Trigger (USA).sfc');
  });

  it('extracts region from the game name', () => {
    expect(lookup.byCrc32.get('aabbccdd')?.region).toBe('USA');
    expect(lookup.byCrc32.get('12345678')?.region).toBe('Europe');
  });

  it('indexes entries by normalized filename', () => {
    const entry = lookup.byFilename.get(normalizeFilenameKey('Chrono Trigger (USA).sfc'));
    expect(entry?.gameName).toBe('Chrono Trigger (USA)');
  });

  it('normalizeFilenameKey strips extension and lowercases', () => {
    expect(normalizeFilenameKey('Chrono Trigger (USA).SFC')).toBe('chrono trigger (usa)');
  });
});
