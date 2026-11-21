import { useRef, useState, type DragEvent } from "react";
import {
  DEFAULT_SVG_TOOLPATH,
  isSvgFileName,
  type SvgCutMode,
  type SvgImportResult,
  type SvgToolpathParams,
} from "../grbl";

interface SvgJobPanelProps {
  draft: SvgImportResult | null;
  /** True while a G-code job is streaming — block replace/generate. */
  busy: boolean;
  onLoadSvg: (file: File) => void;
  onClear: () => void;
  onGenerate: (params: SvgToolpathParams) => void;
}

export function SvgJobPanel({
  draft,
  busy,
  onLoadSvg,
  onClear,
  onGenerate,
}: SvgJobPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mode, setMode] = useState<SvgCutMode>(DEFAULT_SVG_TOOLPATH.mode);
  const [feedMmMin, setFeedMmMin] = useState(
    String(DEFAULT_SVG_TOOLPATH.feedMmMin),
  );
  const [plungeMmMin, setPlungeMmMin] = useState(
    String(DEFAULT_SVG_TOOLPATH.plungeMmMin),
  );
  const [depthMm, setDepthMm] = useState(String(DEFAULT_SVG_TOOLPATH.depthMm));
  const [safeZMm, setSafeZMm] = useState(String(DEFAULT_SVG_TOOLPATH.safeZMm));
  const [toolDiameterMm, setToolDiameterMm] = useState(
    String(DEFAULT_SVG_TOOLPATH.toolDiameterMm),
  );

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    if (!isSvgFileName(file.name)) {
      setLoadError("Use a .svg file.");
      return;
    }
    setLoadError(null);
    onLoadSvg(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
    acceptFile(event.dataTransfer.files?.[0]);
  };

  const parsePositive = (raw: string, label: string): number | null => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      setLoadError(`${label} must be a positive number.`);
      return null;
    }
    return n;
  };

  const parseNonNeg = (raw: string, label: string): number | null => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      setLoadError(`${label} must be ≥ 0.`);
      return null;
    }
    return n;
  };

  const handleGenerate = () => {
    if (!draft || busy) return;
    const feed = parsePositive(feedMmMin, "Feed");
    const plunge = parsePositive(plungeMmMin, "Plunge");
    const depth = parsePositive(depthMm, "Depth");
    const safeZ = parseNonNeg(safeZMm, "Safe Z");
    const tool = parsePositive(toolDiameterMm, "Bit diameter");
    if (
      feed === null ||
      plunge === null ||
      depth === null ||
      safeZ === null ||
      tool === null
    ) {
      return;
    }
    setLoadError(null);
    onGenerate({
      mode,
      feedMmMin: feed,
      plungeMmMin: plunge,
      depthMm: depth,
      safeZMm: safeZ,
      toolDiameterMm: tool,
    });
  };

  const boundsText = draft?.bounds
    ? `${draft.bounds.maxX.toFixed(1)}×${draft.bounds.maxY.toFixed(1)} mm`
    : null;
  const pathCount = draft?.polylines.length ?? 0;

  return (
    <section
      className={`svgjob${dragOver ? " is-dragover" : ""}`}
      aria-label="SVG to G-code"
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="svgjob__meta">
        <h2 className="svgjob__title">SVG</h2>
        <p className="svgjob__name">{draft?.name ?? "No SVG loaded"}</p>
        <p className="svgjob__hint">
          {draft
            ? `${pathCount} path${pathCount === 1 ? "" : "s"}${boundsText ? ` · ${boundsText}` : ""} · simple 2D (not full CAM)`
            : "Drop or pick .svg → preview → generate G-code"}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="svgjob__file"
        onChange={(e) => {
          acceptFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {draft && (
        <div className="svgjob__params">
          <label className="svgjob__field">
            <span className="svgjob__field-label">Mode</span>
            <select
              className="svgjob__select"
              value={mode}
              disabled={busy}
              onChange={(e) => setMode(e.target.value as SvgCutMode)}
            >
              <option value="engrave">Engrave (follow path)</option>
              <option value="outline">Outline (closed contour)</option>
            </select>
          </label>

          <div className="svgjob__row">
            <label className="svgjob__field">
              <span className="svgjob__field-label">Feed mm/min</span>
              <input
                className="svgjob__input"
                type="number"
                min={1}
                step={10}
                value={feedMmMin}
                disabled={busy}
                onChange={(e) => setFeedMmMin(e.target.value)}
              />
            </label>
            <label className="svgjob__field">
              <span className="svgjob__field-label">Plunge mm/min</span>
              <input
                className="svgjob__input"
                type="number"
                min={1}
                step={10}
                value={plungeMmMin}
                disabled={busy}
                onChange={(e) => setPlungeMmMin(e.target.value)}
              />
            </label>
          </div>

          <div className="svgjob__row">
            <label className="svgjob__field">
              <span className="svgjob__field-label">Depth mm</span>
              <input
                className="svgjob__input"
                type="number"
                min={0.01}
                step={0.1}
                value={depthMm}
                disabled={busy}
                onChange={(e) => setDepthMm(e.target.value)}
              />
            </label>
            <label className="svgjob__field">
              <span className="svgjob__field-label">Safe Z mm</span>
              <input
                className="svgjob__input"
                type="number"
                min={0}
                step={0.5}
                value={safeZMm}
                disabled={busy}
                onChange={(e) => setSafeZMm(e.target.value)}
              />
            </label>
          </div>

          <label className="svgjob__field">
            <span className="svgjob__field-label">Bit Ø mm</span>
            <input
              className="svgjob__input"
              type="number"
              min={0.1}
              step={0.1}
              value={toolDiameterMm}
              disabled={busy}
              onChange={(e) => setToolDiameterMm(e.target.value)}
            />
          </label>
        </div>
      )}

      {draft?.warnings && draft.warnings.length > 0 && (
        <p className="svgjob__warn-text">{draft.warnings.join(" · ")}</p>
      )}
      {loadError && <p className="svgjob__error">{loadError}</p>}

      <div className="svgjob__actions">
        <button
          type="button"
          className="svgjob__btn svgjob__btn--ghost"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {draft ? "Replace SVG" : "Load SVG"}
        </button>
        {draft && (
          <button
            type="button"
            className="svgjob__btn svgjob__btn--ghost"
            disabled={busy}
            onClick={onClear}
          >
            Clear
          </button>
        )}
        <button
          type="button"
          className="svgjob__btn"
          disabled={!draft || busy || pathCount === 0}
          onClick={handleGenerate}
        >
          Generate → Job
        </button>
      </div>
    </section>
  );
}
