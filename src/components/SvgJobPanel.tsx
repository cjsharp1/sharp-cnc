import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  DEFAULT_SVG_TOOLPATH,
  SAMPLE_SVGS,
  fetchSampleSvg,
  isSvgFileName,
  type FeedsSpeedsSelection,
  type SampleSvgSpec,
  type SvgCutMode,
  type SvgImportResult,
  type SvgToolpathParams,
} from "../grbl";

interface SvgJobPanelProps {
  draft: SvgImportResult | null;
  /** True while a G-code job is streaming — block replace/generate. */
  busy: boolean;
  /** Bit diameter from Material & tool settings (mm). */
  toolDiameterMm: number;
  /** Applied feeds/speeds from material presets (Job settings). */
  feeds: FeedsSpeedsSelection;
  /** Bumps when user clicks Apply to SVG — sync fields from feeds. */
  feedsApplyToken: number;
  onLoadSvg: (file: File) => void;
  /** Load SVG markup by name (built-in samples). */
  onLoadSvgText: (name: string, text: string) => void;
  onClear: () => void;
  onGenerate: (params: SvgToolpathParams) => void;
}

export function SvgJobPanel({
  draft,
  busy,
  toolDiameterMm,
  feeds,
  feedsApplyToken,
  onLoadSvg,
  onLoadSvgText,
  onClear,
  onGenerate,
}: SvgJobPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sampleLoadingId, setSampleLoadingId] = useState<string | null>(null);

  const [mode, setMode] = useState<SvgCutMode>(DEFAULT_SVG_TOOLPATH.mode);
  const [feedMmMin, setFeedMmMin] = useState(
    String(DEFAULT_SVG_TOOLPATH.feedMmMin),
  );
  const [plungeMmMin, setPlungeMmMin] = useState(
    String(DEFAULT_SVG_TOOLPATH.plungeMmMin),
  );
  const [depthMm, setDepthMm] = useState(String(DEFAULT_SVG_TOOLPATH.depthMm));
  const [safeZMm, setSafeZMm] = useState(String(DEFAULT_SVG_TOOLPATH.safeZMm));
  const [spindleRpm, setSpindleRpm] = useState(
    String(DEFAULT_SVG_TOOLPATH.spindleRpm),
  );

  // Seed once from persisted feeds on mount.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    setFeedMmMin(String(feeds.feedMmMin));
    setPlungeMmMin(String(feeds.plungeMmMin));
    setDepthMm(String(feeds.depthMm));
    setSpindleRpm(String(feeds.spindleRpm));
    setMode(feeds.cutStyle === "cut" ? "outline" : "engrave");
  }, [feeds]);

  useEffect(() => {
    if (feedsApplyToken <= 0) return;
    setFeedMmMin(String(feeds.feedMmMin));
    setPlungeMmMin(String(feeds.plungeMmMin));
    setDepthMm(String(feeds.depthMm));
    setSpindleRpm(String(feeds.spindleRpm));
    setMode(feeds.cutStyle === "cut" ? "outline" : "engrave");
  }, [feedsApplyToken, feeds]);

  const acceptFile = (file: File | undefined) => {
    if (!file) return;
    if (!isSvgFileName(file.name)) {
      setLoadError("Use a .svg file.");
      return;
    }
    setLoadError(null);
    onLoadSvg(file);
  };

  const loadSample = async (spec: SampleSvgSpec) => {
    if (busy || sampleLoadingId) return;
    setSampleLoadingId(spec.id);
    setLoadError(null);
    try {
      const text = await fetchSampleSvg(spec);
      onLoadSvgText(spec.fileName, text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLoadError(message);
    } finally {
      setSampleLoadingId(null);
    }
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
    const spindle = parseNonNeg(spindleRpm, "Spindle RPM");
    const tool = Number.isFinite(toolDiameterMm) && toolDiameterMm > 0
      ? toolDiameterMm
      : null;
    if (tool === null) {
      setLoadError("Set a positive bit diameter in Material & tool.");
      return;
    }
    if (
      feed === null ||
      plunge === null ||
      depth === null ||
      safeZ === null ||
      spindle === null
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
      spindleRpm: spindle,
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

      <div className="svgjob__samples" aria-label="SharpCNC cut-size samples">
        <span className="svgjob__samples-label">Samples</span>
        <div className="svgjob__samples-btns">
          {SAMPLE_SVGS.map((spec) => (
            <button
              key={spec.id}
              type="button"
              className="svgjob__btn svgjob__btn--ghost svgjob__btn--sample"
              disabled={busy || sampleLoadingId !== null}
              title={spec.hint}
              onClick={() => void loadSample(spec)}
            >
              {sampleLoadingId === spec.id ? "…" : spec.label}
            </button>
          ))}
        </div>
        <p className="svgjob__samples-hint">
          Real mm units — load, place on stock, cut, measure (esp. 100×100 mm).
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

          <div className="svgjob__row">
            <label className="svgjob__field">
              <span className="svgjob__field-label">Spindle RPM</span>
              <input
                className="svgjob__input"
                type="number"
                min={0}
                step={100}
                value={spindleRpm}
                disabled={busy}
                onChange={(e) => setSpindleRpm(e.target.value)}
              />
            </label>
          </div>

          <p className="svgjob__tool-note">
            Bit Ø {toolDiameterMm} mm from Material &amp; tool. Spindle emits{" "}
            <code>M3 S…</code> / <code>M5</code> (0 = omit). Use{" "}
            <strong>Apply to SVG</strong> above to pull material presets.
          </p>
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
