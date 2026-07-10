import { useMemo, useState } from 'react';
import type { CuratedRom, CurationStatus, ConsoleId, MatchConfidence } from '../shared/types';
import { CONSOLES } from '../main/consoleConfig';
import { computeDuplicateSkipIds } from '../shared/curationHelpers';
import RomCard from './RomCard';

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
  const [minRating, setMinRating] = useState(0);
  const [search, setSearch] = useState('');

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const r of roms) if (r.region) set.add(r.region);
    return Array.from(set).sort();
  }, [roms]);

  const filtered = useMemo(() => {
    return roms
      .filter((r) => consoleFilter === 'all' || r.consoleId === consoleFilter)
      .filter((r) => regionFilter === 'all' || r.region === regionFilter)
      .filter((r) => confidenceFilter === 'all' || r.matchConfidence === confidenceFilter)
      .filter((r) => {
        const rating = r.igdb?.aggregatedRating ?? r.igdb?.rating ?? 0;
        return rating >= minRating;
      })
      .filter((r) => {
        if (!search.trim()) return true;
        const name = (r.matchedName ?? r.filename).toLowerCase();
        return name.includes(search.toLowerCase());
      })
      .sort((a, b) => {
        const ra = a.igdb?.aggregatedRating ?? a.igdb?.rating ?? -1;
        const rb = b.igdb?.aggregatedRating ?? b.igdb?.rating ?? -1;
        return rb - ra;
      });
  }, [roms, consoleFilter, regionFilter, confidenceFilter, minRating, search]);

  const duplicateSkipIds = useMemo(() => computeDuplicateSkipIds(roms), [roms]);
  const keepCount = roms.filter((r) => r.status === 'keep').length;

  return (
    <div className="review-screen">
      <div className="toolbar">
        <select value={consoleFilter} onChange={(e) => setConsoleFilter(e.target.value as ConsoleId | 'all')}>
          <option value="all">All consoles</option>
          {CONSOLES.map((c) => (
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

        <input
          placeholder="Search titles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value as MatchConfidence | 'all')}>
          <option value="all">Any match type</option>
          <option value="hash-verified">Verified dump</option>
          <option value="filename-match">Filename match</option>
          <option value="translated-hack">Translated/Hacked</option>
          <option value="unmatched">Unidentified</option>
        </select>

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

        <button onClick={() => onBulkStatus(filtered.map((r) => r.id), 'keep')}>
          Keep all shown ({filtered.length})
        </button>
        <button onClick={() => onBulkStatus(filtered.map((r) => r.id), 'skip')}>
          Skip all shown ({filtered.length})
        </button>

        <span className="spacer" />

        <button
          disabled={duplicateSkipIds.length === 0}
          title="Groups games by title (ignoring region/revision tags) and marks every copy except the best-region one as Skip — this includes games already marked Keep (e.g. from a bulk 'Keep all shown' pass). Only a rom you've already explicitly marked Skip is left untouched."
          onClick={() => onBulkStatus(duplicateSkipIds, 'skip')}
        >
          Skip duplicates, keep best region ({duplicateSkipIds.length})
        </button>

        <button onClick={onEditSetup}>Edit setup…</button>
        <button onClick={onRescan}>Rescan</button>
        <button className="primary" disabled={keepCount === 0 || exporting} onClick={onExport}>
          {exporting ? 'Exporting…' : `Export ${keepCount} kept`}
        </button>
      </div>

      <div className="rom-count">{filtered.length} of {roms.length} games</div>

      <div className="rom-grid">
        {filtered.map((rom) => (
          <RomCard key={rom.id} rom={rom} onStatusChange={onStatusChange} />
        ))}
      </div>
    </div>
  );
}
