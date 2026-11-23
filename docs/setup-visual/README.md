# Visual setup

**Order of operations** (task phases):

0. **[Connect](connect.html)** — every session: Virtual CNC (practice) or COM port → Linked  
1. **[Calibrate](calibration.html)** — once per machine (or after hardware change): `$3` · steps/mm · soft travel · optional bed travel test  
2. **[Prepare](prepare.html)** — every new job: stock · Material XYZ · Z probe · load · Mark ready  
3. **[Verify](verify.html)** — soft-limit check · Simulate · checklist · Start  
4. **[Run](run.html)** — progress · feed/spindle overrides · Hold / Stop  

**ELI5:** Connect = open the chat line. Calibrate = teach the machine how far a millimeter is (once). Prepare = place *this* board and load *this* drawing. Verify = dress rehearsal + Start. Run = watch the cut. Advanced (console / macros / raw `$$`) is Menu-only — not a phase.

**First-test alignment:** [Stage 1 Connect-only](../user-guide/13-first-test-stages.md) · Stage 2 air jog (after Calibrate) · Stage 3 no-tool raised-Z Start from Verify · Stage 4 scrap still Starts from Verify / watches in Run.

**Operator steps:** Every section also lists numbered **do this** actions with an **Expect** outcome (what to click/jog/confirm and what you should see).

Fresh-install bootstrap (connect → home → into calibration): [First-run wizard](first-run.html)

Hub: [setup-visual/index.html](index.html) · overview art: [order-of-ops.svg](assets/order-of-ops.svg)

**Axis convention (matches MachineView):** looking down on the bed, **+X right**, **+Y back = up on screen**, **+Z up** (out of the bed).

**Corner map:** NW NE on the top row, SW SE on the bottom.

**Diagram type:** SVG guides set the SharpCNC UI stack (`"Sora", system-ui, "Segoe UI", sans-serif`) on `text, tspan` so secondary labels (`.tiny`, etc.) never fall back to the browser’s Times-like SVG default. Mono callouts use `"IBM Plex Mono", … monospace`; UI-map brand uses Oswald. Same convention applies to `docs/user-guide/assets/diagram-*.svg`.

**Diagram text alignment:**
- **Centered controls** (buttons, tabs, chips, badges, short labels on boxes/markers): `text-anchor="middle"` at the shape’s center `x`, plus `dominant-baseline="central"` at center `y` for single-line labels.
- **Stacked button captions** (e.g. Z+ / raise tool): both lines middle-anchored on the same center `x`, with primary slightly above and caption slightly below the vertical midpoint.
- **Panel body copy / titles / lists**: left-aligned with a consistent inset (~16–24px from the panel edge).
- **Labels beside axes or leaders**: stay start-anchored next to the stroke (not forced to the parent box center).

Text appendices: [Connect](../user-guide/02-connect.md) · [Calibration](../user-guide/05-calibration.md) · [Prepare & Z probe](../user-guide/07-prepare-and-z-probe.md) · [Jobs & run](../user-guide/08-jobs-and-svg.md) · [First-test stages](../user-guide/13-first-test-stages.md)
