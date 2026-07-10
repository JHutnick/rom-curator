import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeTitle, resolveTitle, stripRomTags } from '../igdbClient';

const CREDS = { clientId: 'test-id', clientSecret: 'test-secret' };

function mockFetch(games: Array<{ id: number; name: string }>) {
  return vi.fn(async (url: string) => {
    if (url.includes('id.twitch.tv')) {
      return {
        ok: true,
        json: async () => ({ access_token: 'fake-token', expires_in: 3600 }),
      } as Response;
    }
    return {
      ok: true,
      json: async () => games,
    } as Response;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('normalizeTitle', () => {
  it('lowercases and collapses punctuation to spaces', () => {
    expect(normalizeTitle("Chrono Trigger (USA)")).toBe('chrono trigger usa');
    expect(normalizeTitle('Kirby\'s Dream Land')).toBe('kirby s dream land');
  });
});

describe('stripRomTags', () => {
  it('strips one or more trailing parenthetical tags', () => {
    expect(stripRomTags('Chrono Trigger (USA)')).toBe('Chrono Trigger');
    expect(stripRomTags('Super Mario World (Europe) (Rev 1)')).toBe('Super Mario World');
  });

  it('leaves titles with no tags unchanged', () => {
    expect(stripRomTags('Chrono Trigger')).toBe('Chrono Trigger');
  });
});

describe('resolveTitle', () => {
  it('prefers an exact normalized-title match over the first result', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch([
        { id: 1, name: 'Chrono Trigger: Definitive Edition' },
        { id: 2, name: 'Chrono Trigger' },
      ]),
    );
    const result = await resolveTitle(CREDS, 'Chrono Trigger (USA)');
    expect(result.quality).toBe('exact');
    expect(result.info?.igdbId).toBe(2);
  });

  it('falls back to the top result with "fuzzy" quality when no exact match exists', async () => {
    vi.stubGlobal('fetch', mockFetch([{ id: 5, name: 'Chrono Trigger: Definitive Edition' }]));
    const result = await resolveTitle(CREDS, 'Chrono Trigger (USA)');
    expect(result.quality).toBe('fuzzy');
    expect(result.info?.igdbId).toBe(5);
  });

  it('returns "none" when the search has no results', async () => {
    vi.stubGlobal('fetch', mockFetch([]));
    const result = await resolveTitle(CREDS, 'Some Totally Obscure Homebrew Title');
    expect(result.quality).toBe('none');
    expect(result.info).toBeNull();
  });
});
