import { useEffect, useMemo, useState } from "react";
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
  message?: string | null;
  onStepChange: (step: FirstRunStepId) => void;
  onRefreshPorts: () => void;
  onConnect: () => void;
  onHome: () => void;
  onOpenCalibration: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

function emptyConfirms(): Record<FirstRunStepId, boolean> {
  return {
    connect: false,
    home: false,
    calibrate: false,
  };
}

export function FirstRunWizard({
  step,
  connected,
  homed,
  homeBusy,
  homeBlockedReason,
  homeMessage,
  message,
  onStepChange,
  onRefreshPorts,
  onConnect,
  onHome,
  onOpenCalibration,
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
      : confirmed[step];

  const furthestUnlocked = useMemo(() => {
    let unlocked = 0;
    for (let i = 0; i < STEPS.length; i++) {
      const id = STEPS[i]!.id;
      const ok =
        id === "connect"
          ? connected
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
            Connect → home → calibrate (direction, steps/mm, soft travel).
            Once per machine. Every job after that starts in Prepare.
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
              <strong>Linked</strong> in the header connection chip. Or pick{" "}
              <strong>Virtual CNC</strong> in that same port list to practice
              without USB.
            </p>
            <div className="firstrun__actions">
              <button
                type="button"
                className="firstrun__btn firstrun__btn--ghost"
                onClick={onRefreshPorts}
              >
                Refresh ports
              </button>
              {/* After link, only the header chip keeps Connect/Disconnect (O4). */}
              {!connected ? (
                <button
                  type="button"
                  className="firstrun__btn"
                  onClick={onConnect}
                >
                  Connect
                </button>
              ) : null}
            </div>
            <p className="firstrun__status" role="status">
              {connected
                ? "Linked in the header — Next unlocked."
                : "Not linked yet — use Connect here or in the header chip."}
            </p>
          </div>
        )}

        {step === "home" && (
          <div className="firstrun__panel">
            <h3>2 · Home</h3>
            <p>
              Homing (<code>$H</code>) uses the <strong>zero-side</strong> limit
              switches only — not the touch plate (that is for Z zero in
              Prepare). Clear the bed, keep a hand near E-Stop, then Home. If
              homing isn&rsquo;t set up yet (<code>$22=0</code>), tick the box
              below to continue; set it up later in Calibrate.
            </p>
            <div className="firstrun__actions">
              <button
                type="button"
                className="firstrun__btn"
                disabled={!connected || homeBusy || !!homeBlockedReason}
                onClick={onHome}
              >
                {homeBusy
                  ? "Homing…"
                  : homed
                    ? "Home again ($H)"
                    : "Home ($H)"}
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
              label={
                homed
                  ? "Bed was clear · homing finished — I completed this step"
                  : "Homing isn't set up on this machine yet — continue without homing"
              }
              onChange={(v) => setHumanConfirm("home", v)}
            />
          </div>
        )}

        {step === "calibrate" && (
          <div className="firstrun__panel">
            <h3>3 · Calibrate</h3>
            <p>
              Open the Calibration wizard and work through it: axis direction,
              steps/mm, and soft travel. Come back here and click Finish when
              it&rsquo;s done.
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
              label="Finished the Calibration wizard (or the machine was already calibrated)"
              onChange={(v) => setHumanConfirm("calibrate", v)}
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
        {index < STEPS.length - 1 ? (
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
            disabled={!confirmed.calibrate}
            onClick={onComplete}
            title={
              confirmed.calibrate
                ? undefined
                : "Confirm calibration before finishing setup"
            }
          >
            Finish setup
          </button>
        )}
      </footer>
    </section>
  );
}
