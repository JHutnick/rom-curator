import { useState } from 'react';
import type { AppConfig } from '../shared/types';

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
    if (folder && !config.romRoots.includes(folder)) {
      setConfig((c) => ({ ...c, romRoots: [...c.romRoots, folder] }));
    }
  }

  function removeRomRoot(folder: string) {
    setConfig((c) => ({ ...c, romRoots: c.romRoots.filter((f) => f !== folder) }));
  }

  const canSave = config.romRoots.length > 0 && config.datFolder && config.destFolder;

  return (
    <div className="setup-screen">
      <h1>ROM Curator — Setup</h1>

      <section>
        <h2>ROM folders</h2>
        <p className="hint">Where your ROMs live (your external drive, or a subfolder on it).</p>
        <ul className="folder-list">
          {config.romRoots.map((f) => (
            <li key={f}>
              <span>{f}</span>
              <button onClick={() => removeRomRoot(f)}>Remove</button>
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
