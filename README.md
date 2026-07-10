# ROM Curator

Identifies, rates, and helps you curate a retro ROM collection down to what's
actually worth keeping — then exports a clean, curated copy into a
per-console folder tree that RetroArch, ES-DE, Cocoon, or any other frontend
can pick up.

## Supported consoles

| Console | Identification | DAT filename expected in your DAT folder |
|---|---|---|
| NES | hash-verified | `Nintendo - Nintendo Entertainment System.dat` |
| SNES | hash-verified | `Nintendo - Super Nintendo Entertainment System.dat` |
| N64 | hash-verified | `Nintendo - Nintendo 64.dat` |
| Game Boy | hash-verified | `Nintendo - Game Boy.dat` |
| Game Boy Color | hash-verified | `Nintendo - Game Boy Color.dat` |
| Game Boy Advance | hash-verified | `Nintendo - Game Boy Advance.dat` |
| Nintendo DS | hash-verified | `Nintendo - Nintendo DS.dat` |
| Genesis / Mega Drive | hash-verified | `Sega - Mega Drive - Genesis.dat` |
| Master System | hash-verified | `Sega - Master System - Mark III.dat` |
| Game Gear | hash-verified | `Sega - Game Gear.dat` |
| PC Engine / TurboGrafx-16 | hash-verified | `NEC - PC Engine - TurboGrafx-16.dat` |
| Atari 2600 | hash-verified | `Atari - 2600.dat` |
| PlayStation | filename-match | `Sony - PlayStation.dat` |
| PlayStation 2 | filename-match | `Sony - PlayStation 2.dat` |
| GameCube | filename-match | `Nintendo - GameCube.dat` |
| Dreamcast | filename-match | `Sega - Dreamcast.dat` |
| Saturn | filename-match | `Sega - Saturn.dat` |

"Hash-verified" consoles get every file CRC32-hashed and checked against the
DAT (catches bad/renamed dumps, near-instant for cartridge-sized files).
"Filename-match" consoles skip hashing — these are disc images, too slow to
hash a whole library of them up front — and are identified by cleaned
filename only.

Arcade (MAME/FBNeo), Neo Geo, and Switch are explicitly out of scope: arcade
romsets bundle multiple split ROM chips per game under a totally different
DAT structure than No-Intro/Redump's one-file-per-game model, and Switch has
no comparable hash/filename DAT ecosystem at all — both would need a
different identification approach, not just more config.

## First-time setup

1. **Install dependencies**: `npm install`
2. **Get DAT files** — No-Intro and Redump don't allow automated downloads,
   so this is manual:
   - No-Intro: https://datomatic.no-intro.org/ (Daily/Standard DATs, per
     console)
   - Redump: http://redump.org/downloads/ (per console)
   - Put them all in **one folder**, named exactly as listed in the table
     above (rename after downloading if the site names them differently).
3. **(Optional) IGDB credentials** — for ratings/cover art. Create a free app
   at https://dev.twitch.tv/console/apps, you'll get a Client ID and Secret.
   Entered in the app's Setup screen; skip to run without ratings.
4. **Run it**: `npm run dev` — opens the app. First run walks you through
   adding ROM folders (one per console — the app guesses the console from the
   folder name, e.g. a folder named `ps2` or `gamecube`, but double-check the
   dropdown next to each one), the DAT folder, an export destination, and
   (optionally) IGDB credentials.

## Scripts

- `npm run dev` — build + launch the app (dev mode, Vite HMR for the UI)
- `npm run build` — production build (`dist-electron/` + `dist/`)
- `npm run dist` — builds a Windows installer (`release/ROM Curator Setup *.exe`)
  via electron-builder. Set `CSC_IDENTITY_AUTO_DISCOVERY=false` if it tries to
  fetch macOS signing tools; if that step fails with a symlink-privilege
  error, enable Windows Developer Mode (Settings → Update & Security → For
  Developers) and retry.
- `npm test` — unit tests (hashing, DAT/zip parsing, IGDB title-matching,
  console/extension disambiguation logic)
- `node scripts/e2e-check.cjs` — synthetic end-to-end pipeline check (scan →
  identify → export) against generated fixtures; run after `npm run
  build:electron`

## How identification works

- **ROM folders are tagged with a console, not sniffed from file extension.**
  Several disc-based consoles share extensions (`.iso`/`.bin`/`.cue` show up
  across PS1/PS2/Saturn, for instance), so once more than a couple of disc
  systems are configured, extension alone can't tell them apart — the folder
  you assign each console to in Setup is authoritative.
- Within a folder, every file (including one rom per `.zip`, the common
  No-Intro packaging convention — read directly from the zip's own stored
  CRC32, no decompression needed) is checked against that console's DAT: hash
  first for hash-verified consoles, filename for everyone else.
- A filename that only resolves after stripping `[T-En by ...]`-style
  fan-translation/hack tags is tagged `translated-hack` — still identified
  and rated, but visibly distinct from a verified-clean original dump.
- Anything that matches none of these ways is still shown in the review UI,
  tagged `unmatched`, rather than silently dropped.

## Adding another console later

Mostly config, in `src/main/consoleConfig.ts`: add an entry to `CONSOLES`
with its extensions, IGDB platform id, and expected DAT filename, plus a
folder-name hint in `FOLDER_NAME_HINTS` for Setup's auto-suggestion.
Cartridge-sized formats should set `hashOnScan: true`; anything disc-image
sized enough that hashing the whole library would be slow should be `false`.
