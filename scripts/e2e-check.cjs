// End-to-end pipeline check against synthetic fixtures (no Electron, no network).
// Run after `npm run build:electron`: node scripts/e2e-check.cjs
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');

const { scanRoots, identifyFile } = require('../dist-electron/src/main/scanner');
const { parseDat } = require('../dist-electron/src/main/datParser');
const { exportRoms } = require('../dist-electron/src/main/exporter');

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`ok: ${msg}`);
  }
}

/** Hand-builds a minimal valid zip (STORED entries) — mirrors the real user
 *  collection, which turned out to be entirely zip-wrapped, one rom per zip. */
function buildStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { filename, data } of entries) {
    const nameBuf = Buffer.from(filename, 'utf-8');
    const crc = zlib.crc32(data) >>> 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localEntry = Buffer.concat([localHeader, nameBuf, data]);
    localParts.push(localEntry);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localEntry.length;
  }

  const localSection = Buffer.concat(localParts);
  const centralSection = Buffer.concat(centralParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSection.length, 12);
  eocd.writeUInt32LE(localSection.length, 16);

  return Buffer.concat([localSection, centralSection, eocd]);
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rom-curator-e2e-'));
  const snesDir = path.join(tmp, 'roms', 'SNES');
  const ps1Dir = path.join(tmp, 'roms', 'PS1');
  fs.mkdirSync(snesDir, { recursive: true });
  fs.mkdirSync(ps1Dir, { recursive: true });

  // A "good" SNES dump whose CRC32 will exactly match a DAT entry.
  const chronoContent = Buffer.from('CHRONO TRIGGER FAKE ROM CONTENT'.repeat(500));
  fs.writeFileSync(path.join(snesDir, 'Chrono Trigger (USA).sfc'), chronoContent);
  const chronoCrc = (zlib.crc32(chronoContent) >>> 0).toString(16).padStart(8, '0');

  // A "bad" dump (content doesn't match any known-good CRC) but with a filename
  // that IS in the DAT — should fall back to filename-match, not hash-verified.
  const marioContent = Buffer.from('CORRUPTED OR MODIFIED DUMP'.repeat(100));
  fs.writeFileSync(path.join(snesDir, 'Super Mario World (USA).sfc'), marioContent);

  // A totally unknown SNES file — should end up unmatched.
  fs.writeFileSync(path.join(snesDir, 'Homebrew Demo.sfc'), Buffer.from('unknown'));

  // A PS1 title (filename-match path only, no hashing since PS1.hashOnScan = false).
  fs.writeFileSync(path.join(ps1Dir, 'Final Fantasy VII (USA) (Disc 1).cue'), Buffer.from('cue-file'));

  // A zip-wrapped SNES rom — mirrors the user's real collection, which turned
  // out to be entirely .zip-per-game rather than raw .sfc files.
  const zoopContent = Buffer.from('ZOOP FAKE ROM CONTENT'.repeat(300));
  const zoopCrc = (zlib.crc32(zoopContent) >>> 0).toString(16).padStart(8, '0');
  const zoopZip = buildStoredZip([{ filename: 'Zoop (USA).sfc', data: zoopContent }]);
  fs.writeFileSync(path.join(snesDir, 'Zoop (USA).zip'), zoopZip);

  const snesDat = `<?xml version="1.0"?>
<datafile>
  <game name="Chrono Trigger (USA)">
    <rom name="Chrono Trigger (USA).sfc" size="${chronoContent.length}" crc="${chronoCrc}"/>
  </game>
  <game name="Super Mario World (USA)">
    <rom name="Super Mario World (USA).sfc" size="524288" crc="ffffffff"/>
  </game>
  <game name="Zoop (USA)">
    <rom name="Zoop (USA).sfc" size="${zoopContent.length}" crc="${zoopCrc}"/>
  </game>
</datafile>`;
  const ps1Dat = `<?xml version="1.0"?>
<datafile>
  <game name="Final Fantasy VII (USA) (Disc 1)">
    <rom name="Final Fantasy VII (USA) (Disc 1).cue" size="1" crc=""/>
  </game>
</datafile>`;

  const snesLookup = parseDat(snesDat);
  const ps1Lookup = parseDat(ps1Dat);
  const emptyLookup = { byCrc32: new Map(), byFilename: new Map() };

  const files = await scanRoots([tmp]);
  assert(files.length === 5, `scanRoots found 5 files (got ${files.length})`);

  const lookupFor = (consoleId) =>
    consoleId === 'snes' ? snesLookup : consoleId === 'ps1' ? ps1Lookup : emptyLookup;

  const results = new Map();
  for (const file of files) {
    const id = await identifyFile(file, lookupFor(file.consoleId));
    results.set(file.filename, id);
  }

  const chrono = results.get('Chrono Trigger (USA).sfc');
  assert(chrono.confidence === 'hash-verified', 'Chrono Trigger identified as hash-verified');
  assert(chrono.matchedName === 'Chrono Trigger (USA)', 'Chrono Trigger matched name is correct');
  assert(chrono.region === 'USA', 'Chrono Trigger region extracted as USA');

  const mario = results.get('Super Mario World (USA).sfc');
  assert(mario.confidence === 'filename-match', 'Corrupted Mario dump falls back to filename-match, not hash-verified');
  assert(mario.matchedName === 'Super Mario World (USA)', 'Mario matched name is correct via filename fallback');

  const homebrew = results.get('Homebrew Demo.sfc');
  assert(homebrew.confidence === 'unmatched', 'Unknown homebrew file correctly left unmatched');

  const ff7 = results.get('Final Fantasy VII (USA) (Disc 1).cue');
  assert(ff7.confidence === 'filename-match', 'PS1 title identified via filename-match (no hashing)');
  assert(ff7.crc32 === null, 'PS1 title was NOT hashed (large-file path)');

  const zoopFile = files.find((f) => f.filename === 'Zoop (USA).sfc');
  assert(Boolean(zoopFile), 'zip-wrapped rom was found by scanRoots (inner filename, not the .zip itself)');
  assert(zoopFile.path.endsWith('.zip'), 'zip-wrapped rom keeps the .zip as its on-disk path');
  assert(zoopFile.knownCrc32 === zoopCrc, 'zip-wrapped rom carries the CRC32 read from the zip header');
  const zoop = results.get('Zoop (USA).sfc');
  assert(zoop.confidence === 'hash-verified', 'zip-wrapped rom identified as hash-verified using the zip-stored CRC (no re-hash of the .zip bytes)');
  assert(zoop.matchedName === 'Zoop (USA)', 'zip-wrapped rom matched name is correct');

  // Export path: copy the confidently-identified games, skip the rest.
  const destRoot = path.join(tmp, 'dest');
  const exportInput = [
    { id: 1, path: path.join(snesDir, 'Chrono Trigger (USA).sfc'), consoleId: 'snes', matchedName: chrono.matchedName, filename: 'Chrono Trigger (USA).sfc', region: chrono.region },
    { id: 4, path: path.join(ps1Dir, 'Final Fantasy VII (USA) (Disc 1).cue'), consoleId: 'ps1', matchedName: ff7.matchedName, filename: 'Final Fantasy VII (USA) (Disc 1).cue', region: ff7.region },
    { id: 5, path: zoopFile.path, consoleId: 'snes', matchedName: zoop.matchedName, filename: zoopFile.filename, region: zoop.region },
  ];
  const first = await exportRoms(destRoot, exportInput);
  assert(first.manifest.length === 3, 'export manifest has 3 entries');
  assert(first.copiedCount === 3, 'first export run actually copies all 3 files');

  const second = await exportRoms(destRoot, exportInput);
  assert(second.manifest.length === 3, 'second export run still reports all 3 in the manifest');
  assert(second.copiedCount === 0, 'second export run with no changes copies nothing (incremental, not a full re-copy)');

  const exportedSnes = path.join(destRoot, 'SNES', 'Chrono Trigger (USA).sfc');
  const exportedPs1 = path.join(destRoot, 'PlayStation', 'Final Fantasy VII (USA) (Disc 1).cue');
  const exportedZoop = path.join(destRoot, 'SNES', 'Zoop (USA).zip');
  assert(fs.existsSync(exportedSnes), `exported file exists at ${exportedSnes}`);
  assert(fs.existsSync(exportedPs1), `exported file exists at ${exportedPs1}`);
  assert(
    fs.readFileSync(exportedSnes).equals(chronoContent),
    'exported SNES file content matches source (real copy, not corrupted)',
  );
  assert(
    fs.existsSync(exportedZoop),
    'zip-wrapped rom exports keeping the .zip extension (not mislabeled with the inner .sfc extension)',
  );
  assert(
    fs.readFileSync(exportedZoop).equals(zoopZip),
    'exported zip file content matches the original zip bytes exactly',
  );
  assert(
    fs.existsSync(path.join(destRoot, 'manifest.json')),
    'manifest.json was written to dest root',
  );

  fs.rmSync(tmp, { recursive: true, force: true });

  if (process.exitCode) {
    console.error('\nE2E CHECK FAILED');
  } else {
    console.log('\nE2E CHECK PASSED — scan -> identify -> export pipeline verified end-to-end.');
  }
}

main();
