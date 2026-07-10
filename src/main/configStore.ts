import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig, RomRoot } from '../shared/types';
import { guessConsoleFromFolderName } from './consoleConfig';

const DEFAULT_CONFIG: AppConfig = {
  romRoots: [],
  datFolder: '',
  destFolder: '',
  twitchClientId: '',
  twitchClientSecret: '',
};

export function configPath(userDataDir: string): string {
  return path.join(userDataDir, 'config.json');
}

/**
 * v1 stored romRoots as plain path strings, before multi-console support made
 * that ambiguous (several disc-based consoles share extensions like .iso/.bin,
 * so scanning needs to know which console each folder holds). Old configs get
 * their console guessed from the folder name; anything that can't be guessed
 * is dropped rather than silently scanning as the wrong console — the user
 * will see an empty Setup slot for it and can pick the right console by hand.
 */
function migrateRomRoots(raw: unknown): RomRoot[] {
  if (!Array.isArray(raw)) return [];
  const migrated: RomRoot[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const guessed = guessConsoleFromFolderName(entry);
      if (guessed) migrated.push({ path: entry, consoleId: guessed });
      continue;
    }
    if (entry && typeof entry === 'object' && 'path' in entry && 'consoleId' in entry) {
      migrated.push(entry as RomRoot);
    }
  }
  return migrated;
}

export async function loadConfig(userDataDir: string): Promise<AppConfig> {
  try {
    const raw = await readFile(configPath(userDataDir), 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed, romRoots: migrateRomRoots(parsed.romRoots) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(userDataDir: string, config: AppConfig): Promise<void> {
  await writeFile(configPath(userDataDir), JSON.stringify(config, null, 2), 'utf-8');
}
