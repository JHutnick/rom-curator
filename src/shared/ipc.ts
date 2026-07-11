import type { AppConfig, ConsoleId, CuratedRom, CurationStatus, ExportProgress, ScanProgress } from './types';

export const IPC = {
  configGet: 'config:get',
  configSet: 'config:set',
  chooseFolder: 'dialog:chooseFolder',
  pipelineRun: 'pipeline:run',
  pipelineProgress: 'pipeline:progress',
  romList: 'rom:list',
  romSetStatus: 'rom:setStatus',
  exportRun: 'export:run',
  exportProgress: 'export:progress',
  openExportFolder: 'export:openFolder',
  checkDatFiles: 'dat:check',
  resetData: 'data:reset',
  getAppVersion: 'app:version',
} as const;

export interface RomCuratorApi {
  getAppVersion(): Promise<string>;
  getConfig(): Promise<AppConfig>;
  setConfig(config: AppConfig): Promise<void>;
  chooseFolder(): Promise<string | null>;
  runPipeline(): Promise<CuratedRom[]>;
  onPipelineProgress(cb: (progress: ScanProgress) => void): () => void;
  listRoms(): Promise<CuratedRom[]>;
  setRomStatus(romId: number, status: CurationStatus): Promise<void>;
  exportKept(): Promise<{ exportedCount: number; copiedCount: number }>;
  onExportProgress(cb: (progress: ExportProgress) => void): () => void;
  openExportFolder(): Promise<void>;
  checkDatFiles(datFolder: string): Promise<Record<ConsoleId, boolean>>;
  /** Shows a native confirmation dialog; returns whether the user actually
   *  confirmed and the reset happened. Clears scanned roms + curation only —
   *  the IGDB ratings cache is kept so a rescan is still fast afterward. */
  resetData(): Promise<{ reset: boolean }>;
}

declare global {
  interface Window {
    romCurator: RomCuratorApi;
  }
}
