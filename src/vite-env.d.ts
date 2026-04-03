/// <reference types="vite/client" />

type OlpSaveAudioFile = { name: string; data: ArrayBuffer }

type OlpSaveListItem = {
  folderName: string
  sessionName: string
  mtimeMs: number
  trackCount: number
  bpm: number | null
  timeSigNumerator: number | null
  timeSigDenominator: number | null
  broken?: boolean
}

declare global {
  interface Window {
    openLoopPedal?: {
      listSaves: () => Promise<OlpSaveListItem[]>
      saveSessionInternal: (
        saveName: string,
        sessionJson: string,
        audioFiles: OlpSaveAudioFile[]
      ) => Promise<{ ok: true; folderName: string }>
      loadSessionInternal: (folderName: string) => Promise<{
        sessionJson: string
        audioBuffers: { id: string; data: ArrayBuffer }[]
      }>
      deleteSessionInternal: (folderName: string) => Promise<boolean>
      savesRootPath: () => Promise<string>
    }
  }
}

export {}
