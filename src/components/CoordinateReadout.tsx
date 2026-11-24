import type { GrblStatus, Position3 } from "../grbl";

interface CoordinateReadoutProps {
  status: GrblStatus;
  /** Show the live input-pin row (limit switches, probe, buttons). */
  showInputs?: boolean;
}

/** GRBL `Pn:` letters → plain labels, in display order. */
export const INPUT_PINS: { letter: string; label: string; title: string }[] = [
  { letter: "X", label: "X lim", title: "X limit switch" },
  { letter: "Y", label: "Y lim", title: "Y limit switch" },
  { letter: "Z", label: "Z lim", title: "Z limit switch" },
  { letter: "P", label: "Probe", title: "Probe / touch plate (clip touching the plate)" },
  { letter: "H", label: "Hold", title: "Feed hold button" },
  { letter: "S", label: "Start", title: "Cycle start / resume button" },
  { letter: "R", label: "Reset", title: "Reset / abort button" },
  { letter: "D", label: "Door", title: "Safety door input" },
];

const PROBE_PIN = INPUT_PINS.find((p) => p.letter === "P")!;

/**
 * Single probe pin light — same chrome as the Position → Inputs row.
 * Driven by parsed `status.pins.probe` (GRBL `Pn:P`).
 */
export function ProbePinLight({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <span
      className={`coords__pin${active ? " is-on" : ""}${className ? ` ${className}` : ""}`}
      title={`${PROBE_PIN.title}: ${active ? "ACTIVE" : "not active"}`}
      aria-label={`Probe pin ${active ? "on" : "off"}`}
    >
      {PROBE_PIN.label}
    </span>
  );
}

/**
 * Live inputs from the status report: lights up while a pin reads active.
 * Lets you test limit switches and the probe by hand before trusting them.
 */
function InputPins({ raw }: { raw: string }) {
  const active = raw.toUpperCase();
  return (
    <div className="coords__inputs" aria-label="Inputs">
      <span className="coords__inputs-label">Inputs</span>
      {INPUT_PINS.map((pin) => {
        const on = active.includes(pin.letter);
        return (
          <span
            key={pin.letter}
            className={`coords__pin${on ? " is-on" : ""}`}
            title={`${pin.title}: ${on ? "ACTIVE" : "not active"}`}
          >
            {pin.label}
          </span>
        );
      })}
    </div>
  );
}

function formatAxis(value: number): string {
  return value.toFixed(3);
}

function AxisRow({
  label,
  machine,
  work,
}: {
  label: string;
  machine: number;
  work: number;
}) {
  return (
    <div className="coords__row">
      <span className="coords__axis">{label}</span>
      <span className="coords__val" title="Material">
        {formatAxis(work)}
      </span>
      <span className="coords__val coords__val--muted" title="Machine">
        {formatAxis(machine)}
      </span>
    </div>
  );
}

function axesFrom(pos: Position3) {
  return [
    { label: "X", value: pos.x },
    { label: "Y", value: pos.y },
    { label: "Z", value: pos.z },
  ] as const;
}

export function CoordinateReadout({
  status,
  showInputs = false,
}: CoordinateReadoutProps) {
  const work = axesFrom(status.work);
  const machine = axesFrom(status.machine);

  return (
    <section className="coords" aria-label="Coordinates">
      <header className="coords__head">
        <h2 className="coords__title">Position</h2>
        <span
          className={`coords__state${status.state === "Alarm" ? " is-alarm" : ""}${status.state === "Hold" ? " is-hold" : ""}`}
          title={
            status.state === "Alarm"
              ? "Alarm lock — clear fault, then Unlock"
              : status.state === "Hold"
                ? "Feed hold — Resume to continue"
                : undefined
          }
        >
          {status.state === "Alarm"
            ? "Alarm"
            : status.state === "Hold"
              ? "Hold"
              : status.state}
        </span>
      </header>
      <div className="coords__legend" aria-hidden>
        <span />
        <span>Material</span>
        <span>Machine</span>
      </div>
      {work.map((axis, i) => (
        <AxisRow
          key={axis.label}
          label={axis.label}
          work={axis.value}
          machine={machine[i].value}
        />
      ))}
      {showInputs ? <InputPins raw={status.pins?.raw ?? ""} /> : null}
    </section>
  );
}
