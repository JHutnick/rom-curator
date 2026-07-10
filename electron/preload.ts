import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../src/shared/ipc';
import type { RomCuratorApi } from '../src/shared/ipc';
import type { AppConfig, CurationStatus } from '../src/shared/types';

const api: RomCuratorApi = {
  getConfig: () => ipcRenderer.invoke(IPC.configGet),
  setConfig: (config: AppConfig) => ipcRenderer.invoke(IPC.configSet, config),
  chooseFolder: () => ipcRenderer.invoke(IPC.chooseFolder),
  runPipeline: () => ipcRenderer.invoke(IPC.pipelineRun),
  onPipelineProgress: (cb) => {
    const listener = (_event: unknown, progress: Parameters<typeof cb>[0]) => cb(progress);
    ipcRenderer.on(IPC.pipelineProgress, listener);
    return () => ipcRenderer.removeListener(IPC.pipelineProgress, listener);
  },
  listRoms: () => ipcRenderer.invoke(IPC.romList),
  setRomStatus: (romId: number, status: CurationStatus) =>
    ipcRenderer.invoke(IPC.romSetStatus, romId, status),
  exportKept: () => ipcRenderer.invoke(IPC.exportRun),
  openExportFolder: () => ipcRenderer.invoke(IPC.openExportFolder),
  checkDatFiles: (datFolder: string) => ipcRenderer.invoke(IPC.checkDatFiles, datFolder),
};

contextBridge.exposeInMainWorld('romCurator', api);
