import {
  CUT_STYLE_LABELS,
  MATERIAL_PRESETS,
  TOOL_BIT_LABELS,
  stockOffsetForCorner,
  suggestFeedsSpeeds,
  type CutStyle,
  type FeedsSpeedsSelection,
  type MaterialKind,
  type StockConfig,
  type StockCorner,
  type ToolBitType,
  type ToolConfig,
} from "../grbl";

interface MaterialToolPanelProps {
  stock: StockConfig;
  tool: ToolConfig;
  bedMm: { width: number; depth: number };
  feeds: FeedsSpeedsSelection;
  onStockChange: (next: StockConfig) => void;
  onToolChange: (next: ToolConfig) => void;
  onPlaceCorner: (corner: StockCorner) => void;
  onFeedsChange: (next: FeedsSpeedsSelection) => void;
  /** Apply current suggestion into SVG generate fields (Job tab). */
  onApplyToSvg?: () => void;
}

function parsePositive(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseFinite(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

const CORNERS: { id: StockCorner; label: string; title: string }[] = [
  { id: "sw", label: "SW", title: "Front-left (min X/Y)" },
  { id: "se", label: "SE", title: "Front-right" },
  { id: "nw", label: "NW", title: "Back-left" },
  { id: "ne", label: "NE", title: "Back-right" },
];

export function MaterialToolPanel({
  stock,
  tool,
  bedMm,
  feeds,
  onStockChange,
  onToolChange,
  onPlaceCorner,
  onFeedsChange,
  onApplyToSvg,
}: MaterialToolPanelProps) {
  const patchStock = (partial: Partial<StockConfig>) => {
    onStockChange({ ...stock, ...partial });
  };

  const patchTool = (partial: Partial<ToolConfig>) => {
    onToolChange({ ...tool, ...partial });
  };

  const activeCorner = (CORNERS.find(({ id }) => {
    const expected = stockOffsetForCorner(stock, id, bedMm.width, bedMm.depth);
    return (
      Math.abs(expected.offsetXMm - stock.offsetXMm) < 1e-6 &&
      Math.abs(expected.offsetYMm - stock.offsetYMm) < 1e-6
    );
  })?.id ?? null);

  const suggestion = suggestFeedsSpeeds({
    material: feeds.material,
    cutStyle: feeds.cutStyle,
    diameterMm: tool.diameterMm,
    bitType: tool.type,
  });

  const applySuggestion = () => {
    onFeedsChange({
      material: suggestion.material,
      cutStyle: suggestion.cutStyle,
      feedMmMin: suggestion.feedMmMin,
      plungeMmMin: suggestion.plungeMmMin,
      spindleRpm: suggestion.spindleRpm,
      depthMm: suggestion.depthMm,
    });
  };

  const setMaterial = (material: MaterialKind) => {
    const next = suggestFeedsSpeeds({
      material,
      cutStyle: feeds.cutStyle,
      diameterMm: tool.diameterMm,
      bitType: tool.type,
    });
    onFeedsChange({
      material: next.material,
      cutStyle: next.cutStyle,
      feedMmMin: next.feedMmMin,
      plungeMmMin: next.plungeMmMin,
      spindleRpm: next.spindleRpm,
      depthMm: next.depthMm,
    });
  };

  const setCutStyle = (cutStyle: CutStyle) => {
    const next = suggestFeedsSpeeds({
      material: feeds.material,
      cutStyle,
      diameterMm: tool.diameterMm,
      bitType: tool.type,
    });
    onFeedsChange({
      material: next.material,
      cutStyle: next.cutStyle,
      feedMmMin: next.feedMmMin,
      plungeMmMin: next.plungeMmMin,
      spindleRpm: next.spindleRpm,
      depthMm: next.depthMm,
    });
  };

  return (
    <section className="mattool" aria-label="Material and tool">
      <div className="mattool__meta">
        <h2 className="mattool__title">Material &amp; tool</h2>
        <p className="mattool__hint">
          Stock on the bed · bit Ø · material presets for suggested F/S · bed{" "}
          {bedMm.width}×{bedMm.depth} mm
        </p>
      </div>

      <div className="mattool__block">
        <p className="mattool__section">Stock</p>
        <div className="mattool__row">
          <label className="mattool__field">
            <span className="mattool__field-label">Width X mm</span>
            <input
              className="mattool__input"
              type="number"
              min={0.1}
              step={1}
              value={stock.widthMm}
              onChange={(e) =>
                patchStock({
                  widthMm: parsePositive(e.target.value, stock.widthMm),
                })
              }
            />
          </label>
          <label className="mattool__field">
            <span className="mattool__field-label">Length Y mm</span>
            <input
              className="mattool__input"
              type="number"
              min={0.1}
              step={1}
              value={stock.lengthMm}
              onChange={(e) =>
                patchStock({
                  lengthMm: parsePositive(e.target.value, stock.lengthMm),
                })
              }
            />
          </label>
        </div>
        <div className="mattool__row">
          <label className="mattool__field">
            <span className="mattool__field-label">Thickness mm</span>
            <input
              className="mattool__input"
              type="number"
              min={0.1}
              step={0.5}
              value={stock.thicknessMm}
              onChange={(e) =>
                patchStock({
                  thicknessMm: parsePositive(e.target.value, stock.thicknessMm),
                })
              }
            />
          </label>
          <div className="mattool__field mattool__field--corners">
            <span className="mattool__field-label">Corner on bed</span>
            <div className="mattool__corners" role="group" aria-label="Place stock corner">
              {CORNERS.map(({ id, label, title }) => (
                <button
                  key={id}
                  type="button"
                  className={`mattool__corner${activeCorner === id ? " is-active" : ""}`}
                  title={title}
                  aria-pressed={activeCorner === id}
                  onClick={() => onPlaceCorner(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mattool__row">
          <label className="mattool__field">
            <span className="mattool__field-label">Offset X mm</span>
            <input
              className="mattool__input"
              type="number"
              step={1}
              value={stock.offsetXMm}
              onChange={(e) =>
                patchStock({
                  offsetXMm: parseFinite(e.target.value, stock.offsetXMm),
                })
              }
            />
          </label>
          <label className="mattool__field">
            <span className="mattool__field-label">Offset Y mm</span>
            <input
              className="mattool__input"
              type="number"
              step={1}
              value={stock.offsetYMm}
              onChange={(e) =>
                patchStock({
                  offsetYMm: parseFinite(e.target.value, stock.offsetYMm),
                })
              }
            />
          </label>
        </div>
      </div>

      <div className="mattool__block">
        <p className="mattool__section">Bit</p>
        <div className="mattool__row">
          <label className="mattool__field">
            <span className="mattool__field-label">Type</span>
            <select
              className="mattool__select"
              value={tool.type}
              onChange={(e) =>
                patchTool({ type: e.target.value as ToolBitType })
              }
            >
              {(Object.keys(TOOL_BIT_LABELS) as ToolBitType[]).map((id) => (
                <option key={id} value={id}>
                  {TOOL_BIT_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          <label className="mattool__field">
            <span className="mattool__field-label">Diameter Ø mm</span>
            <input
              className="mattool__input"
              type="number"
              min={0.1}
              step={0.1}
              value={tool.diameterMm}
              onChange={(e) =>
                patchTool({
                  diameterMm: parsePositive(e.target.value, tool.diameterMm),
                })
              }
            />
          </label>
        </div>
        {tool.type === "vbit" && (
          <label className="mattool__field">
            <span className="mattool__field-label">Tip angle °</span>
            <input
              className="mattool__input"
              type="number"
              min={1}
              max={179}
              step={1}
              value={tool.tipAngleDeg}
              onChange={(e) =>
                patchTool({
                  tipAngleDeg: parsePositive(e.target.value, tool.tipAngleDeg),
                })
              }
            />
          </label>
        )}
      </div>

      <div className="mattool__block">
        <p className="mattool__section">Feeds &amp; speeds</p>
        <p className="mattool__hint mattool__hint--inline">
          Quick setup: material + cut style → suggested F / S for current bit Ø
          (persisted). Starting points only — verify on scrap.
        </p>
        <div className="mattool__row">
          <label className="mattool__field">
            <span className="mattool__field-label">Material</span>
            <select
              className="mattool__select"
              value={feeds.material}
              onChange={(e) => setMaterial(e.target.value as MaterialKind)}
            >
              {MATERIAL_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="mattool__field">
            <span className="mattool__field-label">Cut style</span>
            <select
              className="mattool__select"
              value={feeds.cutStyle}
              onChange={(e) => setCutStyle(e.target.value as CutStyle)}
            >
              {(Object.keys(CUT_STYLE_LABELS) as CutStyle[]).map((id) => (
                <option key={id} value={id}>
                  {CUT_STYLE_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mattool__suggest" aria-live="polite">
          <p className="mattool__suggest-line">
            Suggested · F {suggestion.feedMmMin} · plunge {suggestion.plungeMmMin}{" "}
            · S {suggestion.spindleRpm} · depth {suggestion.depthMm}
          </p>
          <p className="mattool__hint mattool__hint--inline">{suggestion.note}</p>
        </div>

        <div className="mattool__row">
          <label className="mattool__field">
            <span className="mattool__field-label">Feed mm/min</span>
            <input
              className="mattool__input"
              type="number"
              min={1}
              step={10}
              value={feeds.feedMmMin}
              onChange={(e) =>
                onFeedsChange({
                  ...feeds,
                  feedMmMin: parsePositive(e.target.value, feeds.feedMmMin),
                })
              }
            />
          </label>
          <label className="mattool__field">
            <span className="mattool__field-label">Plunge mm/min</span>
            <input
              className="mattool__input"
              type="number"
              min={1}
              step={10}
              value={feeds.plungeMmMin}
              onChange={(e) =>
                onFeedsChange({
                  ...feeds,
                  plungeMmMin: parsePositive(e.target.value, feeds.plungeMmMin),
                })
              }
            />
          </label>
        </div>
        <div className="mattool__row">
          <label className="mattool__field">
            <span className="mattool__field-label">Spindle RPM</span>
            <input
              className="mattool__input"
              type="number"
              min={0}
              step={100}
              value={feeds.spindleRpm}
              onChange={(e) =>
                onFeedsChange({
                  ...feeds,
                  spindleRpm: parsePositive(e.target.value, feeds.spindleRpm),
                })
              }
            />
          </label>
          <label className="mattool__field">
            <span className="mattool__field-label">Depth mm</span>
            <input
              className="mattool__input"
              type="number"
              min={0.01}
              step={0.1}
              value={feeds.depthMm}
              onChange={(e) =>
                onFeedsChange({
                  ...feeds,
                  depthMm: parsePositive(e.target.value, feeds.depthMm),
                })
              }
            />
          </label>
        </div>

        <div className="mattool__actions">
          <button
            type="button"
            className="mattool__btn mattool__btn--ghost"
            onClick={applySuggestion}
          >
            Recalc from preset
          </button>
          {onApplyToSvg && (
            <button
              type="button"
              className="mattool__btn"
              onClick={onApplyToSvg}
            >
              Apply to SVG
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
