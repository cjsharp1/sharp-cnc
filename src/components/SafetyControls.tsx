interface SafetyControlsProps {
  connected: boolean;
  machineState: string;
  alarmMessage: string | null;
  usingMock?: boolean;
  onEstop: () => void;
  onHold: () => void;
  onResume: () => void;
  onReset: () => void;
  onUnlock: () => void;
  onSimulateAlarm?: () => void;
}

export function SafetyControls({
  connected,
  machineState,
  alarmMessage,
  usingMock = false,
  onEstop,
  onHold,
  onResume,
  onReset,
  onUnlock,
  onSimulateAlarm,
}: SafetyControlsProps) {
  const inAlarm = machineState === "Alarm";
  const inHold = machineState === "Hold";
  const canMotion = connected && !inAlarm;

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

      {inAlarm && (
        <div className="safety__banner" role="alert">
          <p className="safety__banner-title">Alarm lock</p>
          <p className="safety__banner-body">
            {alarmMessage ??
              "Motion blocked. Unlock ($X) after clearing the fault."}
          </p>
        </div>
      )}

      <div className="safety__actions">
        <button
          type="button"
          className="safety__estop"
          disabled={!connected}
          onClick={onEstop}
          title="Emergency stop: feed hold, then soft reset / cancel job"
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
          title="Soft reset (Ctrl-X)"
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

      {usingMock && onSimulateAlarm && (
        <button
          type="button"
          className="safety__mock"
          disabled={!connected || inAlarm}
          onClick={onSimulateAlarm}
        >
          Simulate alarm (mock)
        </button>
      )}
    </section>
  );
}
