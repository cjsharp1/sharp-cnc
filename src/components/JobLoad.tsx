interface JobLoadProps {
  jobName: string | null;
  onLoadClick: () => void;
}

export function JobLoad({ jobName, onLoadClick }: JobLoadProps) {
  return (
    <section className="job" aria-label="Job load">
      <div className="job__meta">
        <h2 className="job__title">Job</h2>
        <p className="job__name">{jobName ?? "No file loaded"}</p>
        <p className="job__hint">.nc / .gcode · SVG path later</p>
      </div>
      <button type="button" className="job__btn" onClick={onLoadClick}>
        Load job
      </button>
    </section>
  );
}
