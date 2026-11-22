import { useEffect, useMemo, useState } from "react";
import type { SoftTravelLimits, StockConfig } from "../grbl";
import {
  FIRST_RUN_STEPS,
  type FirstRunStepId,
} from "../grbl/firstRunConfig";
import { WizardStepConfirm } from "./wizardStepGate";

export type { FirstRunStepId };

const STEPS = FIRST_RUN_STEPS;

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

function emptyConfirms(): Record<FirstRunStepId, boolean> {
  return {
    connect: false,
    home: false,
    calibrate: false,
    travel: false,
    stock: false,
  };
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
  const [confirmed, setConfirmed] = useState(emptyConfirms);

  /** Linked is system-verifiable — auto-confirm connect only. */
  useEffect(() => {
    setConfirmed((prev) => {
      if (connected) {
        if (prev.connect) return prev;
        return { ...prev, connect: true };
      }
      // Disconnect clears the whole gate chain (session-only).
      return emptyConfirms();
    });
  }, [connected]);

  const setHumanConfirm = (id: FirstRunStepId, value: boolean) => {
    setConfirmed((prev) => {
      const next = { ...prev, [id]: value };
      if (!value) {
        const start = STEPS.findIndex((s) => s.id === id);
        for (let i = start + 1; i < STEPS.length; i++) {
          next[STEPS[i]!.id] = false;
        }
      }
      return next;
    });
  };

  const stepReady =
    step === "connect"
      ? connected
      : step === "home"
        ? homed && confirmed.home
        : confirmed[step];

  const furthestUnlocked = useMemo(() => {
    let unlocked = 0;
    for (let i = 0; i < STEPS.length; i++) {
      const id = STEPS[i]!.id;
      const ok =
        id === "connect"
          ? connected
          : id === "home"
            ? homed && confirmed.home
            : confirmed[id];
      if (!ok) break;
      unlocked = i + 1;
    }
    return Math.min(unlocked, STEPS.length - 1);
  }, [connected, homed, confirmed]);

  const goNext = () => {
    if (!stepReady || index < 0 || index >= STEPS.length - 1) return;
    onStepChange(STEPS[index + 1]!.id);
  };

  const goBack = () => {
    if (index <= 0) return;
    onStepChange(STEPS[index - 1]!.id);
  };

  const goTo = (target: number) => {
    if (target < 0 || target >= STEPS.length) return;
    if (target > furthestUnlocked) return;
    onStepChange(STEPS[target]!.id);
  };

  return (
    <section className="firstrun" aria-label="First-run setup wizard">
      <header className="firstrun__head">
        <div>
          <p className="firstrun__eyebrow">SharpCNC · First run</p>
          <h2 className="firstrun__title">Calibrate this machine</h2>
          <p className="firstrun__lead">
            Connect → home → calibrate → soft travel (once). Stock at the end
            only seeds the first job — use Prepare every cut after.
          </p>
        </div>
        <button type="button" className="firstrun__skip" onClick={onSkip}>
          Skip for now
        </button>
      </header>

      <nav className="firstrun__steps" aria-label="Setup steps">
        {STEPS.map((s, i) => {
          const locked = i > furthestUnlocked;
          return (
            <button
              key={s.id}
              type="button"
              className={`firstrun__step${s.id === step ? " is-active" : ""}${
                i < index ? " is-done" : ""
              }${locked ? " is-locked" : ""}`}
              aria-current={s.id === step ? "step" : undefined}
              aria-disabled={locked || undefined}
              disabled={locked}
              onClick={() => goTo(i)}
            >
              {s.short}
            </button>
          );
        })}
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
              <button
                type="button"
                className="firstrun__btn firstrun__btn--ghost"
                onClick={onRefreshPorts}
              >
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
              {connected
                ? "Linked — Next unlocked."
                : "Not linked yet — Next stays locked."}
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
            <WizardStepConfirm
              className="firstrun__check"
              id="firstrun-confirm-home"
              checked={confirmed.home}
              disabled={!homed}
              label="Bed was clear · homing finished — I completed this step"
              onChange={(v) => setHumanConfirm("home", v)}
            />
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
              <button
                type="button"
                className="firstrun__btn"
                onClick={onOpenCalibration}
              >
                Open Calibration…
              </button>
            </div>
            <WizardStepConfirm
              className="firstrun__check"
              id="firstrun-confirm-calibrate"
              checked={confirmed.calibrate}
              label="I reviewed calibration (or already tuned) — step complete"
              onChange={(v) => setHumanConfirm("calibrate", v)}
            />
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
                  onChange={(e) => {
                    setHumanConfirm("travel", false);
                    onSoftTravelChange({
                      ...softTravel,
                      maxX: parsePositive(
                        e.target.value,
                        softTravel.maxX ?? 1000,
                      ),
                    });
                  }}
                />
              </label>
              <label>
                <span>Y max mm</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={softTravel.maxY ?? ""}
                  onChange={(e) => {
                    setHumanConfirm("travel", false);
                    onSoftTravelChange({
                      ...softTravel,
                      maxY: parsePositive(
                        e.target.value,
                        softTravel.maxY ?? 1000,
                      ),
                    });
                  }}
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
                    setHumanConfirm("travel", false);
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
              <button
                type="button"
                className="firstrun__btn"
                onClick={onApplySoftTravel}
              >
                Save travel (local + GRBL if linked)
              </button>
            </div>
            <WizardStepConfirm
              className="firstrun__check"
              id="firstrun-confirm-travel"
              checked={confirmed.travel}
              label="Measured and set soft travel — I completed this step"
              onChange={(v) => setHumanConfirm("travel", v)}
            />
          </div>
        )}

        {step === "stock" && (
          <div className="firstrun__panel">
            <h3>5 · Stock seed</h3>
            <p>
              Optional starter size for the first job only. Every later cut uses
              Prepare (stock, zeros, Z probe) — not this wizard.
            </p>
            <div className="firstrun__grid">
              <label>
                <span>Width X mm</span>
                <input
                  type="number"
                  min={0.1}
                  step={1}
                  value={stock.widthMm}
                  onChange={(e) => {
                    setHumanConfirm("stock", false);
                    onStockChange({
                      ...stock,
                      widthMm: parsePositive(e.target.value, stock.widthMm),
                    });
                  }}
                />
              </label>
              <label>
                <span>Length Y mm</span>
                <input
                  type="number"
                  min={0.1}
                  step={1}
                  value={stock.lengthMm}
                  onChange={(e) => {
                    setHumanConfirm("stock", false);
                    onStockChange({
                      ...stock,
                      lengthMm: parsePositive(e.target.value, stock.lengthMm),
                    });
                  }}
                />
              </label>
              <label>
                <span>Thickness mm</span>
                <input
                  type="number"
                  min={0.1}
                  step={0.5}
                  value={stock.thicknessMm}
                  onChange={(e) => {
                    setHumanConfirm("stock", false);
                    onStockChange({
                      ...stock,
                      thicknessMm: parsePositive(
                        e.target.value,
                        stock.thicknessMm,
                      ),
                    });
                  }}
                />
              </label>
            </div>
            <WizardStepConfirm
              className="firstrun__check"
              id="firstrun-confirm-stock"
              checked={confirmed.stock}
              label="Stock size matches the workpiece — I completed this step"
              onChange={(v) => setHumanConfirm("stock", v)}
            />
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
            disabled={!stepReady}
            onClick={goNext}
            title={
              stepReady
                ? undefined
                : "Confirm this step before continuing"
            }
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            className="firstrun__btn"
            disabled={!confirmed.stock}
            onClick={onComplete}
            title={
              confirmed.stock
                ? undefined
                : "Confirm stock before finishing setup"
            }
          >
            Finish calibration
          </button>
        )}
      </footer>
    </section>
  );
}
