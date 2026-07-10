import { useState } from 'react';
import type { AppConfig, ConsoleId } from '../shared/types';
import { CONSOLES, guessConsoleFromFolderName } from '../main/consoleConfig';

interface Props {
  initial: AppConfig;
  onSave: (config: AppConfig) => void;
}

export default function SetupScreen({ initial, onSave }: Props) {
  const [config, setConfig] = useState<AppConfig>(initial);

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
          A folder containing No-Intro / Redump DAT files you've downloaded yourself (from
          Datomatic / redump.org — these sites don't allow automated downloads, so this is a
          manual one-time step).
        </p>
        <div className="folder-picker">
          <span>{config.datFolder || '(not set)'}</span>
          <button onClick={() => pickFolder('datFolder')}>Choose…</button>
        </div>
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
          <span className="mono">dev.twitch.tv/console/apps</span>. Leave blank to skip ratings.
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
    </div>
  );
}
