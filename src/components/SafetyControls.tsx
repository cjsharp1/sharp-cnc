import type { AlarmGuide } from "../grbl";

interface SafetyControlsProps {
  connected: boolean;
  machineState: string;
  /** App-side E-Stop latch: motion stays locked until cleared. */
  estopLatched?: boolean;
  onClearEstop?: () => void;
  alarmMessage: string | null;
  alarmGuide?: AlarmGuide | null;
  usingMock?: boolean;
  onEstop: () => void;
  onHold: () => void;
  onResume: () => void;
  onReset: () => void;
  onUnlock: () => void;
  onSimulateAlarm?: () => void;
  onSimulateSoftLimit?: () => void;
  onSimulateProbeFail?: () => void;
}

export function SafetyControls({
  connected,
  machineState,
  estopLatched = false,
  onClearEstop,
  alarmMessage,
  alarmGuide = null,
  usingMock = false,
  onEstop,
  onHold,
  onResume,
  onReset,
  onUnlock,
  onSimulateAlarm,
  onSimulateSoftLimit,
  onSimulateProbeFail,
}: SafetyControlsProps) {
  const inAlarm = machineState === "Alarm";
  const inHold = machineState === "Hold";
  const canMotion = connected && !inAlarm && !estopLatched;

  return (
    <section
      className={`safety${inAlarm ? " is-alarm" : ""}`}
      aria-label="Safety controls"
    >
      <header className="safety__head">
        <h2 className="safety__title">Safety</h2>
        <span
          className={`safety__state${inAlarm ? " is-alarm" : ""}${inHold ? " is-hold" : ""}`}
        >
          {machineState}
        </span>
      </header>

      {estopLatched && (
        <div className="safety__banner" role="alert">
          <p className="safety__banner-title">E-Stop pressed — motion locked</p>
          <p className="safety__banner-body">
            The job and any test moves were stopped. SharpCNC won&rsquo;t jog,
            home, probe, or start anything until you clear this.
          </p>
          <ol className="safety__guide">
            <li>
              <strong>Check the machine</strong>
              <span>Spindle stopped, bit clear of the work, nothing loose.</span>
            </li>
            <li>
              <strong>Re-home if it was moving</strong>
              <span>
                A stop mid-move can lose position. Home before trusting
                coordinates again.
              </span>
            </li>
          </ol>
          {onClearEstop ? (
            <button
              type="button"
              className="safety__btn safety__btn--unlock"
              onClick={onClearEstop}
              title="I've checked the machine — allow motion again"
            >
              Clear E-Stop
            </button>
          ) : null}
        </div>
      )}

      {inAlarm && !estopLatched && (
        <div className="safety__banner" role="alert">
          <p className="safety__banner-title">
            {alarmGuide?.headline ?? "Alarm lock"}
          </p>
          <p className="safety__banner-body">
            {alarmMessage ??
              "Motion blocked. Unlock ($X) after clearing the fault."}
          </p>
          {alarmGuide ? (
            <ol className="safety__guide">
              {alarmGuide.steps.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <span>{step.detail}</span>
                </li>
              ))}
            </ol>
          ) : null}
          <p className="safety__guide-hint">
            {alarmGuide?.unlockReadyHint ?? "Clear the fault, then Unlock ($X)."}
          </p>
        </div>
      )}

      <div className="safety__actions">
        <button
          type="button"
          className="safety__estop"
          disabled={!connected}
          onClick={onEstop}
          title="Stop everything now: feed hold, cancel the job and any test moves, then lock motion until you clear it. This is a software stop over USB — keep a physical power switch within reach."
          aria-label="Emergency stop"
        >
          E-Stop
        </button>
        <button
          type="button"
          className="safety__btn safety__btn--hold"
          disabled={!canMotion || inHold}
          onClick={onHold}
          title="Feed hold (!)"
        >
          Hold
        </button>
        <button
          type="button"
          className="safety__btn"
          disabled={!connected || !inHold}
          onClick={onResume}
          title="Cycle start / resume (~)"
        >
          Resume
        </button>
        <button
          type="button"
          className="safety__btn safety__btn--ghost"
          disabled={!connected}
          onClick={onReset}
          title="Soft reset (Ctrl-X): restarts the controller and cancels the job, without locking motion afterwards. Use E-Stop in an emergency."
        >
          Reset
        </button>
        <button
          type="button"
          className="safety__btn safety__btn--unlock"
          disabled={!connected || !inAlarm}
          onClick={onUnlock}
          title="Unlock alarm lock ($X)"
        >
          Unlock
        </button>
      </div>

      {usingMock && (onSimulateAlarm || onSimulateSoftLimit || onSimulateProbeFail) && (
        <div
          className="safety__mock-row"
          role="group"
          aria-label="Virtual CNC practice faults"
        >
          <span className="safety__mock-label">Virtual CNC only · practice:</span>
          {onSimulateAlarm && (
            <button
              type="button"
              className="safety__mock"
              disabled={!connected || inAlarm}
              onClick={onSimulateAlarm}
            >
              Simulate hard limit
            </button>
          )}
          {onSimulateSoftLimit && (
            <button
              type="button"
              className="safety__mock"
              disabled={!connected || inAlarm}
              onClick={onSimulateSoftLimit}
            >
              Simulate soft limit
            </button>
          )}
          {onSimulateProbeFail && (
            <button
              type="button"
              className="safety__mock"
              disabled={!connected || inAlarm}
              onClick={onSimulateProbeFail}
            >
              Simulate probe fail
            </button>
          )}
        </div>
      )}
    </section>
  );
}
