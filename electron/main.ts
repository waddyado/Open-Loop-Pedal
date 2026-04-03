import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'

const isDev = !!process.env.VITE_DEV_SERVER_URL

/** Repo / app bundle root (parent of `dist-electron`). */
function projectRoot(): string {
  return path.resolve(path.join(__dirname, '..'))
}

function savesRoot(): string {
  return path.join(projectRoot(), 'saves')
}

function legacyUserDataSavesRoot(): string {
  return path.join(app.getPath('userData'), 'saves')
}

/**
 * One-time style migration: move session folders from appData/saves into project/saves.
 * Skips a folder if the same name already exists under project/saves (keeps project copy).
 */
async function migrateUserDataSavesToProjectSaves(): Promise<void> {
  const legacy = legacyUserDataSavesRoot()
  const destRoot = savesRoot()

  let legacyStat: Awaited<ReturnType<typeof fs.stat>>
  try {
    legacyStat = await fs.stat(legacy)
  } catch {
    return
  }
  if (!legacyStat.isDirectory()) return

  await fs.mkdir(destRoot, { recursive: true })

  const entries = await fs.readdir(legacy, { withFileTypes: true })
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const name = e.name
    const src = path.join(legacy, name)
    const dst = path.join(destRoot, name)
    try {
      await fs.access(dst)
      continue
    } catch {
      /* destination free */
    }
    try {
      await fs.cp(src, dst, { recursive: true })
      await fs.rm(src, { recursive: true, force: true })
    } catch (err) {
      console.error('[open-loop-pedal] Could not migrate save folder:', name, err)
    }
  }

  try {
    const rest = await fs.readdir(legacy)
    if (rest.length === 0) await fs.rmdir(legacy)
  } catch {
    /* ignore */
  }
}

function sanitizeName(name: string): string {
  const s = name.trim().replace(/[/\\?%*:|"<>]/g, '_').slice(0, 120)
  return s.length > 0 ? s : 'untitled'
}

function sessionDir(folderOrSaveName: string): string {
  return path.join(savesRoot(), sanitizeName(folderOrSaveName))
}

type SaveListItem = {
  folderName: string
  sessionName: string
  mtimeMs: number
  trackCount: number
  bpm: number | null
  timeSigNumerator: number | null
  timeSigDenominator: number | null
  broken?: boolean
}

function copyToArrayBuffer(buf: Buffer): ArrayBuffer {
  const u8 = new Uint8Array(buf.length)
  u8.set(buf)
  return u8.buffer
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#121218',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL!)
  } else {
    void win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  await migrateUserDataSavesToProjectSaves()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('saves-list', async (): Promise<SaveListItem[]> => {
  const root = savesRoot()
  await fs.mkdir(root, { recursive: true })
  const entries = await fs.readdir(root, { withFileTypes: true })
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  const out: SaveListItem[] = []

  for (const folderName of dirs) {
    const jsonPath = path.join(root, folderName, 'session.json')
    try {
      const stat = await fs.stat(jsonPath)
      const raw = await fs.readFile(jsonPath, 'utf-8')
      const meta = JSON.parse(raw) as {
        sessionName?: string
        bpm?: number
        timeSigNumerator?: number
        timeSigDenominator?: number
        tracks?: unknown[]
      }
      out.push({
        folderName,
        sessionName: typeof meta.sessionName === 'string' ? meta.sessionName : folderName,
        mtimeMs: stat.mtimeMs,
        trackCount: Array.isArray(meta.tracks) ? meta.tracks.length : 0,
        bpm: typeof meta.bpm === 'number' ? meta.bpm : null,
        timeSigNumerator: typeof meta.timeSigNumerator === 'number' ? meta.timeSigNumerator : null,
        timeSigDenominator: typeof meta.timeSigDenominator === 'number' ? meta.timeSigDenominator : null,
      })
    } catch {
      out.push({
        folderName,
        sessionName: folderName,
        mtimeMs: 0,
        trackCount: 0,
        bpm: null,
        timeSigNumerator: null,
        timeSigDenominator: null,
        broken: true,
      })
    }
  }

  out.sort((a, b) => b.mtimeMs - a.mtimeMs)
  return out
})

ipcMain.handle(
  'save-session-internal',
  async (_e, saveName: string, sessionJson: string, audioFiles: { name: string; data: ArrayBuffer }[]) => {
    const dir = sessionDir(saveName)
    await fs.mkdir(dir, { recursive: true })
    const audioDir = path.join(dir, 'audio')
    await fs.mkdir(audioDir, { recursive: true })
    await fs.writeFile(path.join(dir, 'session.json'), sessionJson, 'utf-8')
    for (const f of audioFiles) {
      await fs.writeFile(path.join(audioDir, f.name), Buffer.from(f.data))
    }
    const folderName = path.basename(dir)
    return { ok: true as const, folderName }
  }
)

ipcMain.handle('load-session-internal', async (_e, folderName: string) => {
  const dir = sessionDir(folderName)
  const jsonPath = path.join(dir, 'session.json')
  let raw: string
  try {
    raw = await fs.readFile(jsonPath, 'utf-8')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Could not read session: ${msg}`)
  }

  let meta: { tracks?: Array<{ id: string; audioFile?: string; hasAudio?: boolean }> }
  try {
    meta = JSON.parse(raw) as typeof meta
  } catch {
    throw new Error('session.json is not valid JSON')
  }

  const audioDir = path.join(dir, 'audio')
  const buffers: { id: string; data: ArrayBuffer }[] = []

  for (const t of meta.tracks ?? []) {
    if (!t?.id) continue
    const fileName = t.audioFile ?? (t.hasAudio ? `${t.id}.wav` : undefined)
    if (!fileName) continue
    try {
      const filePath = path.join(audioDir, fileName)
      const buf = await fs.readFile(filePath)
      buffers.push({ id: t.id, data: copyToArrayBuffer(buf) })
    } catch {
      /* missing file — still return JSON; renderer may show track without audio */
    }
  }

  return { sessionJson: raw, audioBuffers: buffers }
})

ipcMain.handle('delete-session-internal', async (_e, saveName: string) => {
  const dir = sessionDir(saveName)
  await fs.rm(dir, { recursive: true, force: true })
  return true
})

ipcMain.handle('saves-root-path', async () => savesRoot())
