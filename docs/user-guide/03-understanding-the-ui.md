# 3. Understanding the UI

The window always shows **connection**, **Material / Machine position**, and **safety**. The big stage is the machine view. The right rail is a **phase body** — only the controls for the current task.

![UI map](assets/diagram-ui-map.svg)

![Connected app shell](assets/ui-connected.png)

## Header

- Brand: **SharpCNC**
- Tagline: one machine, clear position, run the job
- **Connection chip** — compact Linked / Offline / Virtual status, port, Connect / Disconnect. After you link, this is the only Connect/Disconnect control (the Connect rail and First-run hide their duplicates). **Reset** lives on the Safety strip only.
- **Version chip** — opens **About & updates**; Update badge when a newer GitHub Release exists
- **Menu** — Material & tool, External jobs, Calibrate, Bed travel test, Trace stock perimeter, Prepare, **Advanced…**, **Appearance**, **Debug mode**, **About & updates…**

![Menu open](assets/menu-open.webp)

## Always-on safety strip

Above the visualizer (every phase, including before connect):

| Strip item | Role |
|------------|------|
| **Connect** | Port / Virtual CNC, Connect / Disconnect — Phase 0 lives here until linked |
| **Machine XYZ** | MPos — bed / soft-travel frame |
| **Material XYZ** | Job origin on the blank (WPos under the hood). Label **Material**, never “Work” |
| **State** | Idle / Jog / Run / Hold / Alarm |
| **Stop / Hold / Resume / Reset / Unlock** | E-Stop primary; Hold also via **Space**; Reset only here; Unlock after alarm |
| **Live overrides** | Feed % / spindle % — emphasized in Run / Hold |

**Machine XYZ** = where the machine thinks the tool is on the bed.  
**Material XYZ** = where the tool is relative to the origin you set on the blank.

## Visualizer (main stage)

Shows:

- Bed size from soft travel (default **1000 × 1000 mm** until you calibrate)
- Stock rectangle (from Prepare / Material & tool — set corner from toolhead, then W/L/T)
- Loaded toolpath (job or SVG preview)
- Toolhead (bit Ø sized) with a short motion trail while jogging / running
- **Dual origin** markers — **Material 0** at the job origin and **Machine 0** from WCO
- Optional **Simulate** overlay when a path is loaded — preview only, not serial motion
- **Z gauge** (top-right, while connected) — a side view of Z: home at the top (0), the bottom of travel (−`$132`), material Z0 (brass line), the stock below it, the loaded job's Z range (red if it leaves travel), and the tool tip. The number underneath is Z from material zero, or machine Z if no zero is set

Axis convention (matches the guides): **+X** right, **+Y** back = up on screen, **+Z** up. Bed corners use map layout: **NW NE** on the top row, **SW SE** on the bottom.

## Phase switcher (right rail)

A persistent stepper: **Connect · Calibrate · Prepare · Verify · Run**. Incomplete phases ahead stay disabled with a one-line reason (“Mark material ready first”). Completed **Calibrate** stays unlocked for re-entry. Drag the thin handle between the visualizer and the rail to widen or narrow the panel (saved for next time). On narrow windows the layout stacks and the handle hides.

| Phase | What the pane shows |
|-------|---------------------|
| **Connect** | Ports, baud note, Connect, Virtual CNC |
| **Calibrate** | Five guided steps: Start (home) · Direction · Steps/mm · Speed & accel · Soft travel (with a jog pad) |
| **Prepare** | Stepped wizard: stock+tool → Material XY → Z → load → Mark ready |
| **Verify** | Soft-limit summary, Simulate, checklist, **Start** |
| **Run** | Progress + overrides + Pause / Resume / Stop |

**Back / Next stay on screen.** Each wizard's footer is pinned to the bottom of the rail; on smaller screens (e.g. 1366×768) the step body scrolls underneath it. The visualizer and safety strip stay fixed; only the phase body swaps.

**Not phases:** Log / Debug (Menu · Debug) and **Advanced…** (Menu). Those are intentional hides and may scroll.

## Menu

Use **Menu** for occasional setup and power tools:

- Material & tool… / External jobs… / Trace stock perimeter… / Bed travel test…  
- Calibrate… / Prepare phase… / First-run setup…  
- **Advanced…** — console, macros, G54–G59, raw `$$` (closed by default; not part of normal cutting)  
- **Appearance** — Dark or Light (persisted)  
- **Debug mode** — Export / Serial / Copy / Debug bridge under Menu · Debug (TX/RX timestamps always logged)  
- **About & updates…** — version, GitHub Releases, in-app install

Next: [Jogging & zeros](04-jogging-and-zeros.md).
