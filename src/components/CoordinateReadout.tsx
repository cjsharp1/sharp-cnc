import type { GrblStatus, Position3 } from "../grbl";

interface CoordinateReadoutProps {
  status: GrblStatus;
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
      <span className="coords__val" title="Work">
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

export function CoordinateReadout({ status }: CoordinateReadoutProps) {
  const work = axesFrom(status.work);
  const machine = axesFrom(status.machine);

  return (
    <section className="coords" aria-label="Coordinates">
      <header className="coords__head">
        <h2 className="coords__title">Position</h2>
        <span
          className={`coords__state${status.state === "Alarm" ? " is-alarm" : ""}`}
        >
          {status.state}
        </span>
      </header>
      <div className="coords__legend" aria-hidden>
        <span />
        <span>Work</span>
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
    </section>
  );
}
