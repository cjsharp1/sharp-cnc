# Visual setup

**Order of operations** (Chris’s model):

1. **[Calibration](calibration.html)** — once per machine (or after hardware change): `$3` · steps/mm · soft travel · optional bed travel test  
2. **[Per-job prepare](prepare.html)** — every new job: connect · home as needed · stock · XY zero · Z probe · cut  

**ELI5:** Calibration = teach the machine how far a millimeter is (once). Prepare = tell it where *this* piece of wood sits (every job). Each step card has a short plain-English “what / why” under the action line.

**Operator steps:** Every section also lists numbered **do this** actions with an **Expect** outcome (what to click/jog/confirm and what you should see).

Fresh-install bootstrap (connect → home → into calibration): [First-run wizard](first-run.html)

Hub: [setup-visual/index.html](index.html) · overview art: [order-of-ops.svg](assets/order-of-ops.svg)

Text appendices: [Calibration](../user-guide/05-calibration.md) · [Prepare & Z probe](../user-guide/07-prepare-and-z-probe.md)
