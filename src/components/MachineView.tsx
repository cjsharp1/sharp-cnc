import type { Position3, StockConfig, ToolpathSegment } from "../grbl";

interface MachineViewProps {
  tool: Position3;
  /** Bed size in millimeters — placeholder until machine config lands. */
  bedMm?: { width: number; depth: number };
  /** Loaded job toolpath in work coordinates (mm). */
  path?: ToolpathSegment[];
  /** How many path segments have been “passed” (acked-based estimate). */
  pathProgress?: number;
  /** Optional label override (e.g. SVG preview vs job path). */
  pathLabel?: string | null;
  /** Workpiece rectangle on the bed (mm). */
  stock?: StockConfig | null;
  /** Bit diameter for toolhead marker scale (mm). */
  toolDiameterMm?: number;
}

function segmentToPoints(
  segments: ToolpathSegment[],
  map: (x: number, y: number) => { x: number; y: number },
): { rapid: string; feed: string; done: string } {
  const rapid: string[] = [];
  const feed: string[] = [];
  const done: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const a = map(seg.from.x, seg.from.y);
    const b = map(seg.to.x, seg.to.y);
    const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    // Caller can pass pathProgress as segment index completed.
    // Colored via separate layers in the SVG.
    if (seg.motion === "rapid") rapid.push(d);
    else feed.push(d);
    void done;
  }

  return {
    rapid: rapid.join(" "),
    feed: feed.join(" "),
    done: "",
  };
}

