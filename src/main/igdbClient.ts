import type { IgdbInfo } from '../shared/types';

// Ported from Playume's supabase/functions/igdb-search edge function. That version
// proxies through a server because it ships to end users' phones and can't expose a
// Twitch client secret; this is a local desktop tool the owner runs on their own
// machine, so it's safe to call Twitch/IGDB directly from the main process.

export interface IgdbCredentials {
  clientId: string;
  clientSecret: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

async function getTwitchToken(creds: IgdbCredentials): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const url = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(
    creds.clientId,
  )}&client_secret=${encodeURIComponent(creds.clientSecret)}&grant_type=client_credentials`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) throw new Error(`Twitch token request failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.token;
}

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Strips trailing No-Intro/Redump-style parenthetical tags — "(USA)", "(Rev 1)",
 * "(Disc 1)" — from a DAT-matched game name. IGDB's canonical names never carry
 * these, so leaving them in would make the exact-match check in resolveTitle
 * below almost never fire.
 */
export function stripRomTags(title: string): string {
  return title.replace(/\s*\([^)]*\)/g, '').trim();
}

interface IgdbGame {
  id: number;
  name: string;
  cover?: { image_id: string };
  first_release_date?: number;
  genres?: { name?: string }[];
  rating?: number;
  aggregated_rating?: number;
  rating_count?: number;
  summary?: string;
}

function toIgdbInfo(g: IgdbGame): IgdbInfo {
  return {
    igdbId: g.id,
    name: g.name,
    coverUrl: g.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_small_2x/${g.cover.image_id}.jpg`
      : undefined,
    releaseYear: g.first_release_date
      ? new Date(g.first_release_date * 1000).getUTCFullYear()
      : undefined,
    genres: (g.genres ?? []).map((genre) => genre.name).filter((n): n is string => Boolean(n)),
    rating: g.rating,
    aggregatedRating: g.aggregated_rating,
    ratingCount: g.rating_count,
    summary: g.summary,
  };
}

/**
 * Searches IGDB for a title, optionally scoped to a platform id to reduce the
 * chance of matching a same-named game on the wrong console.
 */
export async function searchIgdb(
  creds: IgdbCredentials,
  query: string,
  platformId?: number,
): Promise<IgdbInfo[]> {
  const q = query
    .replace(/["\\™®©]/g, '')
    .slice(0, 100)
    .trim();
  if (q.length < 2) return [];

  const token = await getTwitchToken(creds);
  const platformClause = platformId ? ` & platforms = (${platformId})` : '';
  const body = `search "${q}"; fields name, cover.image_id, first_release_date, genres.name, rating, aggregated_rating, rating_count, summary; where version_parent = null${platformClause}; limit 8;`;

  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: {
      'Client-ID': creds.clientId,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
    },
    body,
  });
  if (!res.ok) throw new Error(`IGDB request failed: ${res.status}`);
  const games = (await res.json()) as IgdbGame[];
  return games.map(toIgdbInfo);
}

export type MatchQuality = 'exact' | 'fuzzy' | 'none';

export interface IgdbResolution {
  info: IgdbInfo | null;
  quality: MatchQuality;
}

/**
 * Resolves a cleaned ROM title to an IGDB entry. Prefers an exact
 * normalized-title match (avoids confidently linking the wrong game for a
 * common/ambiguous name); falls back to the top search hit tagged as a lower-
 * confidence "fuzzy" match rather than discarding the game entirely.
 */
export async function resolveTitle(
  creds: IgdbCredentials,
  title: string,
  platformId?: number,
): Promise<IgdbResolution> {
  // Deliberately does NOT swallow errors here (network issues, IGDB rate-limit
  // 429s, etc.) — the caller needs to tell "genuinely not on IGDB" (real,
  // cacheable negative result) apart from "the request itself failed" (should
  // be retried later, not cached as a permanent non-match).
  const cleanTitle = stripRomTags(title);
  const results = await searchIgdb(creds, cleanTitle, platformId);
  if (results.length === 0) return { info: null, quality: 'none' };

  const target = normalizeTitle(cleanTitle);
  const exact = results.find((r) => normalizeTitle(r.name) === target);
  if (exact) return { info: exact, quality: 'exact' };

  return { info: results[0], quality: 'fuzzy' };
}
