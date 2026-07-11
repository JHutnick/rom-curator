import { useEffect, useState } from 'react';
import type { AppConfig, ConsoleId } from '../shared/types';
import { CONSOLES, guessConsoleFromFolderName } from '../main/consoleConfig';

interface Props {
  initial: AppConfig;
  onSave: (config: AppConfig) => void;
}

export default function SetupScreen({ initial, onSave }: Props) {
  const [config, setConfig] = useState<AppConfig>(initial);
  const [datStatus, setDatStatus] = useState<Record<ConsoleId, boolean> | null>(null);
  const [checkingDats, setCheckingDats] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function handleReset() {
    setResetMessage(null);
    const { reset } = await window.romCurator.resetData();
    if (reset) {
      setResetMessage('All scanned ROMs and curation decisions have been cleared. Click "Save & continue" to rescan.');
    }
  }

  async function checkDats(datFolder: string) {
    if (!datFolder) {
      setDatStatus(null);
      return;
    }
    setCheckingDats(true);
    try {
      setDatStatus(await window.romCurator.checkDatFiles(datFolder));
    } finally {
      setCheckingDats(false);
    }
  }

  useEffect(() => {
    checkDats(config.datFolder);
    // Only re-check automatically when the folder path itself changes — files
    // added to the same folder need the "Recheck" button since we don't watch it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.datFolder]);

  async function pickFolder(field: 'datFolder' | 'destFolder') {
    const folder = await window.romCurator.chooseFolder();
    if (folder) setConfig((c) => ({ ...c, [field]: folder }));
  }

  async function addRomRoot() {
    const folder = await window.romCurator.chooseFolder();
    if (!folder || config.romRoots.some((r) => r.path === folder)) return;
    // Their collection is commonly already organized one-folder-per-console
    // (e.g. "ROMS/snes", "ROMS/ps2") — guess from the name, but it's always
    // editable via the dropdown right next to it.
    const guessed = guessConsoleFromFolderName(folder) ?? CONSOLES[0].id;
    setConfig((c) => ({ ...c, romRoots: [...c.romRoots, { path: folder, consoleId: guessed }] }));
  }

  function removeRomRoot(rootPath: string) {
    setConfig((c) => ({ ...c, romRoots: c.romRoots.filter((r) => r.path !== rootPath) }));
  }

  function setRomRootConsole(rootPath: string, consoleId: ConsoleId) {
    setConfig((c) => ({
      ...c,
      romRoots: c.romRoots.map((r) => (r.path === rootPath ? { ...r, consoleId } : r)),
    }));
  }

  const canSave = config.romRoots.length > 0 && config.datFolder && config.destFolder;
  const datFoundCount = datStatus ? Object.values(datStatus).filter(Boolean).length : 0;

  return (
    <div className="setup-screen">
      <h1>ROM Curator — Setup</h1>

      <section>
        <h2>ROM folders</h2>
        <p className="hint">
          Where your ROMs live — add one folder per console (your collection is probably already
          organized that way). I'll guess the console from the folder name; double-check it in the
          dropdown, since a couple of consoles share disc-image extensions and rely on this being
          right.
        </p>
        <ul className="folder-list rom-root-list">
          {config.romRoots.map((r) => (
            <li key={r.path}>
              <span className="rom-root-path">{r.path}</span>
              <select
                value={r.consoleId}
                onChange={(e) => setRomRootConsole(r.path, e.target.value as ConsoleId)}
              >
                {CONSOLES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button onClick={() => removeRomRoot(r.path)}>Remove</button>
            </li>
          ))}
        </ul>
        <button onClick={addRomRoot}>Add ROM folder…</button>
      </section>

      <section>
        <h2>DAT files folder</h2>
        <p className="hint">
          A folder containing No-Intro / Redump DAT files you've downloaded yourself —{' '}
          <a href="https://datomatic.no-intro.org/" target="_blank" rel="noreferrer">
            datomatic.no-intro.org
          </a>{' '}
          for cartridge consoles,{' '}
          <a href="http://redump.org/downloads/" target="_blank" rel="noreferrer">
            redump.org/downloads
          </a>{' '}
          for disc-based ones. Neither site allows automated downloads, so this is a manual step —
          rename files to match if a site names them differently (exact names below).
        </p>
        <div className="folder-picker">
          <span>{config.datFolder || '(not set)'}</span>
          <button onClick={() => pickFolder('datFolder')}>Choose…</button>
        </div>

        {config.datFolder && (
          <div className="dat-status">
            <div className="dat-status-header">
              <span>
                {checkingDats
                  ? 'Checking…'
                  : datStatus
                    ? `${datFoundCount} of ${CONSOLES.length} DAT files found`
                    : ''}
              </span>
              <button onClick={() => checkDats(config.datFolder)} disabled={checkingDats}>
                Recheck
              </button>
            </div>
            <ul className="dat-status-list">
              {CONSOLES.map((c) => {
                const found = datStatus?.[c.id] ?? false;
                return (
                  <li key={c.id} className={found ? 'dat-found' : 'dat-missing'} title={c.datFile}>
                    {found ? '✓' : '✗'} {c.label}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section>
        <h2>Export destination</h2>
        <p className="hint">Where curated "keep" games get copied to.</p>
        <div className="folder-picker">
          <span>{config.destFolder || '(not set)'}</span>
          <button onClick={() => pickFolder('destFolder')}>Choose…</button>
        </div>
      </section>

      <section>
        <h2>IGDB / Twitch credentials (optional)</h2>
        <p className="hint">
          Used to fetch ratings/cover art for identified games. Create a free app at{' '}
          <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noreferrer">
            dev.twitch.tv/console/apps
          </a>
          . Leave blank to skip ratings.
        </p>
        <label>
          Client ID
          <input
            value={config.twitchClientId}
            onChange={(e) => setConfig((c) => ({ ...c, twitchClientId: e.target.value }))}
          />
        </label>
        <label>
          Client Secret
          <input
            type="password"
            value={config.twitchClientSecret}
            onChange={(e) => setConfig((c) => ({ ...c, twitchClientSecret: e.target.value }))}
          />
        </label>
      </section>

      <button className="primary" disabled={!canSave} onClick={() => onSave(config)}>
        Save &amp; continue
      </button>

      <section className="danger-zone">
        <h2>Danger zone</h2>
        <p className="hint">
          Clears every scanned ROM and all keep/maybe/skip decisions, for a genuine fresh start.
          Your folder settings and cached IGDB ratings are kept, so a rescan afterward is still
          fast. This cannot be undone.
        </p>
        {resetMessage && <p className="reset-message">{resetMessage}</p>}
        <button className="danger" onClick={handleReset}>
          Reset all data…
        </button>
      </section>
    </div>
  );
}
