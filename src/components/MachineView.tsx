import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { Position3, StockConfig, ToolpathSegment } from "../grbl";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_STEP,
  clientToWorkMm,
  clampCamera,
  fitCamera,
  gridSpacing,
  gridTicks,
  mapWorkToSvg,
  panByMm,
  visibleWindow,
  viewBoxForCamera,
  zoomAtPoint,
  type ViewCamera,
} from "./machineViewMath";

export interface TrailPoint {
  x: number;
  y: number;
}

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
  /** Recent motion trail in work mm (short fade). */
  trail?: TrailPoint[];
  /** Live machine is jogging or running a job. */
  liveMoving?: boolean;
  /** Pre-run simulation is driving the toolhead (not serial). */
  simulating?: boolean;
  /** Optional overlay (e.g. simulate controls). */
  overlay?: ReactNode;
}

function segmentToPoints(
  segments: ToolpathSegment[],
  map: (x: number, y: number) => { x: number; y: number },
): { rapid: string; feed: string } {
  const rapid: string[] = [];
  const feed: string[] = [];

  for (const seg of segments) {
    const a = map(seg.from.x, seg.from.y);
    const b = map(seg.to.x, seg.to.y);
    const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
    if (seg.motion === "rapid") rapid.push(d);
    else feed.push(d);
  }

  return {
    rapid: rapid.join(" "),
    feed: feed.join(" "),
  };
}

function trailToPath(
  trail: TrailPoint[],
  map: (x: number, y: number) => { x: number; y: number },
): string {
  if (trail.length < 2) return "";
  const parts: string[] = [];
  for (let i = 0; i < trail.length; i++) {
    const p = map(trail[i]!.x, trail[i]!.y);
    parts.push(`${i === 0 ? "M" : "L"} ${p.x} ${p.y}`);
  }
  return parts.join(" ");
}

