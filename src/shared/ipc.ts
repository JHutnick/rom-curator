import type { AppConfig, CuratedRom, CurationStatus, ScanProgress } from './types';

export const IPC = {
  configGet: 'config:get',
  configSet: 'config:set',
  chooseFolder: 'dialog:chooseFolder',
  pipelineRun: 'pipeline:run',
  pipelineProgress: 'pipeline:progress',
  romList: 'rom:list',
  romSetStatus: 'rom:setStatus',
  exportRun: 'export:run',
  openExportFolder: 'export:openFolder',
} as const;

export interface RomCuratorApi {
  getConfig(): Promise<AppConfig>;
  setConfig(config: AppConfig): Promise<void>;
  chooseFolder(): Promise<string | null>;
  runPipeline(): Promise<CuratedRom[]>;
  onPipelineProgress(cb: (progress: ScanProgress) => void): () => void;
  listRoms(): Promise<CuratedRom[]>;
  setRomStatus(romId: number, status: CurationStatus): Promise<void>;
  exportKept(): Promise<{ exportedCount: number; copiedCount: number }>;
  openExportFolder(): Promise<void>;
}

declare global {
  interface Window {
    romCurator: RomCuratorApi;
  }
}
