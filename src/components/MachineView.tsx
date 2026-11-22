import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type {
  Position3,
  SimActivity,
  StockConfig,
  StockHandle,
  StockHit,
  ToolpathSegment,
} from "../grbl";
import {
  cursorForStockHit,
  formatSimActivityLabel,
  hitTestStock,
  moveStockBy,
  resizeStockFromHandle,
} from "../grbl";
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

const STOCK_HANDLES: StockHandle[] = [
  "n",
  "s",
  "e",
  "w",
  "ne",
  "nw",
  "se",
  "sw",
];

/** Screen-pixel half-size for resize handle hit / draw. */
const HANDLE_HIT_PX = 9;

export interface TrailPoint {
  x: number;
  y: number;
  /** Optional Z for sim depth cues. */
  z?: number;
  /** Optional activity tint for sim trail segments. */
  activity?: SimActivity;
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
  /**
   * When set, stock is selectable: drag the blank to move, drag handles to
   * resize. Same object as Material & tool / Prepare stock.
   */
  onStockChange?: ((next: StockConfig) => void) | null;
  /** Bit diameter for toolhead marker scale (mm). */
  toolDiameterMm?: number;
  /** Recent motion trail in work mm (short fade). */
  trail?: TrailPoint[];
  /** Live machine is jogging or running a job. */
  liveMoving?: boolean;
  /** Pre-run simulation is driving the toolhead (not serial). */
  simulating?: boolean;
  /** Current sim activity (retract / plunge / cut / rapid). */
  simActivity?: SimActivity | null;
  /**
   * Work coordinate offset (WCO = MPos − WPos). When set, draw dual origins:
   * work zero at (0,0) and machine zero at (−WCO.x, −WCO.y) in work space.
   */
  wco?: Position3 | null;
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
    // Skip pure-Z segments on the plan view (no XY travel).
    if (seg.from.x === seg.to.x && seg.from.y === seg.to.y) continue;
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

function trailStrokeForActivity(activity: SimActivity | undefined): string {
  switch (activity) {
    case "retract":
      return "var(--viz-trail-sim-retract)";
    case "plunge":
      return "var(--viz-trail-sim-plunge)";
    case "cut":
      return "var(--viz-trail-sim-cut)";
    case "rapid":
      return "var(--viz-trail-sim-rapid)";
    default:
      return "var(--viz-trail-sim)";
  }
}

/** Build short trail polylines, splitting when activity/color changes. */
function trailPathsByActivity(
  trail: TrailPoint[],
  map: (x: number, y: number) => { x: number; y: number },
): { d: string; activity: SimActivity | undefined }[] {
  if (trail.length < 2) return [];
  const out: { d: string; activity: SimActivity | undefined }[] = [];
  let parts: string[] = [];
  let current = trail[0]!.activity;

  const flush = () => {
    if (parts.length >= 2) {
      out.push({ d: parts.join(" "), activity: current });
    }
    parts = [];
  };

  for (let i = 0; i < trail.length; i++) {
    const pt = trail[i]!;
    const p = map(pt.x, pt.y);
    if (i > 0 && pt.activity !== current) {
      // Close previous segment at this point, then start a new one.
      parts.push(`L ${p.x} ${p.y}`);
      flush();
      current = pt.activity;
      parts.push(`M ${p.x} ${p.y}`);
    } else {
      parts.push(`${parts.length === 0 ? "M" : "L"} ${p.x} ${p.y}`);
    }
  }
  flush();
  return out;
}

export function MachineView({
  tool,
  bedMm = { width: 300, depth: 200 },
  path = [],
  pathProgress = 0,
  pathLabel = null,
  stock = null,
  onStockChange = null,
  toolDiameterMm = 3.175,
  trail = [],
  liveMoving = false,
  simulating = false,
  simActivity = null,
  wco = null,
  overlay = null,
}: MachineViewProps) {
  const uid = useId().replace(/:/g, "");
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cameraRef = useRef<ViewCamera>(fitCamera(bedMm));
  const stockRef = useRef<StockConfig | null>(stock);
  const onStockChangeRef = useRef(onStockChange);
  const [camera, setCamera] = useState<ViewCamera>(() => fitCamera(bedMm));
  const [viewport, setViewport] = useState({ width: 640, height: 400 });
  const [isPanning, setIsPanning] = useState(false);
  const [stockSelected, setStockSelected] = useState(false);
  const [stockHover, setStockHover] = useState<StockHit | null>(null);
  const [isEditingStock, setIsEditingStock] = useState(false);

  type DragState =
    | {
        kind: "pan";
        pointerId: number;
        lastX: number;
        lastY: number;
      }
    | {
        kind: "move-stock";
        pointerId: number;
        lastWorkX: number;
        lastWorkY: number;
      }
    | {
        kind: "resize-stock";
        pointerId: number;
        handle: StockHandle;
      };

  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<{
    dist: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  cameraRef.current = camera;
  stockRef.current = stock;
  onStockChangeRef.current = onStockChange;

  // Drop selection if stock disappears or editing is disabled.
  useEffect(() => {
    if (!stock || !onStockChange) {
      setStockSelected(false);
      setStockHover(null);
      setIsEditingStock(false);
      dragRef.current = null;
    }
  }, [stock, onStockChange]);

  // Escape clears stock selection.
  useEffect(() => {
    if (!stockSelected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStockSelected(false);
        setStockHover(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stockSelected]);

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

  const handleHitMm = useCallback(() => {
    const vis = visibleWindow(bedMm, viewport, cameraRef.current.zoom);
    return HANDLE_HIT_PX / Math.max(1e-6, vis.pxPerMm);
  }, [bedMm, viewport]);

  const pickStockHit = useCallback(
    (clientX: number, clientY: number, selected: boolean): StockHit | null => {
      const current = stockRef.current;
      if (!current || !onStockChangeRef.current) return null;
      if (!(current.widthMm > 0 && current.lengthMm > 0)) return null;
      const work = workAtClient(clientX, clientY);
      return hitTestStock(
        current,
        work.x,
        work.y,
        handleHitMm(),
        selected,
      );
    },
    [workAtClient, handleHitMm],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Pinch is handled by native touch listeners; skip one-finger drag start mid-pinch.
      if (pinchRef.current) return;
      const svg = svgRef.current;
      if (!svg) return;

      const hit = pickStockHit(e.clientX, e.clientY, stockSelected);
      if (hit) {
        setStockSelected(true);
        setIsPanning(false);
        setIsEditingStock(true);
        const work = workAtClient(e.clientX, e.clientY);
        if (hit === "body") {
          dragRef.current = {
            kind: "move-stock",
            pointerId: e.pointerId,
            lastWorkX: work.x,
            lastWorkY: work.y,
          };
        } else {
          dragRef.current = {
            kind: "resize-stock",
            pointerId: e.pointerId,
            handle: hit,
          };
        }
        svg.setPointerCapture(e.pointerId);
        return;
      }

      if (stockSelected) setStockSelected(false);
      setStockHover(null);
      dragRef.current = {
        kind: "pan",
        pointerId: e.pointerId,
        lastX: e.clientX,
        lastY: e.clientY,
      };
      svg.setPointerCapture(e.pointerId);
      setIsPanning(true);
      setIsEditingStock(false);
    },
    [pickStockHit, stockSelected, workAtClient],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) {
        // Hover affordances when idle (mouse / pen).
        if (!drag && e.pointerType !== "touch") {
          const hit = pickStockHit(e.clientX, e.clientY, stockSelected);
          setStockHover(hit);
        }
        return;
      }

      if (drag.kind === "pan") {
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
        return;
      }

      const current = stockRef.current;
      const onChange = onStockChangeRef.current;
      if (!current || !onChange) return;

      if (drag.kind === "move-stock") {
        const work = workAtClient(e.clientX, e.clientY);
        const dx = work.x - drag.lastWorkX;
        const dy = work.y - drag.lastWorkY;
        drag.lastWorkX = work.x;
        drag.lastWorkY = work.y;
        if (dx === 0 && dy === 0) return;
        onChange(moveStockBy(current, dx, dy, bedMm.width, bedMm.depth));
        return;
      }

      if (drag.kind === "resize-stock") {
        const work = workAtClient(e.clientX, e.clientY);
        onChange(
          resizeStockFromHandle(
            current,
            drag.handle,
            work,
            bedMm.width,
            bedMm.depth,
          ),
        );
      }
    },
    [
      bedMm,
      viewport,
      commitCamera,
      pickStockHit,
      stockSelected,
      workAtClient,
    ],
  );

  const endPointer = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setIsPanning(false);
    setIsEditingStock(false);
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
        setIsEditingStock(false);
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
        // one-finger pan / stock edit handled via pointer events
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
  const trailSegs = trailPathsByActivity(trail, mapPoint);
  const simZLabel =
    simulating && Number.isFinite(tool.z)
      ? formatSimActivityLabel(simActivity ?? null, tool.z)
      : null;
  const toolLifted =
    simulating &&
    (simActivity === "retract" ||
      simActivity === "rapid" ||
      (simActivity == null && tool.z > 0.05));
  const toolPlunging = simulating && simActivity === "plunge";
  const toolCutting = simulating && simActivity === "cut";
  const toolFill = !simulating
    ? "var(--viz-tool-fill)"
    : toolPlunging
      ? "var(--viz-tool-sim-plunge-fill)"
      : toolLifted
        ? "var(--viz-tool-sim-retract-fill)"
        : toolCutting
          ? "var(--viz-tool-sim-cut-fill)"
          : "var(--viz-tool-sim-fill)";
  const toolStroke = !simulating
    ? "var(--viz-tool-stroke)"
    : toolPlunging
      ? "var(--viz-tool-sim-plunge-stroke)"
      : toolLifted
        ? "var(--viz-tool-sim-retract-stroke)"
        : toolCutting
          ? "var(--viz-tool-sim-cut-stroke)"
          : "var(--viz-tool-sim-stroke)";
  const toolClass = [
    "machine__tool",
    liveMoving || simulating ? "is-moving" : "",
    simulating && toolLifted ? "is-lifted" : "",
    simulating && toolPlunging ? "is-plunging" : "",
    simulating && toolCutting ? "is-cutting" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
  const liftStem = Math.max(
    bitR * (toolLifted ? 2.8 : toolPlunging ? 0.6 : 1.4),
    2 / vis.pxPerMm,
  );

  const workYMin = bedMm.depth - (vb.y + vb.h);
  const workYMax = bedMm.depth - vb.y;
  const majorX = gridTicks(0, bedMm.width, spacing.major);
  const majorYWork = gridTicks(0, bedMm.depth, spacing.major);

  const labelSize = 11 / vis.pxPerMm;
  const bedIsSquare = Math.abs(bedMm.width - bedMm.depth) < 0.05;

  const stockLabel = stock
    ? ` · stock ${stock.widthMm}×${stock.lengthMm}×${stock.thicknessMm} mm @ ${stock.offsetXMm},${stock.offsetYMm}`
    : "";

  const stockHint =
    stock && onStockChange
      ? stockSelected
        ? " · fine-tune drag/handles · Esc clears"
        : stock.originCorner
          ? ` · origin ${stock.originCorner.toUpperCase()} · click stock to fine-tune`
          : " · click stock to fine-tune"
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

  const activeHit = isEditingStock
    ? dragRef.current?.kind === "resize-stock"
      ? dragRef.current.handle
      : dragRef.current?.kind === "move-stock"
        ? "body"
        : stockHover
    : stockHover;
  const stockCursor = cursorForStockHit(activeHit);
  const svgCursorStyle = isPanning
    ? undefined
    : stockCursor
      ? ({ cursor: stockCursor } as const)
      : undefined;

  const handleHalfMm = HANDLE_HIT_PX / Math.max(1e-6, vis.pxPerMm);

  return (
    <section
      className={`machine${liveMoving ? " is-live-moving" : ""}${simulating ? " is-simulating" : ""}${isPanning ? " is-panning" : ""}${isEditingStock ? " is-editing-stock" : ""}${stockSelected ? " is-stock-selected" : ""}`}
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
          style={svgCursorStyle}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={() => {
            if (!dragRef.current) setStockHover(null);
          }}
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
                stroke="var(--viz-grid-minor)"
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
                stroke="var(--viz-grid-major)"
                strokeWidth={1.1}
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
            <radialGradient id={bedGlowId} cx="50%" cy="45%" r="60%">
              <stop offset="0%" stopColor="var(--viz-bed-glow-0)" />
              <stop offset="100%" stopColor="var(--viz-bed-glow-1)" />
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
                stroke="var(--viz-stock-hatch)"
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
            fill="var(--viz-outside)"
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
            stroke="var(--viz-bed-edge)"
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
                stroke="var(--viz-grid-line)"
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
                  stroke="var(--viz-grid-line)"
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
                  fill="var(--viz-label)"
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
                    fill="var(--viz-label)"
                    fontSize={labelSize}
                    style={{ fontFamily: "var(--font-mono, monospace)" }}
                  >
                    {formatMmLabel(yWork)}
                  </text>
                );
              })}
          </g>

          {stockRect && stock && (
            <g
              className={`machine__stock${stockSelected ? " is-selected" : ""}${onStockChange ? " is-interactive" : ""}`}
            >
              <rect
                className="machine__stock-body"
                x={stockRect.x}
                y={stockRect.y}
                width={stockRect.w}
                height={stockRect.h}
                fill="var(--viz-stock-fill)"
                stroke="var(--viz-stock-stroke)"
                strokeWidth={stockSelected ? 2.25 : 1.5}
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={stockRect.x}
                y={stockRect.y}
                width={stockRect.w}
                height={stockRect.h}
                fill={`url(#${stockHatchId})`}
                opacity="0.55"
                pointerEvents="none"
              />
              <text
                x={stockRect.x + labelSize * 0.6}
                y={stockRect.y + Math.min(labelSize * 1.4, stockRect.h * 0.9)}
                className="machine__label"
                fill="var(--viz-stock-label)"
                fontSize={labelSize}
                pointerEvents="none"
              >
                Stock
              </text>
              {stockSelected && onStockChange
                ? STOCK_HANDLES.map((handle) => {
                    // stockRect is mapped SVG space (Y down): work +Y (N) is the top edge.
                    const cx = handle.includes("w")
                      ? stockRect.x
                      : handle.includes("e")
                        ? stockRect.x + stockRect.w
                        : stockRect.x + stockRect.w / 2;
                    const cy = handle.includes("n")
                      ? stockRect.y
                      : handle.includes("s")
                        ? stockRect.y + stockRect.h
                        : stockRect.y + stockRect.h / 2;
                    return (
                      <rect
                        key={handle}
                        className={`machine__stock-handle machine__stock-handle--${handle}`}
                        x={cx - handleHalfMm}
                        y={cy - handleHalfMm}
                        width={handleHalfMm * 2}
                        height={handleHalfMm * 2}
                        fill="var(--viz-stock-handle-fill)"
                        stroke="var(--viz-stock-handle-stroke)"
                        strokeWidth={1.25}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })
                : null}
            </g>
          )}

          {/* Remaining path (dim) */}
          {todoPaths.rapid && (
            <path
              d={todoPaths.rapid}
              fill="none"
              stroke="var(--viz-path-todo-rapid)"
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {todoPaths.feed && (
            <path
              d={todoPaths.feed}
              fill="none"
              stroke="var(--viz-path-todo-feed)"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Completed path (brighter) */}
          {donePaths.rapid && (
            <path
              d={donePaths.rapid}
              fill="none"
              stroke="var(--viz-path-done-rapid)"
              strokeWidth={1}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {donePaths.feed && (
            <path
              d={donePaths.feed}
              fill="none"
              stroke="var(--viz-path-done-feed)"
              strokeWidth={1.75}
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Short motion trail (activity-tinted during sim) */}
          {trailSegs.map((seg, i) => (
            <path
              key={`trail-${i}`}
              className="machine__trail"
              d={seg.d}
              fill="none"
              stroke={
                simulating
                  ? trailStrokeForActivity(seg.activity)
                  : "var(--viz-trail)"
              }
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={
                simulating &&
                (seg.activity === "retract" || seg.activity === "rapid")
                  ? "5 4"
                  : undefined
              }
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Dual origin: work zero (0,0) and machine zero (−WCO) in work space */}
          {(() => {
            const workOrigin = mapPoint(0, 0);
            const cross = Math.max(6 / vis.pxPerMm, bitRMm * 1.2);
            const machineWork =
              wco != null
                ? mapPoint(-wco.x, -wco.y)
                : null;
            return (
              <g className="machine__origins" aria-hidden>
                <g className="machine__origin machine__origin--work">
                  <line
                    x1={workOrigin.x - cross}
                    y1={workOrigin.y}
                    x2={workOrigin.x + cross}
                    y2={workOrigin.y}
                    stroke="var(--viz-origin-work, var(--viz-tool-fill))"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={workOrigin.x}
                    y1={workOrigin.y - cross}
                    x2={workOrigin.x}
                    y2={workOrigin.y + cross}
                    stroke="var(--viz-origin-work, var(--viz-tool-fill))"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={workOrigin.x + cross * 0.7}
                    y={workOrigin.y - cross * 0.5}
                    fill="var(--viz-origin-work, var(--viz-tool-fill))"
                    fontSize={labelSize}
                  >
                    Work 0
                  </text>
                </g>
                {machineWork ? (
                  <g className="machine__origin machine__origin--machine">
                    <line
                      x1={machineWork.x - cross}
                      y1={machineWork.y}
                      x2={machineWork.x + cross}
                      y2={machineWork.y}
                      stroke="var(--viz-origin-machine, var(--viz-bed-edge))"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <line
                      x1={machineWork.x}
                      y1={machineWork.y - cross}
                      x2={machineWork.x}
                      y2={machineWork.y + cross}
                      stroke="var(--viz-origin-machine, var(--viz-bed-edge))"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={machineWork.x + cross * 0.7}
                      y={machineWork.y - cross * 0.5}
                      fill="var(--viz-origin-machine, var(--viz-bed-edge))"
                      fontSize={labelSize}
                    >
                      Machine 0
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })()}

          <g className={toolClass}>
            {simulating && (
              <line
                className="machine__tool-stem"
                x1={toolMapped.x}
                y1={toolMapped.y - liftStem}
                x2={toolMapped.x}
                y2={toolMapped.y}
                stroke={toolStroke}
                strokeWidth={1.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <circle
              cx={toolMapped.x}
              cy={toolMapped.y}
              r={bitR * (toolLifted ? 2.8 : toolPlunging ? 1.7 : 2.2)}
              fill="none"
              stroke={toolFill}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            >
              <animate
                attributeName="r"
                values={
                  toolLifted
                    ? `${bitR * 2.2};${bitR * 3.2};${bitR * 2.2}`
                    : toolPlunging
                      ? `${bitR * 1.3};${bitR * 2.0};${bitR * 1.3}`
                      : `${bitR * 1.6};${bitR * 2.6};${bitR * 1.6}`
                }
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
              r={bitR * (toolLifted ? 1.15 : toolPlunging ? 0.85 : 1)}
              fill={toolFill}
              stroke={toolStroke}
              strokeWidth={1.25}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={toolMapped.x}
              cy={toolMapped.y}
              r={Math.max(bitRMm * 0.28, 1.5 / vis.pxPerMm)}
              fill="var(--viz-tool-core)"
            />
          </g>
        </svg>

        <p className="machine__hud" aria-live="polite">
          Bed {bedMm.width}×{bedMm.depth} mm
          {modeLabel}
          {stockLabel}
          {stockHint}
          {path.length > 0
            ? ` · ${pathLabel ?? "path"} · ${path.length} segs`
            : ""}
          {` · Ø${toolDiameterMm} mm`}
          {simZLabel ? ` · ${simZLabel}` : ""}
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
