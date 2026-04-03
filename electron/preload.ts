import { contextBridge, ipcRenderer } from 'electron'

export type SaveAudioFile = { name: string; data: ArrayBuffer }

export type SaveListItem = {
  folderName: string
  sessionName: string
  mtimeMs: number
  trackCount: number
  bpm: number | null
  timeSigNumerator: number | null
  timeSigDenominator: number | null
  broken?: boolean
}

contextBridge.exposeInMainWorld('openLoopPedal', {
  listSaves: () => ipcRenderer.invoke('saves-list') as Promise<SaveListItem[]>,
  saveSessionInternal: (saveName: string, sessionJson: string, audioFiles: SaveAudioFile[]) =>
    ipcRenderer.invoke('save-session-internal', saveName, sessionJson, audioFiles) as Promise<{ ok: true; folderName: string }>,
  loadSessionInternal: (folderName: string) =>
    ipcRenderer.invoke('load-session-internal', folderName) as Promise<{
      sessionJson: string
      audioBuffers: { id: string; data: ArrayBuffer }[]
    }>,
  deleteSessionInternal: (folderName: string) => ipcRenderer.invoke('delete-session-internal', folderName) as Promise<boolean>,
  savesRootPath: () => ipcRenderer.invoke('saves-root-path') as Promise<string>,
})
