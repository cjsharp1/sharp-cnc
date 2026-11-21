# Demon Shield external start / pause / stop

SharpCNC mirrors the physical buttons on a **Demon Shield** (Arduino Uno + GRBL) so the UI job state stays in sync with the machine.

## Hardware (typical)

| Button | Shield label | Arduino pin | GRBL action | Status `Pn:` letter |
|--------|--------------|-------------|-------------|---------------------|
| Stop   | ABORT        | A0          | Soft reset (Ctrl-X) | `R` |
| Pause  | FEED HOLD    | A1          | Feed hold (`!`)     | `H` |
| Start  | RESUME       | A2          | Cycle start (`~`)   | `S` |

Buttons are normally-open to GND; GRBL enables internal pull-ups. There are **no custom serial messages** — the controller applies the same real-time commands a sender would send over USB.

## How SharpCNC detects presses

Module: `src/grbl/externalControls.ts` (`createDemonShieldExternalControlAdapter`).

1. **Machine state** from `?` polls — primary path (works even for short taps that miss `Pn:`):
   - `Run`/`Jog` → `Hold` while streaming → external **pause**
   - `Hold` → `Run` while streamer paused → external **resume**
   - Active stream + `Idle`/`Alarm` (or GRBL welcome banner) → external **stop**
2. **`Pn:` pin letters** when a button is still held across a status poll (rising edge).
3. **Soft-reset banner** (`Grbl …` / `[MSG:Reset to continue]`) while a job is active → **abort**.

Software Start / Pause / Resume / Stop / E-Stop call `noteSoftwareAction(…)` so the resulting machine transitions are **not** treated as external presses (no double feed-hold / double reset).

The G-code streamer exposes `syncFromExternalHold` / `Resume` / `Abort` that update UI phase **without** re-sending `!` / `~` / Ctrl-X.

## UI behaviour

| External event | Streamer / UI |
|----------------|---------------|
| Pause          | Job → paused; stop filling RX buffer |
| Resume         | Job → running; continue streaming |
| Stop / Abort   | Job → idle; clear pending lines (reset already done on controller) |
| Start while Idle | If a job is loaded and start is allowed, begin streaming |

## Mock serial (no hardware)

Send these lines on the mock port to simulate buttons:

- `$ExtHold` — pulse `Pn:H` + Hold
- `$ExtResume` — pulse `Pn:S` + resume from Hold
- `$ExtAbort` — pulse `Pn:R` + soft reset

## What to verify on real hardware

1. Abort is soft-reset (welcome banner), not a latching E-stop / kill switch.
2. Pause while a job runs → UI shows paused and stops sending lines; Resume continues the same job.
3. Abort mid-job → UI returns to idle; no second soft-reset from the app.
4. Resume while Idle with a loaded job — should it **start** that job? SharpCNC currently does; say if you want Idle Resume to be ignored.
5. Confirm `$10` / firmware still reports `Pn:` when pins are held (GRBL 1.1 normally does).
