import { useState } from "react";
import {
  CUT_STYLE_LABELS,
  MATERIAL_PRESETS,
  TOOL_BIT_LABELS,
  applyStockSizeKeepingOrigin,
  deleteCustomFeedsPreset,
  loadCustomFeedsPresets,
  stockOffsetForCorner,
  stockOffsetForWorkOriginCorner,
  suggestFeedsSpeeds,
  upsertCustomFeedsPreset,
  type CustomFeedsPreset,
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
  /** True when serial is ready to G10 work zero. */
  zeroEnabled?: boolean;
  onStockChange: (next: StockConfig) => void;
  onToolChange: (next: ToolConfig) => void;
  onPlaceCorner: (corner: StockCorner) => void;
  /** Primary: G10 XY zero + stock corner at toolhead. */
  onSetCornerFromToolhead?: (corner: StockCorner) => void;
  /** Optional: open stock perimeter boundary check. */
  onOpenStockPerimeter?: () => void;
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

/** Map layout: north on top (NW/NE), south on bottom (SW/SE). */
const CORNERS: { id: StockCorner; label: string; title: string }[] = [
  { id: "nw", label: "NW", title: "Back-left" },
  { id: "ne", label: "NE", title: "Back-right" },
  { id: "sw", label: "SW", title: "Front-left (min X/Y)" },
  { id: "se", label: "SE", title: "Front-right" },
];

export function MaterialToolPanel({
  stock,
  tool,
  bedMm,
  feeds,
  zeroEnabled = false,
  onStockChange,
  onToolChange,
  onPlaceCorner,
  onSetCornerFromToolhead,
  onOpenStockPerimeter,
  onFeedsChange,
  onApplyToSvg,
}: MaterialToolPanelProps) {
  const [customPresets, setCustomPresets] = useState<CustomFeedsPreset[]>(() =>
    loadCustomFeedsPresets(),
  );
  const [presetName, setPresetName] = useState("");
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [toolheadCorner, setToolheadCorner] = useState<StockCorner>(
    stock.originCorner ?? "sw",
  );

  const patchStockSize = (
    size: Partial<Pick<StockConfig, "widthMm" | "lengthMm" | "thicknessMm">>,
  ) => {
    if (stock.originCorner) {
      onStockChange(applyStockSizeKeepingOrigin(stock, size));
      return;
    }
    onStockChange({ ...stock, ...size });
  };

  const patchTool = (partial: Partial<ToolConfig>) => {
    onToolChange({ ...tool, ...partial });
  };

  const activeBedCorner = (CORNERS.find(({ id }) => {
    const expected = stockOffsetForCorner(stock, id, bedMm.width, bedMm.depth);
    return (
      Math.abs(expected.offsetXMm - stock.offsetXMm) < 1e-6 &&
      Math.abs(expected.offsetYMm - stock.offsetYMm) < 1e-6
    );
  })?.id ?? null);

  const activeOriginCorner =
    stock.originCorner ??
    CORNERS.find(({ id }) => {
      const expected = stockOffsetForWorkOriginCorner(stock, id);
      return (
        Math.abs(expected.offsetXMm - stock.offsetXMm) < 1e-6 &&
        Math.abs(expected.offsetYMm - stock.offsetYMm) < 1e-6
      );
    })?.id ??
    null;

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
          Primary: jog tip to a stock corner → set XY zero + stock origin →
          enter W / L / T. Optional: drag the blank on the visualizer to
          fine-tune. Bit Ø · F/S presets · bed {bedMm.width}×{bedMm.depth} mm
        </p>
      </div>

      <div className="mattool__block">
        <p className="mattool__section">Stock</p>
        <div className="mattool__anchor">
          <p className="mattool__field-label">
            Set XY zero + stock corner from toolhead
          </p>
          <p className="mattool__micro">
            Clamp stock, jog the tip to a corner (usually SW), pick that
            corner, then set. Work XY and stock origin move together — then
            type width / length / thickness.
          </p>
          <div
            className="mattool__corners"
            role="group"
            aria-label="Toolhead stock corner"
          >
            {CORNERS.map(({ id, label, title }) => (
              <button
                key={id}
                type="button"
                className={`mattool__corner${toolheadCorner === id ? " is-active" : ""}${activeOriginCorner === id ? " is-origin" : ""}`}
                title={title}
                aria-pressed={toolheadCorner === id}
                onClick={() => setToolheadCorner(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="mattool__primary-action"
            disabled={!zeroEnabled || !onSetCornerFromToolhead}
            title="G10 L20 X0 Y0 and place this stock corner at work origin"
            onClick={() => onSetCornerFromToolhead?.(toolheadCorner)}
          >
            Set XY zero + stock {toolheadCorner.toUpperCase()} at tip
          </button>
          {onOpenStockPerimeter ? (
            <button
              type="button"
              className="mattool__secondary-action"
              disabled={!zeroEnabled}
              title="Safe Z retract, then cancelable XY jogs around the stock blank"
              onClick={onOpenStockPerimeter}
            >
              Trace stock perimeter…
            </button>
          ) : null}
          {activeOriginCorner ? (
            <p className="mattool__micro mattool__micro--ok">
              Anchored at work origin: {activeOriginCorner.toUpperCase()} —
              size fields grow away from that corner.
            </p>
          ) : null}
        </div>
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
                patchStockSize({
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
                patchStockSize({
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
                patchStockSize({
                  thicknessMm: parsePositive(e.target.value, stock.thicknessMm),
                })
              }
            />
          </label>
          <div className="mattool__field mattool__field--corners">
            <span className="mattool__field-label">Bed frame (optional)</span>
            <div
              className="mattool__corners"
              role="group"
              aria-label="Place stock against bed corner"
            >
              {CORNERS.map(({ id, label, title }) => (
                <button
                  key={id}
                  type="button"
                  className={`mattool__corner${activeBedCorner === id ? " is-active" : ""}`}
                  title={`${title} — frames stock on soft-travel bed (does not set work zero)`}
                  aria-pressed={activeBedCorner === id}
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
              onChange={(e) => {
                const { originCorner: _drop, ...rest } = stock;
                void _drop;
                onStockChange({
                  ...rest,
                  offsetXMm: parseFinite(e.target.value, stock.offsetXMm),
                });
              }}
            />
          </label>
          <label className="mattool__field">
            <span className="mattool__field-label">Offset Y mm</span>
            <input
              className="mattool__input"
              type="number"
              step={1}
              value={stock.offsetYMm}
              onChange={(e) => {
                const { originCorner: _drop, ...rest } = stock;
                void _drop;
                onStockChange({
                  ...rest,
                  offsetYMm: parseFinite(e.target.value, stock.offsetYMm),
                });
              }}
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

        <div className="mattool__presets" aria-label="Saved material presets">
          <p className="mattool__section">Saved presets</p>
          <p className="mattool__hint mattool__hint--inline">
            Last F/S values already persist. Save a named preset for a favorite
            material setup.
          </p>
          <div className="mattool__row">
            <label className="mattool__field">
              <span className="mattool__field-label">Preset name</span>
              <input
                className="mattool__input"
                type="text"
                maxLength={48}
                value={presetName}
                placeholder="e.g. Softwood sign"
                onChange={(e) => setPresetName(e.target.value)}
              />
            </label>
            <div className="mattool__field mattool__field--actions">
              <span className="mattool__field-label">&nbsp;</span>
              <button
                type="button"
                className="mattool__btn"
                disabled={!presetName.trim()}
                onClick={() => {
                  const next = upsertCustomFeedsPreset(presetName, feeds);
                  setCustomPresets(next);
                  setPresetMessage(`Saved “${presetName.trim()}”`);
                  setPresetName("");
                }}
              >
                Save preset
              </button>
            </div>
          </div>
          {customPresets.length > 0 ? (
            <ul className="mattool__preset-list">
              {customPresets.map((preset) => (
                <li key={preset.id} className="mattool__preset-item">
                  <button
                    type="button"
                    className="mattool__preset-load"
                    onClick={() => {
                      onFeedsChange({ ...preset.selection });
                      setPresetMessage(`Loaded “${preset.name}”`);
                    }}
                  >
                    <strong>{preset.name}</strong>
                    <span>
                      {preset.selection.material} · F{preset.selection.feedMmMin} ·
                      S{preset.selection.spindleRpm}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mattool__preset-delete"
                    aria-label={`Delete preset ${preset.name}`}
                    onClick={() => {
                      setCustomPresets(deleteCustomFeedsPreset(preset.id));
                      setPresetMessage(`Deleted “${preset.name}”`);
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mattool__hint mattool__hint--inline">No saved presets yet.</p>
          )}
          {presetMessage ? (
            <p className="mattool__hint mattool__hint--inline" role="status">
              {presetMessage}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
