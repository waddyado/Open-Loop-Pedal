# Open Loop Pedal

Desktop looping and pedalboard app: microphone in, synced loop tracks, per-track and global effects, and **automatic session save/load** under the app data folder (Electron + React + TypeScript + Web Audio API).

## Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- Windows, macOS, or Linux

## Install

```bash
cd "Open Loop Pedal"
npm install
```

## Run (development)

Builds the Electron main/preload bundle, starts the Vite dev server, then opens the Electron window:

```bash
npm run dev
```

On first run, allow microphone access when prompted. Use **Refresh mic / permissions** in the sidebar if device labels are blank until permission is granted.

## Build (static + Electron bundle)

```bash
npm run build
npm run start
```

`npm run build` runs `build:electron` (writes `dist-electron/main.cjs` and `preload.cjs` — CommonJS so Electron works alongside `"type": "module"` in `package.json`) and `vite build` (renderer to `dist/`). `npm run start` launches Electron loading `dist/index.html` (with `VITE_DEV_SERVER_URL` unset).

## Usage (quick)

1. Set **BPM** and **time signature** in the sidebar. **Default loop length (bars)** seeds new tracks and defines the master loop when you have **no** tracks.
2. **Add track**, set each row’s **Bars** (that clip’s loop length). The **master** loop length is the **largest** bar count among all tracks; shorter clips repeat inside it.
3. **Select** a track (click the waveform area), optional **Record countdown** (beats): count-in clicks are scheduled on the **audio clock**; recording starts exactly on the next beat after the last click.
4. **Record** captures one loop of the **selected track’s** bar length; **Start** / **Stop** control playback.
5. **Saves** (sidebar): sessions are stored in the project’s **`saves/`** folder at the repo root (`session.json` + `audio/` WAVs per session). On first launch after this change, any sessions that were still under Electron **userData/saves** are **moved** into `saves/` (same folder name skipped if it already exists in the project). Use the **Saves browser** to **Save**, **load** a session (click a card), **search**, **refresh**, or **delete**. The active session is highlighted after load or save.

Effects in the center target **global** or **selected track** FX depending on selection.

## Count-in behavior

- For **N** count-in beats, the engine schedules **N** click sounds at `t0, t0+spb, …` using `AudioContext` time, then starts recording at `t0 + N*spb`.
- UI beat remaining is driven by one `requestAnimationFrame` loop reading `currentTime`, not by chained `setTimeout`s, so it stays aligned with the same schedule.
- **Stop** or a new **Record** cancels the current count-in so sessions cannot overlap.

## Per-track loop lengths

- Each track has **loopMeasures** (bars). Playback uses `AudioBufferSourceNode` with `loop=true`; a 2-bar buffer naturally repeats four times inside an 8-bar master cycle when both share BPM and time signature.
- The timeline ruler reflects the **master** length; each lane’s beat grid matches that track’s own length.

## MVP limitations

- Loop sync is good enough for practice, not sample-perfect DAW timing.
- Time signature denominator is mostly cosmetic; the grid uses the numerator as beats per bar at the given BPM.
- Output device selection uses `AudioContext.setSinkId` when the runtime supports it; otherwise output follows the system default.
- Changing a track’s bar count during playback does not automatically re-seek sources; press **Stop** then **Start** to pick up new lengths.
- Overdub on the same track, MIDI, and export are not implemented yet.