export function MachineView({
  tool,
  bedMm = { width: 300, depth: 200 },
  path = [],
  pathProgress = 0,
  pathLabel = null,
  stock = null,
  toolDiameterMm = 3.175,
  trail = [],
  liveMoving = false,
  simulating = false,
  overlay = null,
}: MachineViewProps) {
  const uid = useId().replace(/:/g, "");
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<ViewCamera>(fitCamera(bedMm));
  const [camera, setCamera] = useState<ViewCamera>(() => fitCamera(bedMm));
  const [viewport, setViewport] = useState({ width: 640, height: 400 });
  const [isPanning, setIsPanning] = useState(false);

  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const pinchRef = useRef<{
    dist: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  cameraRef.current = camera;

  // Keep a true-aspect fit when the bed size changes.
  useEffect(() => {
    const next = fitCamera(bedMm);
    cameraRef.current = next;
    setCamera(next);
  }, [bedMm.width, bedMm.depth]);

  // Observe the frame so viewBox aspect matches the on-screen SVG.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const width = Math.max(1, r.width);
      const height = Math.max(1, r.height);
      setViewport((prev) =>
        Math.abs(prev.width - width) < 0.5 &&
        Math.abs(prev.height - height) < 0.5
          ? prev
          : { width, height },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const commitCamera = useCallback(
    (next: ViewCamera) => {
      const clamped = clampCamera(bedMm, viewport, next);
      cameraRef.current = clamped;
      setCamera(clamped);
    },
    [bedMm, viewport],
  );

  const handleFit = useCallback(() => {
    commitCamera(fitCamera(bedMm));
  }, [bedMm, commitCamera]);

  const handleZoomButton = useCallback(
    (direction: 1 | -1) => {
      const factor = direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      commitCamera(
        zoomAtPoint(
          bedMm,
          viewport,
          cameraRef.current,
          factor,
          cameraRef.current.cx,
          cameraRef.current.cy,
        ),
      );
    },
    [bedMm, viewport, commitCamera],
  );

  const localPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: viewport.width / 2, y: viewport.height / 2 };
      const r = svg.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    },
    [viewport.width, viewport.height],
  );

  const workAtClient = useCallback(
    (clientX: number, clientY: number) => {
      const local = localPoint(clientX, clientY);
      return clientToWorkMm(
        bedMm,
        viewport,
        cameraRef.current,
        local.x,
        local.y,
      );
    },
    [bedMm, viewport, localPoint],
  );

  // Non-passive wheel so preventDefault actually stops page scroll.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const anchor = workAtClient(e.clientX, e.clientY);
      const intensity = Math.min(2.5, Math.abs(e.deltaY) / 100);
      const shrinking = e.deltaY > 0;
      const factor = shrinking
        ? 1 / Math.pow(ZOOM_STEP, intensity)
        : Math.pow(ZOOM_STEP, intensity);
      commitCamera(
        zoomAtPoint(
          bedMm,
          viewport,
          cameraRef.current,
          factor,
          anchor.x,
          anchor.y,
        ),
      );
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [bedMm, viewport, workAtClient, commitCamera]);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Pinch is handled by native touch listeners; skip one-finger drag start mid-pinch.
      if (pinchRef.current) return;
      const svg = svgRef.current;
      if (!svg) return;

      dragRef.current = {
        pointerId: e.pointerId,
        lastX: e.clientX,
        lastY: e.clientY,
      };
      svg.setPointerCapture(e.pointerId);
      setIsPanning(true);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const vis = visibleWindow(bedMm, viewport, cameraRef.current.zoom);
      const dxPx = e.clientX - drag.lastX;
      const dyPx = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      // Grab-drag: content follows the pointer (maps / CAD feel).
      // Screen +Y is down; work +Y is up — flip the Y delta.
      const dxMm = (dxPx / Math.max(1, viewport.width)) * vis.width;
      const dyMm = -(dyPx / Math.max(1, viewport.height)) * vis.height;
      commitCamera(panByMm(bedMm, viewport, cameraRef.current, dxMm, dyMm));
    },
    [bedMm, viewport, commitCamera],
  );

  const endPan = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsPanning(false);
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  // Native touch listeners for pinch (React synthetic touch is awkward with capture).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        const mid = workAtClient(
          (a.clientX + b.clientX) / 2,
          (a.clientY + b.clientY) / 2,
        );
        pinchRef.current = { dist, anchorX: mid.x, anchorY: mid.y };
        dragRef.current = null;
        setIsPanning(false);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const a = e.touches[0]!;
        const b = e.touches[1]!;
        const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        const prev = pinchRef.current.dist;
        if (prev > 0 && dist > 0) {
          const factor = dist / prev;
          const mid = workAtClient(
            (a.clientX + b.clientX) / 2,
            (a.clientY + b.clientY) / 2,
          );
          commitCamera(
            zoomAtPoint(
              bedMm,
              viewport,
              cameraRef.current,
              factor,
              mid.x,
              mid.y,
            ),
          );
          pinchRef.current = { dist, anchorX: mid.x, anchorY: mid.y };
        }
      } else if (e.touches.length === 1 && dragRef.current) {
        // one-finger pan handled via pointer events
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    svg.addEventListener("touchstart", onTouchStart, { passive: true });
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    svg.addEventListener("touchend", onTouchEnd);
    svg.addEventListener("touchcancel", onTouchEnd);
    return () => {
      svg.removeEventListener("touchstart", onTouchStart);
      svg.removeEventListener("touchmove", onTouchMove);
      svg.removeEventListener("touchend", onTouchEnd);
      svg.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [bedMm, viewport, workAtClient, commitCamera]);

  const vis = visibleWindow(bedMm, viewport, camera.zoom);
  const vb = viewBoxForCamera(bedMm, viewport, camera);
  const spacing = gridSpacing(vis.pxPerMm);
  const mapPoint = (x: number, y: number) => mapWorkToSvg(x, y, bedMm);

  const completed = path.slice(0, Math.max(0, pathProgress));
  const remaining = path.slice(Math.max(0, pathProgress));
  const donePaths = segmentToPoints(completed, mapPoint);
  const todoPaths = segmentToPoints(remaining, mapPoint);
  const trailD = trailToPath(trail, mapPoint);

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

  const clampedX = Math.min(Math.max(tool.x, 0), bedMm.width);
  const clampedY = Math.min(Math.max(tool.y, 0), bedMm.depth);
  const toolMapped = mapPoint(clampedX, clampedY);

  // Bit marker: true mm radius, with a small screen-pixel floor when zoomed out.
  const bitRMm = Math.max(0.05, toolDiameterMm / 2);
  const minScreenR = 3.5;
  const bitR = Math.max(bitRMm, minScreenR / vis.pxPerMm);

  const workYMin = bedMm.depth - (vb.y + vb.h);
  const workYMax = bedMm.depth - vb.y;
  const majorX = gridTicks(0, bedMm.width, spacing.major);
  const majorYWork = gridTicks(0, bedMm.depth, spacing.major);

  const labelSize = 11 / vis.pxPerMm;
  const bedIsSquare = Math.abs(bedMm.width - bedMm.depth) < 0.05;

  const stockLabel = stock
    ? ` · stock ${stock.widthMm}×${stock.lengthMm}×${stock.thicknessMm} mm`
    : "";

  const modeLabel = simulating
    ? " · PREVIEW"
    : liveMoving
      ? " · live motion"
      : " · live WPos";

  const zoomPct = Math.round(camera.zoom * 100);
  const canZoomIn = camera.zoom < MAX_ZOOM - 1e-6;
  const canZoomOut = camera.zoom > MIN_ZOOM + 1e-6;

  const gridMajorId = `bed-grid-major-${uid}`;
  const gridMinorId = `bed-grid-minor-${uid}`;
  const stockHatchId = `stock-hatch-${uid}`;
  const bedGlowId = `bed-glow-${uid}`;

  return (
    <section
      className={`machine${liveMoving ? " is-live-moving" : ""}${simulating ? " is-simulating" : ""}${isPanning ? " is-panning" : ""}`}
      aria-label="Machine view"
    >
      <div className="machine__frame" ref={frameRef}>
        <div className="machine__toolbar" role="toolbar" aria-label="View">
          <button
            type="button"
            className="machine__zoom-btn"
            aria-label="Zoom in"
            title="Zoom in"
            disabled={!canZoomIn}
            onClick={() => handleZoomButton(1)}
          >
            Zoom in
          </button>
          <button
            type="button"
            className="machine__zoom-btn"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={!canZoomOut}
            onClick={() => handleZoomButton(-1)}
          >
            Zoom out
          </button>
          <button
            type="button"
            className="machine__zoom-btn machine__zoom-btn--fit"
            aria-label="Fit bed"
            title="Fit bed (Home view)"
            onClick={handleFit}
          >
            Fit
          </button>
          <span className="machine__zoom-readout" aria-live="polite">
            {zoomPct}%
            <span className="machine__zoom-readout-dim">
              {" "}
              · grid {spacing.minor}/{spacing.major} mm
              {bedIsSquare ? " · square" : ""}
            </span>
          </span>
        </div>

        <svg
          ref={svgRef}
          className="machine__svg"
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          role="img"
          aria-label="Bed, stock, toolpath, and tool position"
          preserveAspectRatio="none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <defs>
            <pattern
              id={gridMinorId}
              width={spacing.minor}
              height={spacing.minor}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${spacing.minor} 0 L 0 0 0 ${spacing.minor}`}
                fill="none"
                stroke="rgba(196, 168, 90, 0.11)"
                strokeWidth={0.6}
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
            <pattern
              id={gridMajorId}
              width={spacing.major}
              height={spacing.major}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${spacing.major} 0 L 0 0 0 ${spacing.major}`}
                fill="none"
                stroke="rgba(196, 168, 90, 0.28)"
                strokeWidth={1.1}
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
            <radialGradient id={bedGlowId} cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="rgba(212, 168, 75, 0.16)" />
              <stop offset="100%" stopColor="rgba(18, 20, 22, 0)" />
            </radialGradient>
            <pattern
              id={stockHatchId}
              width={8 / vis.pxPerMm}
              height={8 / vis.pxPerMm}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2={8 / vis.pxPerMm}
                stroke="rgba(140, 110, 70, 0.35)"
                strokeWidth={1.5 / vis.pxPerMm}
              />
            </pattern>
          </defs>

          {/* Dim outside the bed */}
          <rect
            x={vb.x - vis.width}
            y={vb.y - vis.height}
            width={vis.width * 3}
            height={vis.height * 3}
            fill="rgba(10, 12, 14, 0.92)"
          />

          <rect
            x={0}
            y={0}
            width={bedMm.width}
            height={bedMm.depth}
            fill={`url(#${gridMinorId})`}
          />
          <rect
            x={0}
            y={0}
            width={bedMm.width}
            height={bedMm.depth}
            fill={`url(#${gridMajorId})`}
          />
          <rect
            x={0}
            y={0}
            width={bedMm.width}
            height={bedMm.depth}
            fill={`url(#${bedGlowId})`}
          />
          <rect
            x={0}
            y={0}
            width={bedMm.width}
            height={bedMm.depth}
            fill="none"
            stroke="rgba(138, 148, 158, 0.55)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />

          {/* Explicit major lines for clearer hierarchy (patterns alone can look even). */}
          <g className="machine__grid-majors" aria-hidden>
            {majorX.map((x) => (
              <line
                key={`mx-${x}`}
                x1={x}
                y1={0}
                x2={x}
                y2={bedMm.depth}
                stroke="rgba(196, 168, 90, 0.22)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {majorYWork.map((yWork) => {
              const y = bedMm.depth - yWork;
              return (
                <line
                  key={`my-${yWork}`}
                  x1={0}
                  y1={y}
                  x2={bedMm.width}
                  y2={y}
                  stroke="rgba(196, 168, 90, 0.22)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>

          {/* Axis labels on major ticks (helpful, clipped to bed). */}
          <g className="machine__grid-labels" aria-hidden>
            {majorX
              .filter((x) => x >= vb.x && x <= vb.x + vb.w)
              .map((x) => (
                <text
                  key={`lx-${x}`}
                  x={x + labelSize * 0.2}
                  y={Math.min(
                    bedMm.depth - labelSize * 0.35,
                    vb.y + vb.h - labelSize * 0.4,
                  )}
                  fill="rgba(232, 234, 237, 0.4)"
                  fontSize={labelSize}
                  style={{ fontFamily: "var(--font-mono, monospace)" }}
                >
                  {formatMmLabel(x)}
                </text>
              ))}
            {majorYWork
              .filter((y) => y >= workYMin && y <= workYMax)
              .map((yWork) => {
                const y = bedMm.depth - yWork;
                return (
                  <text
                    key={`ly-${yWork}`}
                    x={Math.max(0, vb.x) + labelSize * 0.25}
                    y={y - labelSize * 0.25}
                    fill="rgba(232, 234, 237, 0.4)"
                    fontSize={labelSize}
                    style={{ fontFamily: "var(--font-mono, monospace)" }}
                  >
                    {formatMmLabel(yWork)}
                  </text>
                );
              })}
          </g>

          {stockRect && (
            <g className="machine__stock">
              <rect
                x={stockRect.x}
                y={stockRect.y}
                width={stockRect.w}
                height={stockRect.h}
                fill="rgba(90, 72, 48, 0.45)"
                stroke="rgba(196, 152, 90, 0.75)"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={stockRect.x}
                y={stockRect.y}
                width={stockRect.w}
                height={stockRect.h}
                fill={`url(#${stockHatchId})`}
                opacity="0.55"
              />
              <text
                x={stockRect.x + labelSize * 0.6}
                y={stockRect.y + Math.min(labelSize * 1.4, stockRect.h * 0.9)}
                className="machine__label"
                fill="rgba(232, 214, 170, 0.7)"
                fontSize={labelSize}
              >
                Stock
              </text>
            </g>
          )}

          {/* Remaining path (dim) */}
          {todoPaths.rapid && (
            <path
              d={todoPaths.rapid}
              fill="none"
              stroke="rgba(138, 148, 158, 0.35)"
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {todoPaths.feed && (
            <path
              d={todoPaths.feed}
              fill="none"
              stroke="rgba(212, 168, 75, 0.45)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Completed path (brighter) */}
          {donePaths.rapid && (
            <path
              d={donePaths.rapid}
              fill="none"
              stroke="rgba(138, 148, 158, 0.55)"
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {donePaths.feed && (
            <path
              d={donePaths.feed}
              fill="none"
              stroke="rgba(232, 196, 110, 0.9)"
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Short motion trail */}
          {trailD && (
            <path
              className="machine__trail"
              d={trailD}
              fill="none"
              stroke={
                simulating
                  ? "rgba(120, 180, 220, 0.75)"
                  : "rgba(212, 168, 75, 0.7)"
              }
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}

          <g
            className={`machine__tool${liveMoving || simulating ? " is-moving" : ""}`}
          >
            <circle
              cx={toolMapped.x}
              cy={toolMapped.y}
              r={bitR * 2.2}
              fill="none"
              stroke={
                simulating
                  ? "rgba(120, 180, 220, 0.45)"
                  : "rgba(212, 168, 75, 0.35)"
              }
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            >
              <animate
                attributeName="r"
                values={`${bitR * 1.6};${bitR * 2.6};${bitR * 1.6}`}
                dur={liveMoving || simulating ? "1.1s" : "2.8s"}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values="0.85;0.25;0.85"
                dur={liveMoving || simulating ? "1.1s" : "2.8s"}
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={toolMapped.x}
              cy={toolMapped.y}
              r={bitR}
              fill={
                simulating
                  ? "rgba(120, 180, 220, 0.4)"
                  : "rgba(212, 168, 75, 0.35)"
              }
              stroke={simulating ? "#78b4dc" : "#d4a84b"}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={toolMapped.x}
              cy={toolMapped.y}
              r={Math.max(bitRMm * 0.28, 1.5 / vis.pxPerMm)}
              fill="#1a1c1e"
            />
          </g>
        </svg>

        <p className="machine__hud" aria-live="polite">
          Bed {bedMm.width}×{bedMm.depth} mm
          {modeLabel}
          {stockLabel}
          {path.length > 0
            ? ` · ${pathLabel ?? "path"} · ${path.length} segs`
            : ""}
          {` · Ø${toolDiameterMm} mm`}
        </p>

        {simulating && (
          <div className="machine__preview-badge" role="status">
            Preview — not sending to CNC
          </div>
        )}

        {overlay}
      </div>
    </section>
  );
}

function formatMmLabel(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return String(Number(v.toFixed(1)));
}
