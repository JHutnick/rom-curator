import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig } from '../shared/types';

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

export async function loadConfig(userDataDir: string): Promise<AppConfig> {
  try {
    const raw = await readFile(configPath(userDataDir), 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(userDataDir: string, config: AppConfig): Promise<void> {
  await writeFile(configPath(userDataDir), JSON.stringify(config, null, 2), 'utf-8');
}
