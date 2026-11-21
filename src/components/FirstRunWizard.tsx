import type { SoftTravelLimits, StockConfig } from "../grbl";

export type FirstRunStepId =
  | "connect"
  | "home"
  | "calibrate"
  | "travel"
  | "stock";

const STEPS: { id: FirstRunStepId; label: string; short: string }[] = [
  { id: "connect", label: "Connect", short: "1 · Connect" },
  { id: "home", label: "Home", short: "2 · Home" },
  { id: "calibrate", label: "Calibrate", short: "3 · Calibrate" },
  { id: "travel", label: "Travel", short: "4 · Travel" },
  { id: "stock", label: "Stock", short: "5 · Stock" },
];

interface FirstRunWizardProps {
  step: FirstRunStepId;
  connected: boolean;
  homed: boolean;
  homeBusy: boolean;
  homeBlockedReason: string | null;
  homeMessage: string | null;
  softTravel: SoftTravelLimits;
  stock: StockConfig;
  message?: string | null;
  onStepChange: (step: FirstRunStepId) => void;
  onRefreshPorts: () => void;
  onConnect: () => void;
  onHome: () => void;
  onOpenCalibration: () => void;
  onSoftTravelChange: (next: SoftTravelLimits) => void;
  onApplySoftTravel: () => void;
  onStockChange: (next: StockConfig) => void;
  onComplete: () => void;
  onSkip: () => void;
}