export function MachineView({
  tool,
  bedMm = { width: 300, depth: 200 },
  path = [],
  pathProgress = 0,
  pathLabel = null,
  stock = null,
  toolDiameterMm = 3.175,
}: MachineViewProps) {
  const pad = 28;
  const viewW = 640;
  const viewH = 400;
  const scaleX = (viewW - pad * 2) / bedMm.width;
  const scaleY = (viewH - pad * 2) / bedMm.depth;
  const clampedX = Math.min(Math.max(tool.x, 0), bedMm.width);
  const clampedY = Math.min(Math.max(tool.y, 0), bedMm.depth);
  const cx = pad + clampedX * scaleX;
  const cy = viewH - pad - clampedY * scaleY;

  const mapPoint = (x: number, y: number) => ({
    x: pad + Math.min(Math.max(x, 0), bedMm.width) * scaleX,
    y: viewH - pad - Math.min(Math.max(y, 0), bedMm.depth) * scaleY,
  });

  const completed = path.slice(0, Math.max(0, pathProgress));
  const remaining = path.slice(Math.max(0, pathProgress));
  const donePaths = segmentToPoints(completed, mapPoint);
  const todoPaths = segmentToPoints(remaining, mapPoint);

  const stockRect =
    stock && stock.widthMm > 0 && stock.lengthMm > 0
      ? (() => {
          const x0 = stock.offsetXMm;
          const y0 = stock.offsetYMm;
          const x1 = stock.offsetXMm + stock.widthMm;
          const y1 = stock.offsetYMm + stock.lengthMm;
          const a = mapPoint(x0, y0);
          const b = mapPoint(x1, y1);
          return {
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            w: Math.abs(b.x - a.x),
            h: Math.abs(b.y - a.y),
          };
        })()
      : null;

  // Tool marker radius ≈ half diameter in screen px (clamped for visibility).
  const pxPerMm = Math.min(scaleX, scaleY);
  const bitR = Math.min(
    28,
    Math.max(3.5, (Math.max(0.1, toolDiameterMm) / 2) * pxPerMm),
  );

  const stockLabel = stock
    ? ` · stock ${stock.widthMm}×${stock.lengthMm}×${stock.thicknessMm} mm`
    : "";

  return (
    <section className="machine" aria-label="Machine view">
      <div className="machine__frame">
        <svg
          className="machine__svg"
          viewBox={`0 0 ${viewW} ${viewH}`}
          role="img"
          aria-label="Bed, stock, toolpath, and tool position"
        >
          <defs>
            <pattern
              id="bed-grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(196, 168, 90, 0.12)"
                strokeWidth="1"
              />
            </pattern>
            <radialGradient id="bed-glow" cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="rgba(212, 168, 75, 0.16)" />
              <stop offset="100%" stopColor="rgba(18, 20, 22, 0)" />
            </radialGradient>
            <pattern
              id="stock-hatch"
              width="8"
              height="8"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="8"
                stroke="rgba(140, 110, 70, 0.35)"
                strokeWidth="1.5"
              />
            </pattern>
          </defs>

          <rect
            x={pad}
            y={pad}
            width={viewW - pad * 2}
            height={viewH - pad * 2}
            fill="url(#bed-grid)"
            stroke="rgba(138, 148, 158, 0.35)"
            strokeWidth="1.5"
            rx="2"
          />
          <rect
            x={pad}
            y={pad}
            width={viewW - pad * 2}
            height={viewH - pad * 2}
            fill="url(#bed-glow)"
          />

          {stockRect && (
            <g className="machine__stock">
              <rect
                x={stockRect.x}
                y={stockRect.y}
                width={stockRect.w}
                height={stockRect.h}
                fill="rgba(90, 72, 48, 0.45)"
                stroke="rgba(196, 152, 90, 0.75)"
                strokeWidth="1.5"
              />
              <rect
                x={stockRect.x}
                y={stockRect.y}
                width={stockRect.w}
                height={stockRect.h}
                fill="url(#stock-hatch)"
                opacity="0.55"
              />
              <text
                x={stockRect.x + 8}
                y={stockRect.y + Math.min(18, stockRect.h - 4)}
                className="machine__label"
                fill="rgba(232, 214, 170, 0.7)"
                fontSize="11"
              >
                Stock
              </text>
            </g>
          )}

          <text
            x={pad + 10}
            y={pad + 22}
            className="machine__label"
            fill="rgba(232, 234, 237, 0.45)"
            fontSize="12"
          >
            Bed {bedMm.width}×{bedMm.depth} mm · live WPos
            {stockLabel}
            {path.length > 0
              ? ` · ${pathLabel ?? "path"} · ${path.length} segs`
              : ""}
            {` · Ø${toolDiameterMm} mm`}
          </text>

          {/* Remaining path (dim) */}
          {todoPaths.rapid && (
            <path
              d={todoPaths.rapid}
              fill="none"
              stroke="rgba(138, 148, 158, 0.35)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          )}
          {todoPaths.feed && (
            <path
              d={todoPaths.feed}
              fill="none"
              stroke="rgba(212, 168, 75, 0.45)"
              strokeWidth="1.5"
            />
          )}

          {/* Completed path (brighter) */}
          {donePaths.rapid && (
            <path
              d={donePaths.rapid}
              fill="none"
              stroke="rgba(138, 148, 158, 0.55)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
          )}
          {donePaths.feed && (
            <path
              d={donePaths.feed}
              fill="none"
              stroke="rgba(232, 196, 110, 0.9)"
              strokeWidth="1.75"
            />
          )}

          <g className="machine__tool">
            <circle
              cx={cx}
              cy={cy}
              r={bitR * 2.2}
              fill="none"
              stroke="rgba(212, 168, 75, 0.35)"
              strokeWidth="1"
            >
              <animate
                attributeName="r"
                values={`${bitR * 1.6};${bitR * 2.6};${bitR * 1.6}`}
                dur="2.8s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.7;0.2;0.7"
                dur="2.8s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={cx}
              cy={cy}
              r={bitR}
              fill="rgba(212, 168, 75, 0.35)"
              stroke="#d4a84b"
              strokeWidth="1.25"
            />
            <circle cx={cx} cy={cy} r={Math.max(1.5, bitR * 0.28)} fill="#1a1c1e" />
          </g>
        </svg>
      </div>
    </section>
  );
}
