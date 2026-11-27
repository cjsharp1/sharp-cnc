# 6. Material & tool (Prepare)

Tell SharpCNC what is on the bed and which bit is in the spindle. That drives the visualizer, SVG defaults, and clearance intuition.

This is the **Stock + tool** step of **Phase 2 · Prepare** (also **Menu → Material & tool…**).

![Stock on bed](assets/diagram-stock-bed.svg)

![Stock corner placement in app](assets/stock-corner.webp)

## Stock (workpiece)

### Primary: corner from toolhead

1. Clamp the blank on the bed.  
2. Jog the tip to a stock corner (usually **SW** / front-left).  
3. Pick that corner and press **Set XY zero + stock … at tip** (Prepare → Material XY).  
4. Enter **Width / Length / Thickness**. Size grows away from the anchored corner; the visualizer updates with the same numbers.

That one action sets material XY zero (`G10 L20`) and stock origin together so the corner under the tip is material (0,0).

Optional: **Trace stock perimeter…** jogs the toolhead around the blank (safe Z, XY only) so you can see SharpCNC knows the boundaries — same flow as in Prepare → Material XY. Confirm the path is clear before Start.

### Stock units (mm / in)

Use **Stock units** on the Prepare → Stock + tool step to type the blank in **mm** or **in**. SharpCNC stores and sends sizes in millimetres for GRBL and the visualizer; switching units only changes the entry fields. Soft limits, probe plate thickness, jog steps, and calibration stay in mm. The unit choice persists across launches.

### Fields

| Field | Meaning |
|-------|---------|
| **Width X** | Stock size along X (from the anchored corner), in the selected unit |
| **Length Y** | Stock size along Y |
| **Thickness** | Stock height (for awareness / future checks) |
| **Bed frame (optional)** | Map layout: **NW NE** top row, **SW SE** bottom — against soft-travel bed; does **not** set material zero |
| **Offset X / Y** | Manual fine placement in material coordinates (same unit as size) |

Defaults start around 300 × 200 × 18 mm (about 11.8 × 7.9 × 0.7 in). Values persist in the app.

### Optional fine-tune on the visualizer

Click the stock blank to select it, then drag to nudge or use side/corner handles to resize. Prefer the numeric fields for accuracy. Pan/zoom still work on empty bed (stock hit takes priority). Esc clears selection.

Place the physical sheet to match what you enter — the orange **Stock** rectangle on the visualizer should match reality.

## Bit (tool)

| Field | Meaning |
|-------|---------|
| **Type** | Endmill / Ballnose / V-bit / Engraving / Other |
| **Diameter Ø mm** | Used for tool marker size and SVG toolpath defaults (default ~3.175 mm) |
| **Tip angle °** | Shown for V-bits (1–179) |

> **Safety:** Wrong diameter does not stop the machine from cutting — it only affects preview / SVG generation. Always verify depth and tool in the G-code for real cuts.

## Feeds & speeds (material presets)

Pick a **material** (softwood, hardwood, acrylic, MDF) and **cut style** (engrave vs cut / outline). SharpCNC suggests feed, plunge, spindle RPM, and a depth starting point scaled to the current bit Ø. Values persist across launches; **Recalc from preset** refreshes from the table; **Apply to SVG** copies them into the SVG generate fields.

**Saved presets:** name the current F/S setup and **Save preset** for favorites (load / delete from the same panel).

![Presets to F/S](assets/diagram-feeds-speeds.svg)

These are hobby starting points — always test on scrap. Runtime feed / rapid / spindle **override percents** persist across relaunch and appear on the safety strip while a job runs (emphasized in **Run**).

## Checklist before a job

1. Clamp stock; measure width / length / thickness.  
2. Jog tip to the job corner; **Set XY zero + stock … at tip**.  
3. Enter (or adjust) W / L / T — glance at the visualizer.  
4. Optional: **Trace stock perimeter…** to verify the blank bounds.  
5. Install the bit; enter diameter (and tip angle if V-bit).  
6. Pick material + cut style; apply suggested F/S to SVG if generating in-app.  
7. Probe / set Material Z to the top face you intend in CAM or SVG.

Next: [Prepare & Z probe](07-prepare-and-z-probe.md).
