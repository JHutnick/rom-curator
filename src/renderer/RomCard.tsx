import type { CuratedRom, CurationStatus } from '../shared/types';
import { formatBytes } from '../shared/curationHelpers';

interface Props {
  rom: CuratedRom;
  onStatusChange: (romId: number, status: CurationStatus) => void;
}

const CONFIDENCE_LABEL: Record<CuratedRom['matchConfidence'], string> = {
  'hash-verified': 'Verified dump',
  'filename-match': 'Filename match',
  'translated-hack': 'Translated/Hacked',
  unmatched: 'Unidentified',
};

export default function RomCard({ rom, onStatusChange }: Props) {
  const rating = rom.igdb?.aggregatedRating ?? rom.igdb?.rating;

  return (
    <div className={`rom-card status-${rom.status}`}>
      {rom.igdb?.coverUrl ? (
        <img className="cover" src={rom.igdb.coverUrl} alt="" />
      ) : (
        <div className="cover cover-placeholder" />
      )}
      <div className="rom-card-body">
        <div className="rom-name">{rom.matchedName ?? rom.filename}</div>
        <div className={`confidence confidence-${rom.matchConfidence}`}>
          {CONFIDENCE_LABEL[rom.matchConfidence]}
          {rom.region ? ` · ${rom.region}` : ''}
        </div>
        <div className="rom-meta-row">
          {rating != null && <span className="rating">★ {rating.toFixed(0)}</span>}
          <span className="filesize">{formatBytes(rom.sizeBytes)}</span>
        </div>
        {rom.igdb?.genres?.length ? (
          <div className="genres">{rom.igdb.genres.join(', ')}</div>
        ) : null}
      </div>
      <div className="rom-card-actions">
        <button
          className={rom.status === 'keep' ? 'active' : ''}
          onClick={() => onStatusChange(rom.id, 'keep')}
        >
          Keep
        </button>
        <button
          className={rom.status === 'maybe' ? 'active' : ''}
          onClick={() => onStatusChange(rom.id, 'maybe')}
        >
          Maybe
        </button>
        <button
          className={rom.status === 'skip' ? 'active' : ''}
          onClick={() => onStatusChange(rom.id, 'skip')}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
