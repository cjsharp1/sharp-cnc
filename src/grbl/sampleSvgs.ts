/**
 * Built-in SharpCNC cut-size SVG samples (real mm units).
 * Files live under public/samples/ and are also mirrored in the user guide.
 */

export interface SampleSvgSpec {
  /** Stable id for UI keys. */
  id: string;
  /** Display label (short). */
  label: string;
  /** Filename shown after load / in recent jobs. */
  fileName: string;
  /** Path under Vite `public/` (no leading slash). */
  publicPath: string;
  /** One-line hint for the Job → SVG panel. */
  hint: string;
}

/** Primary + supporting size-check samples. */
export const SAMPLE_SVGS: readonly SampleSvgSpec[] = [
  {
    id: "100mm-square",
    label: "100×100 mm",
    fileName: "sample-100mm-square.svg",
    publicPath: "samples/sample-100mm-square.svg",
    hint: "True 100 mm square — primary cut-size check",
  },
  {
    id: "50mm-square",
    label: "50×50 mm",
    fileName: "sample-50mm-square.svg",
    publicPath: "samples/sample-50mm-square.svg",
    hint: "True 50 mm square — smaller stock check",
  },
  {
    id: "100mm-line",
    label: "100 mm line",
    fileName: "sample-100mm-line.svg",
    publicPath: "samples/sample-100mm-line.svg",
    hint: "100 mm span with end ticks — single-axis check",
  },
] as const;

/** Resolve a public sample URL (respects Vite `BASE_URL`). */
export function sampleSvgUrl(publicPath: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${prefix}${publicPath.replace(/^\//, "")}`;
}

/** Fetch a built-in sample’s SVG text. */
export async function fetchSampleSvg(spec: SampleSvgSpec): Promise<string> {
  const url = sampleSvgUrl(spec.publicPath);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not load sample ${spec.fileName} (${res.status})`);
  }
  return res.text();
}
