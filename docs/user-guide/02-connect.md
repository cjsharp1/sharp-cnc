# 2. First connection

**Order reminder:** connect/home for the session, then [calibrate once](05-calibration.md) if the machine is new or changed; [prepare every job](07-prepare-and-z-probe.md) before Start. Pictures: [first-run bootstrap](../setup-visual/first-run.html) · [calibration](../setup-visual/calibration.html) · [prepare](../setup-visual/prepare.html).

SharpCNC ↔ GRBL over **USB serial** (Demon Shield). Baud **115200**.

![USB connection path](assets/diagram-connect.svg)

## First-run wizard

Fresh install opens **First-run setup** — a bootstrap that gets you **Linked**, home, and into **calibration** (machine, once). The optional stock step only seeds the first job; later cuts use **Prepare**. Finish or **Skip for now**. Reopen: **Menu → First-run setup…**.

## Connect (checklist)

1. Open SharpCNC (desktop).
2. In the **header connection chip**, **Refresh** ports → pick COM → **Connect**.
3. Wait for **Linked** + live Work / Machine in the Position box.

On connect: soft reset (`Ctrl-X`).

![Connected header chip](assets/usb-connected.png)

## If it fails

| Symptom | Try |
|---------|-----|
| No ports | Unplug/replug, Refresh, cable / drivers |
| Wrong COM | Watch Device Manager while unplugging |
| Fault | Close other serial apps → reconnect |
| Mock label | Use `tauri dev` / installer, not `npm run dev` |

> **Safety:** Connect does not home. Look before you jog.

Next: [Calibration](05-calibration.md) (once) · [UI](03-understanding-the-ui.md)
