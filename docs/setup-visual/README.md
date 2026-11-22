# Visual setup

**Order of operations** (Chris’s model):

1. **[Calibration](calibration.html)** — once per machine (or after hardware change): `$3` · steps/mm · soft travel · optional bed travel test  
2. **[Per-job prepare](prepare.html)** — every new job: connect · home as needed · **load G-code/SVG** · stock · XY zero · Z probe · verify on bed · Simulate · cut  

**ELI5:** Calibration = teach the machine how far a millimeter is (once). Prepare = load *this* drawing and tell the machine where *this* piece of wood sits (every job). Each step card has a short plain-English “what / why” under the action line.

**Operator steps:** Every section also lists numbered **do this** actions with an **Expect** outcome (what to click/jog/confirm and what you should see).

Fresh-install bootstrap (connect → home → into calibration): [First-run wizard](first-run.html)

Hub: [setup-visual/index.html](index.html) · overview art: [order-of-ops.svg](assets/order-of-ops.svg)

**Axis convention (matches MachineView):** looking down on the bed, **+X right**, **+Y back = up on screen**, **+Z up** (out of the bed).

**Diagram type:** SVG guides set the SharpCNC UI stack (`"Sora", system-ui, "Segoe UI", sans-serif`) on `text, tspan` so secondary labels (`.tiny`, etc.) never fall back to the browser’s Times-like SVG default. Mono callouts use `"IBM Plex Mono", … monospace`; UI-map brand uses Oswald. Same convention applies to `docs/user-guide/assets/diagram-*.svg`.

**Diagram text alignment:**
- **Centered controls** (buttons, tabs, chips, badges, short labels on boxes/markers): `text-anchor="middle"` at the shape’s center `x`, plus `dominant-baseline="central"` at center `y` for single-line labels.
- **Stacked button captions** (e.g. Z+ / raise tool): both lines middle-anchored on the same center `x`, with primary slightly above and caption slightly below the vertical midpoint.
- **Panel body copy / titles / lists**: left-aligned with a consistent inset (~16–24px from the panel edge).
- **Labels beside axes or leaders**: stay start-anchored next to the stroke (not forced to the parent box center).

Text appendices: [Calibration](../user-guide/05-calibration.md) · [Prepare & Z probe](../user-guide/07-prepare-and-z-probe.md)
