# 2. First connection

SharpCNC talks to GRBL over **USB serial only** (Demon Shield on Arduino). Default baud is **115200**.

![USB connection path](assets/diagram-connect.svg)

## First-run setup

On a fresh install, SharpCNC opens a **First-run setup** wizard: Connect → Home → Calibrate → Soft travel → Stock. Finish or **Skip for now**; reopen anytime from **Menu → First-run setup…**.

## Steps

1. Open SharpCNC (desktop).
2. In the essentials strip, open the **Port** list.
3. Click **Refresh** if the list is empty or stale.
4. Select the COM port for the Demon Shield / Arduino (Windows Device Manager can confirm which COM appears when you plug the cable).
5. Click **Connect**.
6. Wait until status shows **Linked** (not Standing by / Connecting / Fault).

On connect, SharpCNC sends a soft reset (`Ctrl-X` / `0x18`) so GRBL starts clean.

![Connected essentials strip](assets/usb-connected.png)

## What “good” looks like

| UI | Meaning |
|----|---------|
| Status **Linked** | Serial session is up |
| Port label shows your COM | Correct device selected |
| Meta `115,200 baud · USB serial` | Baud matches GRBL |
| **Position** Work / Machine updating | Status reports streaming |
| Visualizer toolhead near a sensible place | Live WPos / MPos |

## Buttons while linked

- **Reset** — soft reset GRBL (same as Ctrl-X). Stops motion / clears planner; may leave Alarm depending on state.
- **Disconnect** — close the serial session.

## Common problems

| Symptom | Try |
|---------|-----|
| **No ports found** | Unplug/replug USB, **Refresh**, check cable / drivers |
| Wrong COM | Unplug, watch which COM disappears in Device Manager, plug again |
| **Fault** / connect error | Close other serial apps (Arduino IDE Serial Monitor, UGS, etc.), then reconnect |
| Linked but no position | Soft **Reset**, check GRBL is awake; look at the **Log** tab for TX/RX |
| Mock label in UI | You started `npm run dev` instead of `npm run tauri dev` |

> **Safety:** Connecting does not home the machine by itself. Do not assume the tool is clear of clamps until you look and jog carefully.

Next: [Understanding the UI](03-understanding-the-ui.md).
