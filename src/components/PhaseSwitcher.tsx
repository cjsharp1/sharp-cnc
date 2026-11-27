import { useRef } from "react";
import {
  CONNECT_OFFLINE_PURPOSE,
  TASK_PHASES,
  type PhaseGate,
  type TaskPhaseId,
} from "../grbl/taskPhase";

interface PhaseSwitcherProps {
  active: TaskPhaseId;
  gates: Record<TaskPhaseId, PhaseGate>;
  onChange: (id: TaskPhaseId) => void;
  /** Optional badge on Verify (e.g. job name short). */
  verifyBadge?: string | null;
}

export function PhaseSwitcher({
  active,
  gates,
  onChange,
  verifyBadge,
}: PhaseSwitcherProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const focusTab = (index: number) => {
    const clamped = (index + TASK_PHASES.length) % TASK_PHASES.length;
    const id = TASK_PHASES[clamped]!.id;
    if (!gates[id].enabled) return;
    tabRefs.current[clamped]?.focus();
    onChange(id);
  };

  const activePurpose =
    active === "connect"
      ? CONNECT_OFFLINE_PURPOSE
      : (TASK_PHASES.find((t) => t.id === active)?.purpose ?? "");
  const activeGate = gates[active];
  const gateHint =
    active !== "connect" && !activeGate.enabled && activeGate.reason
      ? activeGate.reason
      : null;

  return (
    <div className="workspace__tabs-wrap phase-switcher">
      <p id="phase-tabs-help" className="visually-hidden">
        Task phases: Calibrate, Prepare, Verify, Run. Connect lives in the
        header. Incomplete phases ahead stay locked until their gate is met.
        Use Left and Right arrow keys on the phase list.
      </p>
      <div
        className="workspace__tabs"
        role="tablist"
        aria-label="Task phase"
        aria-describedby="phase-tabs-help"
        onKeyDown={(event) => {
          const index = TASK_PHASES.findIndex((t) => t.id === active);
          if (event.key === "ArrowRight" || event.key === "ArrowDown") {
            event.preventDefault();
            let next = index;
            for (let i = 0; i < TASK_PHASES.length; i++) {
              next = (next + 1) % TASK_PHASES.length;
              if (gates[TASK_PHASES[next]!.id].enabled) {
                focusTab(next);
                return;
              }
            }
          } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
            event.preventDefault();
            let next = index < 0 ? 0 : index;
            for (let i = 0; i < TASK_PHASES.length; i++) {
              next = (next - 1 + TASK_PHASES.length) % TASK_PHASES.length;
              if (gates[TASK_PHASES[next]!.id].enabled) {
                focusTab(next);
                return;
              }
            }
          } else if (event.key === "Home") {
            event.preventDefault();
            focusTab(0);
          } else if (event.key === "End") {
            event.preventDefault();
            focusTab(TASK_PHASES.length - 1);
          }
        }}
      >
        {TASK_PHASES.map(({ id, label, purpose }, index) => {
          const gate = gates[id];
          const locked = !gate.enabled;
          return (
            <button
              key={id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`phase-tab-${id}`}
              aria-selected={active === id}
              aria-controls={`phase-panel-${id}`}
              aria-disabled={locked}
              aria-label={
                locked && gate.reason
                  ? `${label}: ${purpose}. Locked — ${gate.reason}`
                  : `${label}: ${purpose}`
              }
              title={
                locked && gate.reason
                  ? `${purpose} — ${gate.reason}`
                  : purpose
              }
              tabIndex={active === id ? 0 : -1}
              disabled={locked}
              className={`workspace__tab${active === id ? " is-active" : ""}${locked ? " is-locked" : ""}`}
              onClick={() => {
                if (!locked) onChange(id);
              }}
            >
              {label}
              {id === "verify" && verifyBadge ? (
                <span className="workspace__badge">{verifyBadge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="workspace__purpose" aria-live="polite">
        {gateHint ? (
          <>
            <span className="phase-switcher__gate">{gateHint}</span>
            {" · "}
            {activePurpose}
          </>
        ) : (
          activePurpose
        )}
      </p>
    </div>
  );
}
