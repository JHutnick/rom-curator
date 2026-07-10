# ROM Curator

Identifies, rates, and helps you curate a retro ROM collection down to what's
actually worth keeping — then exports a clean, curated copy into a
per-console folder tree that RetroArch, ES-DE, Cocoon, or any other frontend
can pick up.

## v1 scope

Consoles: NES, SNES, N64, GBA, Genesis (hash-verified against No-Intro DAT
files) and PS1 (filename-matched against a Redump DAT — no hashing, discs are
too large to hash the whole library up front). Switch and other very-large-file
platforms are out of scope for v1.

## First-time setup

1. **Install dependencies**: `npm install`
2. **Get DAT files** — No-Intro and Redump don't allow automated downloads,
   so this is manual:
   - No-Intro: https://datomatic.no-intro.org/ (Daily/Standard DATs, per
     console)
   - Redump: http://redump.org/downloads/ (PS1 DAT)
   - Put them all in one folder, named exactly as listed in
     `src/main/consoleConfig.ts` (`datFile` field per console), e.g.
     `Nintendo - Super Nintendo Entertainment System.dat`.
3. **(Optional) IGDB credentials** — for ratings/cover art. Create a free app
   at https://dev.twitch.tv/console/apps, you'll get a Client ID and Secret.
   Entered in the app's Setup screen; skip to run without ratings.
4. **Run it**: `npm run dev` — opens the app, first run walks you through
   picking your ROM folder(s), the DAT folder, an export destination, and
   (optionally) IGDB credentials.

## Scripts

- `npm run dev` — build + launch the app (dev mode, Vite HMR for the UI)
- `npm run build` — production build (`dist-electron/` + `dist/`)
- `npm test` — unit tests (hashing, DAT parsing, IGDB title-matching logic)
- `node scripts/e2e-check.cjs` — synthetic end-to-end pipeline check (scan →
  identify → export) against generated fixtures; run after `npm run
  build:electron`

## How identification works

- Cartridge consoles: every file gets CRC32-hashed and matched against the
  console's DAT by hash first (`hash-verified` — confirms it's a known-good,
  unmodified dump), falling back to a filename match if the hash doesn't hit
  anything (`filename-match`).
- PS1 (and any future disc-based console): filename-match only, no hashing —
  full-file hashing of disc images is too slow to run across a whole library
  up front.
- Anything that matches neither way is still shown in the review UI, tagged
  `unmatched`, rather than silently dropped.

## Adding another console later

Mostly config, in `src/main/consoleConfig.ts`: add an entry to `CONSOLES`
with its extensions, IGDB platform id, and expected DAT filename. Cartridge-
sized formats should set `hashOnScan: true`; anything disc/cart-image-sized
enough that hashing the whole library would be slow should be `false`.
