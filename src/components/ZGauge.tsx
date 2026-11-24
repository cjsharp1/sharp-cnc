/**
 * Side-on Z gauge for the machine view. The bed view is top-down, so Z only
 * shows up as numbers there; most crashes are Z mistakes. This shows where the
 * tool tip is between Z home (top of travel, machine 0) and the bottom of
 * travel, plus material Z0, the stock, and the loaded job's Z range.
 */
interface ZGaugeProps {
  /** Current machine Z (0 at home / top, negative below). */
  machineZ: number;
  /** Z travel length from home ($132), positive mm. Null when unknown. */
  zTravelMm: number | null;
  /** Machine Z of home (usually 0). */
  homeZ?: number;
  /**
   * Machine Z of material Z0 (the work offset). Null when no material zero
   * has been set yet.
   */
  materialZeroMachineZ: number | null;
  /** Stock thickness (mm), drawn below material Z0 when known. */
  stockThicknessMm?: number | null;
  /** Job Z range in work mm (from the loaded file). */
  jobZRange?: { minZ: number; maxZ: number } | null;
}

const H = 140;
const W = 64;
const BAR_X = 22;
const BAR_W = 14;
const PAD_T = 14;
const PAD_B = 14;

export function ZGauge({
  machineZ,
  zTravelMm,
  homeZ = 0,
  materialZeroMachineZ,
  stockThicknessMm = null,
  jobZRange = null,
}: ZGaugeProps) {
  // Scale: top = home; bottom = end of travel, or a sensible span if unknown.
  const known = zTravelMm !== null && zTravelMm > 0;
  const lows = [machineZ - 5];
  if (materialZeroMachineZ !== null) {
    lows.push(materialZeroMachineZ - (stockThicknessMm ?? 0) - 5);
    if (jobZRange) lows.push(materialZeroMachineZ + jobZRange.minZ - 5);
  }
  const bottom = known ? homeZ - zTravelMm! : Math.min(homeZ - 100, ...lows);
  const top = homeZ;
  const span = Math.max(1, top - bottom);
  const y = (z: number) => {
    const clamped = Math.max(bottom - span * 0.05, Math.min(top + span * 0.05, z));
    return PAD_T + ((top - clamped) / span) * (H - PAD_T - PAD_B);
  };

  const toolY = y(machineZ);
  const aboveHome = machineZ > homeZ + 0.01;
  const belowBottom = known && machineZ < bottom - 0.01;

  const z0Y = materialZeroMachineZ !== null ? y(materialZeroMachineZ) : null;
  const stockBottomY =
    materialZeroMachineZ !== null && stockThicknessMm
      ? y(materialZeroMachineZ - stockThicknessMm)
      : null;
  const job =
    materialZeroMachineZ !== null && jobZRange
      ? {
          topY: y(materialZeroMachineZ + jobZRange.maxZ),
          botY: y(materialZeroMachineZ + jobZRange.minZ),
          tooHigh: materialZeroMachineZ + jobZRange.maxZ > homeZ + 0.01,
          tooLow: known && materialZeroMachineZ + jobZRange.minZ < bottom - 0.01,
        }
      : null;

  const workZ =
    materialZeroMachineZ !== null ? machineZ - materialZeroMachineZ : null;

  return (
    <figure className="zgauge" aria-label="Z position side view">
      <figcaption className="zgauge__title">Z</figcaption>
      <svg
        className="zgauge__svg"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Tool at machine Z ${machineZ.toFixed(1)} mm${
          workZ !== null ? `, ${workZ.toFixed(1)} mm from material zero` : ""
        }${known ? `, travel 0 to ${(-zTravelMm!).toFixed(0)} mm` : ", Z travel not set"}`}
      >
        {/* Travel bar */}
        <rect
          className="zgauge__travel"
          x={BAR_X}
          y={y(top)}
          width={BAR_W}
          height={y(bottom) - y(top)}
        />
        <line className="zgauge__home" x1={BAR_X - 4} x2={BAR_X + BAR_W + 4} y1={y(top)} y2={y(top)} />
        <text className="zgauge__label" x={2} y={y(top) + 3}>
          0
        </text>
        {known ? (
          <>
            <line
              className="zgauge__home"
              x1={BAR_X - 4}
              x2={BAR_X + BAR_W + 4}
              y1={y(bottom)}
              y2={y(bottom)}
            />
            <text className="zgauge__label" x={0} y={y(bottom) + 3}>
              {(-zTravelMm!).toFixed(0)}
            </text>
          </>
        ) : null}

        {/* Stock (below material Z0) */}
        {z0Y !== null && stockBottomY !== null ? (
          <rect
            className="zgauge__stock"
            x={BAR_X}
            y={z0Y}
            width={BAR_W}
            height={Math.max(1, stockBottomY - z0Y)}
          />
        ) : null}

        {/* Job Z range */}
        {job ? (
          <rect
            className={`zgauge__job${job.tooHigh || job.tooLow ? " is-out" : ""}`}
            x={BAR_X + BAR_W + 3}
            y={job.topY}
            width={4}
            height={Math.max(1, job.botY - job.topY)}
          />
        ) : null}

        {/* Material Z0 */}
        {z0Y !== null ? (
          <>
            <line className="zgauge__z0" x1={BAR_X - 6} x2={BAR_X + BAR_W + 8} y1={z0Y} y2={z0Y} />
            <text className="zgauge__label zgauge__label--z0" x={BAR_X + BAR_W + 9} y={z0Y + 3}>
              Z0
            </text>
          </>
        ) : null}

        {/* Tool tip */}
        <path
          className={`zgauge__tool${aboveHome || belowBottom ? " is-out" : ""}`}
          d={`M ${BAR_X - 1} ${toolY} l -8 -5 v 10 z`}
        />
      </svg>
      <p className="zgauge__read">
        {workZ !== null ? `${workZ.toFixed(1)}` : `${machineZ.toFixed(1)}`}
        <span>{workZ !== null ? "from Z0" : "machine"}</span>
      </p>
      {!known ? <p className="zgauge__warn">Z travel not set</p> : null}
      {job?.tooHigh ? <p className="zgauge__warn">Job goes above home</p> : null}
      {job?.tooLow ? <p className="zgauge__warn">Job goes below travel</p> : null}
    </figure>
  );
}
