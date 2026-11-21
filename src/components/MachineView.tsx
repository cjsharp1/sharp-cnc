import type { Position3 } from "../grbl";

interface MachineViewProps {
  tool: Position3;
  /** Bed size in millimeters — placeholder until machine config lands. */
  bedMm?: { width: number; depth: number };
}

export function MachineView({
  tool,
  bedMm = { width: 300, depth: 200 },
}: MachineViewProps) {
  const pad = 28;
  const viewW = 640;
  const viewH = 400;
  const scaleX = (viewW - pad * 2) / bedMm.width;
  const scaleY = (viewH - pad * 2) / bedMm.depth;
  const cx = pad + tool.x * scaleX;
  const cy = viewH - pad - tool.y * scaleY;

  return (
    <section className="machine" aria-label="Machine view">
      <div className="machine__frame">
        <svg
          className="machine__svg"
          viewBox={`0 0 ${viewW} ${viewH}`}
          role="img"
          aria-label="Bed and tool position placeholder"
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
            Bed {bedMm.width}×{bedMm.depth} mm · toolpath soon
          </text>

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
