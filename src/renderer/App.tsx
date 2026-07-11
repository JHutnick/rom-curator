import { useEffect, useState } from 'react';
import type { AppConfig, CuratedRom, CurationStatus, ScanProgress } from '../shared/types';
import { formatDuration } from '../shared/curationHelpers';
import SetupScreen from './SetupScreen';
import ReviewScreen from './ReviewScreen';

const PHASE_LABEL: Record<ScanProgress['phase'], string> = {
  scanning: 'Scanning ROM folders…',
  identifying: 'Identifying games…',
  enriching: 'Fetching ratings from IGDB…',
  done: 'Done',
};

const EMPTY_CONFIG: AppConfig = {
  romRoots: [],
  datFolder: '',
  destFolder: '',
  twitchClientId: '',
  twitchClientSecret: '',
};

type View = 'loading' | 'setup' | 'scanning' | 'review';

function readableError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export default function App() {
  const [view, setView] = useState<View>('loading');
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);
  const [roms, setRoms] = useState<CuratedRom[]>([]);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<
    { count: number; copiedCount: number; destFolder: string } | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await window.romCurator.getConfig();
        setConfig(cfg);
        const isConfigured = cfg.romRoots.length > 0 && cfg.datFolder && cfg.destFolder;
        if (!isConfigured) {
          setView('setup');
          return;
        }
        const existing = await window.romCurator.listRoms();
        if (existing.length > 0) {
          setRoms(existing);
          setView('review');
        } else {
          setView('setup');
        }
      } catch (err) {
        setErrorMessage(`Couldn't load saved settings: ${readableError(err)}`);
        setView('setup');
      }
    })();
  }, []);

  useEffect(() => {
    return window.romCurator.onPipelineProgress(setProgress);
  }, []);

  async function handleSaveConfig(newConfig: AppConfig) {
    await window.romCurator.setConfig(newConfig);
    setConfig(newConfig);
    await runScan();
  }

  async function runScan() {
    setErrorMessage(null);
    setView('scanning');
    try {
      const result = await window.romCurator.runPipeline();
      setRoms(result);
      setView('review');
    } catch (err) {
      // Keep whatever roms/curation we already had — a failed rescan shouldn't
      // wipe out prior progress. Fall back to Setup only if there's nothing to show.
      setErrorMessage(`Scan failed: ${readableError(err)}`);
      setView(roms.length > 0 ? 'review' : 'setup');
    }
  }

  async function handleStatusChange(romId: number, status: CurationStatus) {
    setRoms((prev) => prev.map((r) => (r.id === romId ? { ...r, status } : r)));
    try {
      await window.romCurator.setRomStatus(romId, status);
    } catch (err) {
      setErrorMessage(`Couldn't save that change: ${readableError(err)}`);
    }
  }

  async function handleBulkStatus(romIds: number[], status: CurationStatus) {
    setRoms((prev) => prev.map((r) => (romIds.includes(r.id) ? { ...r, status } : r)));
    try {
      for (const romId of romIds) {
        await window.romCurator.setRomStatus(romId, status);
      }
    } catch (err) {
      setErrorMessage(`Couldn't save all of those changes: ${readableError(err)}`);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportResult(null);
    setErrorMessage(null);
    try {
      const result = await window.romCurator.exportKept();
      setExportResult({
        count: result.exportedCount,
        copiedCount: result.copiedCount,
        destFolder: config.destFolder,
      });
    } catch (err) {
      setErrorMessage(`Export failed: ${readableError(err)}`);
    } finally {
      setExporting(false);
    }
  }

  if (view === 'loading') return <div className="center-message">Loading…</div>;

  if (view === 'setup') {
    return (
      <>
        {errorMessage && (
          <div className="error-banner">
            <span>{errorMessage}</span>
            <span className="spacer" />
            <button onClick={() => setErrorMessage(null)}>Dismiss</button>
          </div>
        )}
        <SetupScreen initial={config} onSave={handleSaveConfig} />
      </>
    );
  }

  if (view === 'scanning') {
    const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <div className="center-message">
        <h2>{progress ? PHASE_LABEL[progress.phase] : 'Scanning your collection…'}</h2>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {progress?.phase === 'enriching' && (
          <p className="scan-count">
            {progress.current} of {progress.total} new lookups
            {progress.etaSeconds != null && progress.etaSeconds > 0
              ? ` — about ${formatDuration(progress.etaSeconds)} left`
              : ''}
          </p>
        )}
        <p>{progress?.message ?? 'Starting…'}</p>
        {progress?.phase === 'enriching' && (
          <p className="scan-note">
            IGDB limits how fast ratings can be fetched, so a first scan across several consoles
            can take a while — this is expected, not stuck.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {errorMessage && (
        <div className="error-banner">
          <span>{errorMessage}</span>
          <span className="spacer" />
          <button onClick={() => setErrorMessage(null)}>Dismiss</button>
        </div>
      )}
      {exportResult && (
        <div className="export-banner">
          <span className="export-banner-icon">✓</span>
          <span>
            Export complete — {exportResult.count} game{exportResult.count === 1 ? '' : 's'} in{' '}
            {exportResult.destFolder}
            {exportResult.copiedCount > 0
              ? ` (${exportResult.copiedCount} newly copied this run)`
              : ' (nothing new to copy — already up to date)'}
            . Keep curating and export again anytime — it skips anything already copied.
          </span>
          <span className="spacer" />
          <button onClick={() => window.romCurator.openExportFolder()}>Open folder</button>
          <button onClick={() => setExportResult(null)}>Dismiss</button>
        </div>
      )}
      <ReviewScreen
        roms={roms}
        onStatusChange={handleStatusChange}
        onBulkStatus={handleBulkStatus}
        onExport={handleExport}
        onRescan={runScan}
        onEditSetup={() => setView('setup')}
        exporting={exporting}
      />
    </>
  );
}