function parsePositive(raw: string, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function FirstRunWizard({
  step,
  connected,
  homed,
  homeBusy,
  homeBlockedReason,
  homeMessage,
  softTravel,
  stock,
  message,
  onStepChange,
  onRefreshPorts,
  onConnect,
  onHome,
  onOpenCalibration,
  onSoftTravelChange,
  onApplySoftTravel,
  onStockChange,
  onComplete,
  onSkip,
}: FirstRunWizardProps) {
  const index = STEPS.findIndex((s) => s.id === step);
  const canNext =
    (step === "connect" && connected) ||
    (step === "home" && homed) ||
    step === "calibrate" ||
    step === "travel" ||
    step === "stock";

  const goNext = () => {
    if (index < 0 || index >= STEPS.length - 1) return;
    onStepChange(STEPS[index + 1].id);
  };

  const goBack = () => {
    if (index <= 0) return;
    onStepChange(STEPS[index - 1].id);
  };

  return (
    <section className="firstrun" aria-label="First-run setup wizard">
      <header className="firstrun__head">
        <div>
          <p className="firstrun__eyebrow">SharpCNC · First run</p>
          <h2 className="firstrun__title">Set up this machine</h2>
          <p className="firstrun__lead">
            Connect → home → calibrate → soft travel → stock. Takes a few
            minutes once.
          </p>
        </div>
        <button type="button" className="firstrun__skip" onClick={onSkip}>
          Skip for now
        </button>
      </header>

      <nav className="firstrun__steps" aria-label="Setup steps">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`firstrun__step${s.id === step ? " is-active" : ""}${
              i < index ? " is-done" : ""
            }`}
            aria-current={s.id === step ? "step" : undefined}
            onClick={() => onStepChange(s.id)}
          >
            {s.short}
          </button>
        ))}
      </nav>

      <div className="firstrun__body">
        {step === "connect" && (
          <div className="firstrun__panel">
            <h3>1 · Connect</h3>
            <p>
              Power the Demon Shield / Arduino safely, plug USB, refresh ports,
              then Connect at <strong>115200</strong> baud. Wait for{" "}
              <strong>Linked</strong> in the essentials strip.
            </p>
            <div className="firstrun__actions">
              <button type="button" className="firstrun__btn firstrun__btn--ghost" onClick={onRefreshPorts}>
                Refresh ports
              </button>
              <button
                type="button"
                className="firstrun__btn"
                disabled={connected}
                onClick={onConnect}
              >
                {connected ? "Linked" : "Connect"}
              </button>
            </div>
            <p className="firstrun__status" role="status">
              {connected ? "Connected — continue to Home." : "Not linked yet."}
            </p>
          </div>
        )}

        {step === "home" && (
          <div className="firstrun__panel">
            <h3>2 · Home</h3>
            <p>
              Homing uses the <strong>zero-side</strong> limit switches only.
              Clear the bed, then Home. Soft travel still protects the far rails.
            </p>
            <div className="firstrun__actions">
              <button
                type="button"
                className="firstrun__btn"
                disabled={!connected || homeBusy || !!homeBlockedReason}
                onClick={onHome}
              >
                {homeBusy ? "Homing…" : homed ? "Home again" : "Home ($H)"}
              </button>
            </div>
            {homeBlockedReason ? (
              <p className="firstrun__warn">{homeBlockedReason}</p>
            ) : null}
            <p className="firstrun__status" role="status">
              {homeMessage ??
                (homed ? "Homed for this session." : "Not homed yet.")}
            </p>
          </div>
        )}

        {step === "calibrate" && (
          <div className="firstrun__panel">
            <h3>3 · Calibrate</h3>
            <p>
              Open the full Calibration wizard for axis direction and steps/mm.
              Come back here when those feel right — soft travel is the next
              step.
            </p>
            <div className="firstrun__actions">
              <button type="button" className="firstrun__btn" onClick={onOpenCalibration}>
                Open Calibration…
              </button>
            </div>
            <p className="firstrun__status" role="status">
              You can continue after reviewing calibration (or skip if already
              tuned).
            </p>
          </div>
        )}

        {step === "travel" && (
          <div className="firstrun__panel">
            <h3>4 · Soft travel</h3>
            <p>
              Measure the real bed. Far-end limits are software on this machine
              (<code>$130</code>–<code>$132</code>).
            </p>
            <div className="firstrun__grid">
              <label>
                <span>X max mm</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={softTravel.maxX ?? ""}
                  onChange={(e) =>
                    onSoftTravelChange({
                      ...softTravel,
                      maxX: parsePositive(
                        e.target.value,
                        softTravel.maxX ?? 1000,
                      ),
                    })
                  }
                />
              </label>
              <label>
                <span>Y max mm</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={softTravel.maxY ?? ""}
                  onChange={(e) =>
                    onSoftTravelChange({
                      ...softTravel,
                      maxY: parsePositive(
                        e.target.value,
                        softTravel.maxY ?? 1000,
                      ),
                    })
                  }
                />
              </label>
              <label>
                <span>Z max mm</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={softTravel.maxZ ?? ""}
                  placeholder="optional"
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    onSoftTravelChange({
                      ...softTravel,
                      maxZ:
                        raw === ""
                          ? null
                          : parsePositive(raw, softTravel.maxZ ?? 100),
                    });
                  }}
                />
              </label>
            </div>
            <div className="firstrun__actions">
              <button type="button" className="firstrun__btn" onClick={onApplySoftTravel}>
                Save travel (local + GRBL if linked)
              </button>
            </div>
          </div>
        )}

        {step === "stock" && (
          <div className="firstrun__panel">
            <h3>5 · Stock</h3>
            <p>
              Enter the workpiece on the bed. You can refine corners later under
              Material &amp; tool.
            </p>
            <div className="firstrun__grid">
              <label>
                <span>Width X mm</span>
                <input
                  type="number"
                  min={0.1}
                  step={1}
                  value={stock.widthMm}
                  onChange={(e) =>
                    onStockChange({
                      ...stock,
                      widthMm: parsePositive(e.target.value, stock.widthMm),
                    })
                  }
                />
              </label>
              <label>
                <span>Length Y mm</span>
                <input
                  type="number"
                  min={0.1}
                  step={1}
                  value={stock.lengthMm}
                  onChange={(e) =>
                    onStockChange({
                      ...stock,
                      lengthMm: parsePositive(e.target.value, stock.lengthMm),
                    })
                  }
                />
              </label>
              <label>
                <span>Thickness mm</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={stock.thicknessMm}
                  onChange={(e) =>
                    onStockChange({
                      ...stock,
                      thicknessMm: parsePositive(
                        e.target.value,
                        stock.thicknessMm,
                      ),
                    })
                  }
                />
              </label>
            </div>
          </div>
        )}

        {message ? (
          <p className="firstrun__status" role="status">
            {message}
          </p>
        ) : null}
      </div>

      <footer className="firstrun__foot">
        <button
          type="button"
          className="firstrun__btn firstrun__btn--ghost"
          disabled={index <= 0}
          onClick={goBack}
        >
          Back
        </button>
        {step !== "stock" ? (
          <button
            type="button"
            className="firstrun__btn"
            disabled={!canNext}
            onClick={goNext}
          >
            Next
          </button>
        ) : (
          <button type="button" className="firstrun__btn" onClick={onComplete}>
            Finish setup
          </button>
        )}
      </footer>
    </section>
  );
}
