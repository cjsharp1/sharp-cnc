# 2. First connection

**Order reminder:** connect/home for the session, then [calibrate once](05-calibration.md) if the machine is new or changed; [prepare every job](07-prepare-and-z-probe.md) before Start. Pictures: [first-run bootstrap](../setup-visual/first-run.html) · [calibration](../setup-visual/calibration.html) · [prepare](../setup-visual/prepare.html).

SharpCNC ↔ GRBL over **USB serial** (Demon Shield). Baud **115200**.

![USB connection path](assets/diagram-connect.svg)

## First-run wizard

Fresh install opens **First-run setup** — a bootstrap that gets you **Linked**, home, and into **calibration** (machine, once). The optional stock step only seeds the first job; later cuts use **Prepare**. Finish or **Skip for now**. Reopen: **Menu → First-run setup…**.

## Connect (checklist)

1. Open SharpCNC (desktop).
2. In the **header connection chip**, **Refresh** ports → pick your COM port **or** **Virtual CNC** → **Connect**.
3. Wait for **Linked** (USB) or **Virtual** (simulator) + live Work / Machine in the Position box and visualizer.

On connect: soft reset (`Ctrl-X`).

### Virtual CNC (no USB)

**Virtual CNC** is listed in the same port dropdown as real COM ports — pick it instead of a serial device when you want to practice jog, G-code, and the visualizer without the Demon Shield. Disconnect returns you to Offline; pick a COM port later when the machine is ready. Xbox / gamepad jog works against Virtual CNC the same as a linked USB session.

![Connected header chip](assets/usb-connected.png)

## If it fails

| Symptom | Try |
|---------|-----|
| No ports | Unplug/replug, Refresh, cable / drivers — or choose **Virtual CNC** |
| Wrong COM | Watch Device Manager while unplugging |
| Fault | Close other serial apps → reconnect |
| Browser-only | `npm run dev` offers Virtual CNC only (no USB); use the desktop app for a real COM port |

> **Safety:** Connect does not home. Look before you jog.

Next: [Calibration](05-calibration.md) (once) · [UI](03-understanding-the-ui.md)
