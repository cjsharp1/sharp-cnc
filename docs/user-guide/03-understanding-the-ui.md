# 3. Understanding the UI

The window is built so you always see **connection**, **position**, and **safety**, with a large machine view and a slim workspace for Move / Job / Log.

![UI map](assets/diagram-ui-map.svg)

![Connected app shell](assets/ui-connected.png)

## Header

- Brand: **SharpCNC**
- Tagline: one machine, clear position, run the job
- **Connection chip** — compact Linked / Offline status, port, Connect / Disconnect / Reset (sits with the brand and Menu)
- **Version chip** (e.g. `v0.1.0`) — opens **About & updates**; lights an Update badge when a newer GitHub Release exists
- **Menu** — Material & tool, External jobs, Calibration, Bed travel test, Trace stock perimeter, Prepare to run, **Appearance** (dark / light), **Debug mode**, and **About & updates…** (version footer in the menu)

![Menu open](assets/menu-open.webp)

## Left column (under the header)

Above the visualizer, two boxes side by side:

1. **Position** — Work and Machine X / Y / Z plus machine state (Idle, Jog, Run, Hold, Alarm, …)  
2. **Safety** — E-Stop, Hold, Resume, Reset, Unlock (+ guided alarm steps when locked)  

While Running / Held, a **live overrides** strip appears under those boxes (feed %, rapid % 100/50/25, spindle %).

Keep an eye on position and safety while jogging or running. If state flips to **Alarm** or **Hold**, stop and read the banner before continuing.

## Visualizer (main stage)

Shows:

- Bed size from soft travel (default **1000 × 1000 mm** until you calibrate)
- Stock rectangle (from Material & tool / Prepare — set corner from toolhead, then W/L/T; optional drag fine-tune)
- Loaded toolpath (job or SVG preview)
- Toolhead (bit Ø sized) with a short motion trail while jogging / running
- **Dual origin** markers — **Work 0** at the job origin and **Machine 0** from WCO
- Optional **Simulate** overlay when a job path is loaded — preview only, not serial motion (playback speed + Z/lift cues)

Labels on the view call out bed size, stock, path name, and whether you are in preview or live motion.

## Workspace tabs (right rail)

The tabbed panel stretches from just under the header to the bottom of the window so **Move → Jog** stays reachable without scrolling the panel first.

Four focused tabs (arrow keys move between them):

| Tab | Contents |
|-----|----------|
| **Move** | Jog, work zero, homing, G54–G59 offsets, console + macros, spindle / overrides |
| **Probe** | XY edge / corner probe and tool-length Z (clutter pulled out of Move) |
| **Job** | Material & tool, External jobs, SVG → G-code, Load / Prepare / scrubber / dry run / Start / Simulate |
| **Log** | Live activity (TX/RX/events); with **Debug mode** on — export, Copy, Debug bridge |

Each tab shows a one-line purpose under the tab list. Job can show a small badge (`Ready`, `Run`, `Held`, `SVG`, …).

## Menu vs tabs

Use **tabs** for day-to-day jog / run / logs. Use **Menu** for setup that you do occasionally:

- Material & tool…  
- External jobs…  
- Calibration… (full wizard modal)  
- Prepare to run… (pre-start / Z probe wizard)  
- **Appearance** — Dark or Light (persisted). Workshop steel & brass in both modes; visualizer grid and toolpath stay readable.  
- **Debug mode** — toggle (persisted; default off). When on, the Log tab shows Export / Copy / Debug bridge and the menu label reads **Menu · Debug**.  
- **About & updates…** — installed version, check GitHub Releases, What’s new, download NSIS (desktop) or open the release page. Upgrade in place: run the newer setup over the existing install; uninstall only if that fails.

Next: [Jogging & zeros](04-jogging-and-zeros.md).
