import type { Position3, ToolpathSegment } from "../grbl";

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

  return (
    <section className="machine" aria-label="Machine view">
      <div className="machine__frame">
        <svg
          className="machine__svg"
          viewBox={`0 0 ${viewW} ${viewH}`}
          role="img"
          aria-label="Bed, toolpath, and tool position"
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

          <text
            x={pad + 10}
            y={pad + 22}
            className="machine__label"
            fill="rgba(232, 234, 237, 0.45)"
            fontSize="12"
          >
            Bed {bedMm.width}×{bedMm.depth} mm · live WPos
            {path.length > 0
              ? ` · ${pathLabel ?? "path"} · ${path.length} segs`
              : ""}
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
              r="18"
              fill="none"
              stroke="rgba(212, 168, 75, 0.35)"
              strokeWidth="1"
            >
              <animate
                attributeName="r"
                values="14;22;14"
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
            <circle cx={cx} cy={cy} r="5" fill="#d4a84b" />
            <circle cx={cx} cy={cy} r="2" fill="#1a1c1e" />
          </g>
        </svg>
      </div>
    </section>
  );
}
