import { useCallback, useEffect, useState } from 'react'
import { audioEngine } from '@/audio/AudioEngine'
import { NewLoopControl } from '@/features/session/NewLoopControl'
import { SavesBrowser } from '@/features/session/SavesBrowser'
import { TransportSection } from '@/features/transport/TransportSection'
import { useAppStore } from '@/store/useAppStore'

export function Sidebar() {
  const bpm = useAppStore((s) => s.bpm)
  const setBpm = useAppStore((s) => s.setBpm)
  const timeSigNumerator = useAppStore((s) => s.timeSigNumerator)
  const timeSigDenominator = useAppStore((s) => s.timeSigDenominator)
  const setTimeSig = useAppStore((s) => s.setTimeSig)
  const measures = useAppStore((s) => s.measures)
  const setMeasures = useAppStore((s) => s.setMeasures)
  const metronomeEnabled = useAppStore((s) => s.metronomeEnabled)
  const setMetronome = useAppStore((s) => s.setMetronome)
  const masterVolume = useAppStore((s) => s.masterVolume)
  const setMasterVolume = useAppStore((s) => s.setMasterVolume)
  const monitoringEnabled = useAppStore((s) => s.monitoringEnabled)
  const setMonitoring = useAppStore((s) => s.setMonitoring)
  const playTracksWhileRecording = useAppStore((s) => s.playTracksWhileRecording)
  const setPlayTracksWhileRecording = useAppStore((s) => s.setPlayTracksWhileRecording)
  const recordPlaybackIncludeMode = useAppStore((s) => s.recordPlaybackIncludeMode)
  const setRecordPlaybackIncludeMode = useAppStore((s) => s.setRecordPlaybackIncludeMode)
  const inputDeviceId = useAppStore((s) => s.inputDeviceId)
  const setInputDeviceId = useAppStore((s) => s.setInputDeviceId)
  const outputDeviceId = useAppStore((s) => s.outputDeviceId)
  const setOutputDeviceId = useAppStore((s) => s.setOutputDeviceId)
  const recordCountdownBeats = useAppStore((s) => s.recordCountdownBeats)
  const setRecordCountdownBeats = useAppStore((s) => s.setRecordCountdownBeats)
  const inputError = useAppStore((s) => s.inputError)
  const inputAvailable = useAppStore((s) => s.inputAvailable)
  const setInputError = useAppStore((s) => s.setInputError)
  const setInputAvailable = useAppStore((s) => s.setInputAvailable)
  const transport = useAppStore((s) => s.transport)
  const displayBar = useAppStore((s) => s.displayBar)
  const displayBeat = useAppStore((s) => s.displayBeat)
  const countdownBeatsLeft = useAppStore((s) => s.countdownBeatsLeft)

  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const canFileIO = typeof window.openLoopPedal !== 'undefined'

  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices()
      setInputs(list.filter((d) => d.kind === 'audioinput'))
      setOutputs(list.filter((d) => d.kind === 'audiooutput'))
    } catch {
      setInputs([])
      setOutputs([])
    }
  }, [])

  useEffect(() => {
    void refreshDevices()
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
  }, [refreshDevices])

  const connectMic = useCallback(
    async (deviceId: string) => {
      setInputError(null)
      try {
        await audioEngine.openMicrophone(deviceId)
        setInputAvailable(true)
        await refreshDevices()
      } catch (e) {
        setInputAvailable(false)
        setInputError(e instanceof Error ? e.message : 'Could not open microphone')
      }
    },
    [refreshDevices, setInputAvailable, setInputError]
  )

  useEffect(() => {
    if (inputDeviceId) void connectMic(inputDeviceId)
  }, [inputDeviceId, connectMic])

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__app-name">Open Loop Pedal</span>
      </div>

      <SavesBrowser
        canFileIO={canFileIO}
        onAfterLoad={() => {
          if (inputDeviceId) void connectMic(inputDeviceId)
        }}
      />

      <NewLoopControl />

      <hr className="sidebar__rule" />

      <label className="sidebar__field">
        Audio input
        <select
          className="sidebar__select"
          value={inputDeviceId}
          onChange={(e) => {
            setInputDeviceId(e.target.value)
            void connectMic(e.target.value)
          }}
        >
          <option value="">Default microphone</option>
          {inputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Input ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </label>

      <label className="sidebar__field">
        Audio output
        <select
          className="sidebar__select"
          value={outputDeviceId}
          onChange={(e) => {
            setOutputDeviceId(e.target.value)
            void audioEngine.resume().then(() => audioEngine.setOutputDevice(e.target.value))
          }}
        >
          <option value="">System default</option>
          {outputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Output ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </label>
      <p className="sidebar__hint">Output routing uses setSinkId when the browser supports it.</p>

      <button type="button" className="btn btn--small" onClick={() => void connectMic(inputDeviceId)}>
        Refresh mic / permissions
      </button>

      <hr className="sidebar__rule" />

      <TransportSection />

      <hr className="sidebar__rule" />

      <h3 className="sidebar__section-title">Recording &amp; monitoring</h3>
      <p className="sidebar__hint sidebar__hint--block">
        Three separate paths: (1) <strong>Live monitoring</strong> — hear your input; (2) <strong>Backing while record</strong> — hear other loops; (3){' '}
        <strong>Play</strong> — normal transport. Use <strong>headphones</strong> when monitoring live input to avoid feedback.
      </p>

      <label className="sidebar__toggle">
        <input type="checkbox" checked={playTracksWhileRecording} onChange={(e) => setPlayTracksWhileRecording(e.target.checked)} />
        Play other tracks while recording
      </label>
      <label className="sidebar__field">
        Which tracks during record
        <select
          className="sidebar__select"
          value={recordPlaybackIncludeMode}
          onChange={(e) => setRecordPlaybackIncludeMode(e.target.value as 'all' | 'custom')}
          disabled={!playTracksWhileRecording}
        >
          <option value="all">All eligible (except the track being recorded)</option>
          <option value="custom">Custom — use per-track “Rec play” checkboxes</option>
        </select>
      </label>

      <label className="sidebar__toggle">
        <input type="checkbox" checked={monitoringEnabled} onChange={(e) => setMonitoring(e.target.checked)} />
        Live input monitoring (mic → selected track FX → output)
      </label>
      <p className="sidebar__warn sidebar__warn--compact">Feedback risk: keep monitoring off with speakers, or use headphones.</p>

      <hr className="sidebar__rule" />

      <h3 className="sidebar__section-title">Loop settings</h3>
      <label className="sidebar__field">
        BPM
        <input
          className="sidebar__input"
          type="number"
          min={40}
          max={240}
          value={bpm}
          onChange={(e) => setBpm(Number(e.target.value) || 120)}
        />
      </label>
      <div className="sidebar__row">
        <label className="sidebar__field">
          Time sig
          <input
            className="sidebar__input sidebar__input--narrow"
            type="number"
            min={1}
            max={12}
            value={timeSigNumerator}
            onChange={(e) => setTimeSig(Number(e.target.value) || 4, timeSigDenominator)}
          />
        </label>
        <span className="sidebar__slash">/</span>
        <label className="sidebar__field">
          <span className="visually-hidden">Denominator</span>
          <select
            className="sidebar__select"
            value={timeSigDenominator}
            onChange={(e) => setTimeSig(timeSigNumerator, Number(e.target.value))}
          >
            {[4, 8, 16].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="sidebar__field">
        Default loop length (bars)
        <input
          className="sidebar__input"
          type="number"
          min={1}
          max={64}
          value={measures}
          onChange={(e) => setMeasures(Number(e.target.value) || 4)}
          title="Used for new tracks and for the master loop when no tracks exist. Each track can set its own bar count in the timeline."
        />
      </label>

      <label className="sidebar__field">
        Record countdown (beats)
        <select
          className="sidebar__select"
          value={recordCountdownBeats}
          onChange={(e) => setRecordCountdownBeats(Number(e.target.value) as 0 | 1 | 2 | 4)}
        >
          <option value={0}>Off</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={4}>4</option>
        </select>
      </label>

      <label className="sidebar__toggle">
        <input type="checkbox" checked={metronomeEnabled} onChange={(e) => setMetronome(e.target.checked)} />
        Metronome (during play / record)
      </label>

      <label className="sidebar__field">
        Master volume
        <input type="range" min={0} max={1} step={0.01} value={masterVolume} onChange={(e) => setMasterVolume(Number(e.target.value))} />
      </label>

      <hr className="sidebar__rule" />

      <div className="sidebar__status">
        <h3 className="sidebar__section-title">Status</h3>
        <ul className="sidebar__status-list">
          <li className={inputAvailable ? 'ok' : 'warn'}>Input: {inputAvailable ? 'available' : 'not ready'}</li>
          <li>Transport: {transport}</li>
          <li>
            Position: bar {displayBar} · beat {displayBeat}
          </li>
          {transport === 'countdown' ? <li>Countdown: {countdownBeatsLeft}</li> : null}
          {inputError ? <li className="err">{inputError}</li> : null}
        </ul>
      </div>
    </aside>
  )
}
