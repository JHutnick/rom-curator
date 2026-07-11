import { useMemo, useState } from 'react';
import type { CuratedRom, CurationStatus, ConsoleId, MatchConfidence } from '../shared/types';
import { CONSOLES } from '../main/consoleConfig';
import { computeDuplicateSkipIds, formatBytes } from '../shared/curationHelpers';
import RomCard from './RomCard';

type SortMode = 'rating' | 'popularity' | 'name' | 'size';

const MIN_RATING_COUNT_OPTIONS = [0, 10, 50, 100, 500, 1000];
const SHOW_CONSOLE_SUMMARY_KEY = 'romCurator:showConsoleSummary';

interface Props {
  roms: CuratedRom[];
  onStatusChange: (romId: number, status: CurationStatus) => void;
  onBulkStatus: (romIds: number[], status: CurationStatus) => void;
  onExport: () => void;
  onRescan: () => void;
  onEditSetup: () => void;
  exporting: boolean;
}

export default function ReviewScreen({
  roms,
  onStatusChange,
  onBulkStatus,
  onExport,
  onRescan,
  onEditSetup,
  exporting,
}: Props) {
  const [consoleFilter, setConsoleFilter] = useState<ConsoleId | 'all'>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [confidenceFilter, setConfidenceFilter] = useState<MatchConfidence | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<CurationStatus | 'all'>('all');
  const [minRating, setMinRating] = useState(0);
  const [minRatingCount, setMinRatingCount] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>('rating');
  const [search, setSearch] = useState('');
  const [showConsoleSummary, setShowConsoleSummary] = useState(
    () => localStorage.getItem(SHOW_CONSOLE_SUMMARY_KEY) !== 'false',
  );

  function toggleConsoleSummary() {
    setShowConsoleSummary((prev) => {
      const next = !prev;
      localStorage.setItem(SHOW_CONSOLE_SUMMARY_KEY, String(next));
      return next;
    });
  }

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const r of roms) if (r.region) set.add(r.region);
    return Array.from(set).sort();
  }, [roms]);

  // Only offer consoles that actually have scanned games, not all 24 supported
  // ones — with just SNES configured, seeing 23 empty options is just clutter.
  // Order follows CONSOLES (a stable, meaningful order) rather than scan order.
  const presentConsoles = useMemo(() => {
    const ids = new Set(roms.map((r) => r.consoleId));
    return CONSOLES.filter((c) => ids.has(c.id));
  }, [roms]);

  const filtered = useMemo(() => {
    return roms
      .filter((r) => consoleFilter === 'all' || r.consoleId === consoleFilter)
      .filter((r) => regionFilter === 'all' || r.region === regionFilter)
      .filter((r) => confidenceFilter === 'all' || r.matchConfidence === confidenceFilter)
      .filter((r) => statusFilter === 'all' || r.status === statusFilter)
      .filter((r) => {
        const rating = r.igdb?.aggregatedRating ?? r.igdb?.rating ?? 0;
        return rating >= minRating;
      })
      .filter((r) => (r.igdb?.ratingCount ?? 0) >= minRatingCount)
      .filter((r) => {
        if (!search.trim()) return true;
        const name = (r.matchedName ?? r.filename).toLowerCase();
        return name.includes(search.toLowerCase());
      })
      .sort((a, b) => {
        if (sortMode === 'name') {
          return (a.matchedName ?? a.filename).localeCompare(b.matchedName ?? b.filename);
        }
        if (sortMode === 'size') return b.sizeBytes - a.sizeBytes;
        if (sortMode === 'popularity') {
          return (b.igdb?.ratingCount ?? -1) - (a.igdb?.ratingCount ?? -1);
        }
        const ra = a.igdb?.aggregatedRating ?? a.igdb?.rating ?? -1;
        const rb = b.igdb?.aggregatedRating ?? b.igdb?.rating ?? -1;
        return rb - ra;
      });
  }, [roms, consoleFilter, regionFilter, confidenceFilter, statusFilter, minRating, minRatingCount, sortMode, search]);

  // Grouped by console when there's more than one system in view — a flat grid
  // of thousands of cards across 17 consoles stops being scannable otherwise.
  // Section order follows CONSOLES (a stable, meaningful order) rather than
  // whatever order files happened to be scanned in.
  const consoleGroups = useMemo(() => {
    if (consoleFilter !== 'all') return null;
    const byConsole = new Map<ConsoleId, CuratedRom[]>();
    for (const rom of filtered) {
      const group = byConsole.get(rom.consoleId);
      if (group) group.push(rom);
      else byConsole.set(rom.consoleId, [rom]);
    }
    return CONSOLES.filter((c) => byConsole.has(c.id)).map((c) => ({
      console: c,
      roms: byConsole.get(c.id)!,
    }));
  }, [filtered, consoleFilter]);

  const duplicateSkipIds = useMemo(() => computeDuplicateSkipIds(roms), [roms]);

  const stats = useMemo(() => {
    let keep = 0;
    let maybe = 0;
    let skip = 0;
    let undecided = 0;
    let keptSizeBytes = 0;
    for (const r of roms) {
      if (r.status === 'keep') {
        keep++;
        keptSizeBytes += r.sizeBytes;
      } else if (r.status === 'maybe') maybe++;
      else if (r.status === 'skip') skip++;
      else undecided++;
    }
    return { keep, maybe, skip, undecided, keptSizeBytes };
  }, [roms]);

  // Per-console breakdown — independent of the current filters, so it always
  // shows the full picture ("which consoles still need review work") even
  // while you're zoomed into a specific filtered view elsewhere on screen.
  const perConsoleStats = useMemo(() => {
    const byConsole = new Map<ConsoleId, { keep: number; maybe: number; skip: number; undecided: number; total: number }>();
    for (const r of roms) {
      const entry = byConsole.get(r.consoleId) ?? { keep: 0, maybe: 0, skip: 0, undecided: 0, total: 0 };
      entry.total++;
      if (r.status === 'keep') entry.keep++;
      else if (r.status === 'maybe') entry.maybe++;
      else if (r.status === 'skip') entry.skip++;
      else entry.undecided++;
      byConsole.set(r.consoleId, entry);
    }
    return CONSOLES.filter((c) => byConsole.has(c.id)).map((c) => ({ console: c, stats: byConsole.get(c.id)! }));
  }, [roms]);

  function jumpTo(consoleId: ConsoleId, status: CurationStatus) {
    const alreadyThere = consoleFilter === consoleId && statusFilter === status;
    setConsoleFilter(alreadyThere ? 'all' : consoleId);
    setStatusFilter(alreadyThere ? 'all' : status);
  }

  return (
    <div className="review-screen">
      <div className="toolbar">
        <div className="toolbar-row toolbar-filters">
          <select value={consoleFilter} onChange={(e) => setConsoleFilter(e.target.value as ConsoleId | 'all')}>
            <option value="all">All consoles</option>
            {presentConsoles.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <select value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)}>
            <option value="all">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value as MatchConfidence | 'all')}>
            <option value="all">Any match type</option>
            <option value="hash-verified">Verified dump</option>
            <option value="filename-match">Filename match</option>
            <option value="translated-hack">Translated/Hacked</option>
            <option value="unmatched">Unidentified</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as CurationStatus | 'all')}>
            <option value="all">Any status</option>
            <option value="undecided">Undecided</option>
            <option value="keep">Keep</option>
            <option value="maybe">Maybe</option>
            <option value="skip">Skip</option>
          </select>

          <input
            placeholder="Search titles…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <label>
            Min rating
            <input
              type="range"
              min={0}
              max={100}
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
            />
            {minRating}
          </label>

          <select value={minRatingCount} onChange={(e) => setMinRatingCount(Number(e.target.value))}>
            {MIN_RATING_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Any # of ratings' : `≥${n} ratings`}
              </option>
            ))}
          </select>

          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
            <option value="rating">Sort: Rating</option>
            <option value="popularity">Sort: Popularity (# ratings)</option>
            <option value="name">Sort: Name</option>
            <option value="size">Sort: File size</option>
          </select>
        </div>

        <div className="toolbar-row toolbar-actions">
          <div className="toolbar-group">
            <button onClick={() => onBulkStatus(filtered.map((r) => r.id), 'keep')}>
              Keep all shown ({filtered.length})
            </button>
            <button onClick={() => onBulkStatus(filtered.map((r) => r.id), 'skip')}>
              Skip all shown ({filtered.length})
            </button>
            <button
              disabled={duplicateSkipIds.length === 0}
              title="Groups games by title (ignoring region/revision tags) and marks every copy except the best-region one as Skip — this includes games already marked Keep (e.g. from a bulk 'Keep all shown' pass). Only a rom you've already explicitly marked Skip is left untouched."
              onClick={() => onBulkStatus(duplicateSkipIds, 'skip')}
            >
              Skip duplicates, keep best region ({duplicateSkipIds.length})
            </button>
          </div>

          <span className="spacer" />

          <div className="toolbar-group">
            <button onClick={onEditSetup}>Edit setup…</button>
            <button onClick={onRescan}>Rescan</button>
            <button className="primary" disabled={stats.keep === 0 || exporting} onClick={onExport}>
              {exporting ? 'Exporting…' : `Export ${stats.keep} kept`}
            </button>
          </div>
        </div>
      </div>

      <div className="stats-bar">
        <span>
          {filtered.length} of {roms.length} shown
        </span>
        {(['keep', 'maybe', 'skip', 'undecided'] as const).map((s) => (
          <button
            key={s}
            className={`stat stat-${s}${statusFilter === s ? ' stat-active' : ''}`}
            title={`Click to ${statusFilter === s ? 'clear this' : 'filter to this'} status`}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
          >
            {stats[s]} {s}
          </button>
        ))}
        <span className="spacer" />
        <span>{formatBytes(stats.keptSizeBytes)} to export</span>
      </div>

      {perConsoleStats.length > 1 && (
        <div className="console-summary-section">
          <button className="console-summary-toggle" onClick={toggleConsoleSummary}>
            {showConsoleSummary ? '▾' : '▸'} Console breakdown
          </button>
          {showConsoleSummary && (
            <div className="console-summary">
              <div className="console-summary-row console-summary-header-row">
                <span>Console</span>
                <span>Total</span>
                <span>Keep</span>
                <span>Maybe</span>
                <span>Skip</span>
                <span>Undecided</span>
              </div>
              {perConsoleStats.map(({ console: c, stats: cs }) => (
                <div className="console-summary-row" key={c.id}>
                  <button
                    className={`console-summary-name${consoleFilter === c.id ? ' active' : ''}`}
                    onClick={() => setConsoleFilter(consoleFilter === c.id ? 'all' : c.id)}
                  >
                    {c.label}
                  </button>
                  <span className="console-summary-total">{cs.total}</span>
                  <button className="stat stat-keep" onClick={() => jumpTo(c.id, 'keep')}>
                    {cs.keep}
                  </button>
                  <button className="stat stat-maybe" onClick={() => jumpTo(c.id, 'maybe')}>
                    {cs.maybe}
                  </button>
                  <button className="stat stat-skip" onClick={() => jumpTo(c.id, 'skip')}>
                    {cs.skip}
                  </button>
                  <button className="stat stat-undecided" onClick={() => jumpTo(c.id, 'undecided')}>
                    {cs.undecided}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {consoleGroups ? (
        consoleGroups.map(({ console: c, roms: consoleRoms }) => (
          <section key={c.id}>
            <h3 className="console-section-header">
              {c.label} <span className="console-section-count">({consoleRoms.length})</span>
            </h3>
            <div className="rom-grid">
              {consoleRoms.map((rom) => (
                <RomCard key={rom.id} rom={rom} onStatusChange={onStatusChange} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="rom-grid">
          {filtered.map((rom) => (
            <RomCard key={rom.id} rom={rom} onStatusChange={onStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
