# ROM Curator

A desktop app for people who have way more retro ROMs than they'll ever
actually play. It identifies what you have against official No-Intro/Redump
dump databases, pulls in community ratings, and gives you a fast way to
review and curate down to what's actually worth putting on your handheld or
frontend — instead of dumping your entire hoarded backlog onto a device you
have to scroll through forever.

**[⬇ Download the latest release](https://github.com/JHutnick/rom-curator/releases/latest)**
— Windows installer, no build tools or command line required.

> **Heads up on first launch:** this is an independent hobby project, not
> code-signed by a certificate authority, so Windows SmartScreen will show a
> "Windows protected your PC" warning the first time you run the installer.
> Click **"More info"** → **"Run anyway"**. This is normal for small
> unsigned tools and not a sign anything's wrong — you're welcome to read the
> source yourself, it's all right here in this repo.

**This app does not include, download, or source any ROMs.** It only
organizes and identifies files you already have. You're responsible for
where your ROMs come from.

## What it does

- **Identifies your ROMs** against official No-Intro (cartridge consoles)
  and Redump (disc-based consoles) dump databases — hash-verified where
  practical, filename-matched for large disc images, with a fallback that
  can even recognize fan-translation/hack ROMs and tell you what game
  they're a patch of.
- **Pulls in ratings and community popularity** from IGDB, so you can sort
  by quality, by how many people actually rated a game, or both.
- **Flags duplicates** — same game across multiple regions/revisions — and
  can bulk-resolve them down to your preferred region in one click.
- **Lets you review fast**: filter by console/region/rating, bulk actions,
  keep/maybe/skip per game.
- **Exports a clean copy** into a `<Console>/<Game Name>.<ext>` folder tree
  that RetroArch, ES-DE, Cocoon, or any other frontend can pick up directly —
  incremental, so re-exporting after more curating doesn't recopy everything.

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

You don't need to rename downloaded DAT files to match exactly — the app
matches by the console name prefix and tolerates the descriptive suffixes
No-Intro/Redump attach (dates, set IDs, etc.).

Arcade (MAME/FBNeo), Neo Geo, and Switch are explicitly out of scope: arcade
romsets bundle multiple split ROM chips per game under a totally different
DAT structure than No-Intro/Redump's one-file-per-game model, and Switch has
no comparable hash/filename DAT ecosystem at all — both would need a
different identification approach, not just more config.

## Quick start

1. **[Download and run the installer](https://github.com/JHutnick/rom-curator/releases/latest)**
   (see the SmartScreen note above).
2. **Get DAT files** for whichever consoles you have — No-Intro and Redump
   don't allow automated downloads, so this is a manual one-time step per
   console:
   - No-Intro (cartridge consoles): https://datomatic.no-intro.org/
   - Redump (disc-based consoles): http://redump.org/downloads/
   - Put them all in **one folder**. The app will tell you which ones it
     found once you point it there.
3. **(Optional) IGDB credentials** for ratings/cover art/popularity — create
   a free app at https://dev.twitch.tv/console/apps to get a Client ID and
   Secret. Skip this to use the app without ratings.
4. **Launch the app.** First run walks you through adding ROM folders (one
   per console — it guesses the console from the folder name, but
   double-check the dropdown next to each one), the DAT folder, an export
   destination, and the optional IGDB credentials.

## How identification works

- **ROM folders are tagged with a console, not sniffed from file extension.**
  Several disc-based consoles share extensions (`.iso`/`.bin`/`.cue` show up
  across PS1/PS2/Saturn, for instance), so the folder you assign each
  console to in Setup is authoritative.
- Every file — including one rom per `.zip`, the common No-Intro packaging
  convention, read directly from the zip's own stored CRC32 with no
  decompression needed — is checked against that console's DAT: hash first
  for hash-verified consoles, filename for everyone else.
- A filename that only resolves after stripping `[T-En by ...]`-style
  fan-translation/hack tags is tagged `translated-hack` — still identified
  and rated, but visibly distinct from a verified-clean original dump.
- Anything that matches none of these ways is still shown in the review UI,
  tagged `unmatched`, rather than silently dropped.

## Building from source

For development, or if you'd rather not run a prebuilt binary:

```
git clone https://github.com/JHutnick/rom-curator.git
cd rom-curator
npm install
npm run dev
```

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

### Adding another console

Mostly config, in `src/main/consoleConfig.ts`: add an entry to `CONSOLES`
with its extensions, IGDB platform id, and expected DAT filename, plus a
folder-name hint in `FOLDER_NAME_HINTS` for Setup's auto-suggestion.
Cartridge-sized formats should set `hashOnScan: true`; anything disc-image
sized enough that hashing the whole library would be slow should be `false`.

## Contributing

Issues and pull requests welcome — this started as a personal tool, so
expect some rough edges outside the console/workflow I originally built it
for. If something breaks on your collection, an issue with a description of
what you were doing helps a lot.

## License

[MIT](LICENSE)
