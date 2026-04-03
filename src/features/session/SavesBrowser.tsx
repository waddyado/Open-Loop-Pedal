import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteSavedSession,
  listSavedSessions,
  loadSavedSession,
  saveCurrentSession,
  type SaveListItem,
} from '@/features/session/sessionApi'
import { useAppStore } from '@/store/useAppStore'

type Props = {
  canFileIO: boolean
  onAfterLoad?: () => void
}

function formatSaveDate(ms: number): string {
  if (!ms) return '—'
  try {
    return new Date(ms).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}

export function SavesBrowser({ canFileIO, onAfterLoad }: Props) {
  const sessionName = useAppStore((s) => s.sessionName)
  const setSessionName = useAppStore((s) => s.setSessionName)
  const activeSaveFolderKey = useAppStore((s) => s.activeSaveFolderKey)

  const [items, setItems] = useState<SaveListItem[]>([])
  const [savesPath, setSavesPath] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [loadingFolder, setLoadingFolder] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const refresh = useCallback(async () => {
    if (!canFileIO) return
    setLoadingList(true)
    setLoadError(null)
    try {
      const list = await listSavedSessions()
      setItems(list)
      const root = await window.openLoopPedal!.savesRootPath()
      setSavesPath(root)
    } catch (e) {
      setItems([])
      setLoadError(e instanceof Error ? e.message : 'Could not read saves folder')
    } finally {
      setLoadingList(false)
    }
  }, [canFileIO])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) =>
        it.folderName.toLowerCase().includes(q) ||
        it.sessionName.toLowerCase().includes(q)
    )
  }, [items, query])

  const handleSave = async () => {
    setStatusMsg(null)
    setLoadError(null)
    try {
      await saveCurrentSession(sessionName)
      setStatusMsg('Session saved.')
      await refresh()
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const handleLoad = async (folderName: string) => {
    setStatusMsg(null)
    setLoadError(null)
    setLoadingFolder(folderName)
    try {
      await loadSavedSession(folderName)
      setStatusMsg(`Loaded “${folderName}”.`)
      onAfterLoad?.()
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoadingFolder(null)
    }
  }

  const handleDelete = async (it: SaveListItem) => {
    if (!window.confirm(`Delete save “${it.sessionName}”?\nFolder: ${it.folderName}`)) return
    setStatusMsg(null)
    setLoadError(null)
    try {
      await deleteSavedSession(it.folderName)
      setStatusMsg(`Deleted “${it.folderName}”.`)
      if (activeSaveFolderKey === it.folderName) {
        useAppStore.getState().setActiveSaveFolderKey(null)
      }
      await refresh()
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="saves-browser">
      <div className="saves-browser__header">
        <h3 className="saves-browser__title">Saves</h3>
        <p className="saves-browser__subtitle">Sessions in your app data folder</p>
      </div>

      <label className="sidebar__field">
        Session name
        <input
          className="sidebar__input"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="Name this session"
        />
      </label>
      <div className="saves-browser__save-row">
        <button type="button" className="btn btn--small btn--primary" onClick={() => void handleSave()} disabled={!canFileIO}>
          Save
        </button>
        <button
          type="button"
          className="btn btn--small btn--ghost saves-browser__refresh"
          onClick={() => void refresh()}
          disabled={!canFileIO || loadingList}
          title="Reload list from disk"
        >
          {loadingList ? '…' : 'Refresh'}
        </button>
      </div>

      {savesPath ? (
        <p className="saves-browser__path" title={savesPath}>
          {savesPath}
        </p>
      ) : null}

      {canFileIO ? (
        <>
          <div className="saves-browser__search">
            <input
              className="sidebar__input saves-browser__search-input"
              type="search"
              placeholder="Search saves…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter saves"
            />
          </div>

          <div className="saves-browser__list-wrap">
            {loadingList && items.length === 0 ? (
              <div className="saves-browser__empty">Loading saves…</div>
            ) : filtered.length === 0 ? (
              <div className="saves-browser__empty">
                {items.length === 0
                  ? 'No saved sessions yet. Name your session above and click Save.'
                  : 'No saves match your search.'}
              </div>
            ) : (
              <ul className="saves-browser__list" role="list">
                {filtered.map((it) => {
                  const active = activeSaveFolderKey === it.folderName
                  const busy = loadingFolder === it.folderName
                  const sig =
                    it.timeSigNumerator != null && it.timeSigDenominator != null
                      ? `${it.timeSigNumerator}/${it.timeSigDenominator}`
                      : '—'
                  return (
                    <li key={it.folderName}>
                      <div
                        className={`saves-browser__card ${active ? 'saves-browser__card--active' : ''} ${it.broken ? 'saves-browser__card--broken' : ''} ${busy ? 'saves-browser__card--busy' : ''}`}
                      >
                        <button
                          type="button"
                          className="saves-browser__card-main"
                          onClick={() => void handleLoad(it.folderName)}
                          disabled={!!loadingFolder || it.broken}
                          title={it.broken ? 'session.json missing or invalid' : 'Load this session'}
                        >
                          <span className="saves-browser__card-name">{it.sessionName}</span>
                          {it.folderName !== it.sessionName ? (
                            <span className="saves-browser__card-folder">{it.folderName}</span>
                          ) : null}
                          <span className="saves-browser__card-meta">
                            {it.bpm != null ? `${it.bpm} BPM` : '—'} · {sig} · {it.trackCount} track{it.trackCount === 1 ? '' : 's'}
                          </span>
                          <span className="saves-browser__card-date">{formatSaveDate(it.mtimeMs)}</span>
                        </button>
                        <button
                          type="button"
                          className="saves-browser__card-delete btn btn--tiny btn--danger"
                          onClick={() => void handleDelete(it)}
                          disabled={!!loadingFolder}
                          title="Delete this save"
                          aria-label={`Delete ${it.folderName}`}
                        >
                          ×
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <p className="sidebar__warn">Run the Electron app for save/load.</p>
      )}

      {loadError ? <p className="saves-browser__error">{loadError}</p> : null}
      {statusMsg && !loadError ? <p className="saves-browser__ok">{statusMsg}</p> : null}
    </div>
  )
}
