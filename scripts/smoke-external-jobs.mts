/**
 * Smoke: external jobs folder + Drive config helpers + PKCE scaffolding.
 * Run: npx --yes tsx scripts/smoke-external-jobs.mts
 */
import {
  DEFAULT_DRIVE_CONFIG,
  getDriveClientId,
  isDriveConfigured,
} from "../src/grbl/driveConfig.ts";
import {
  DEFAULT_JOBS_FOLDER,
  shortFolderLabel,
} from "../src/grbl/jobsFolderConfig.ts";
import { driveStatusLabel } from "../src/grbl/googleDrive.ts";
import { GCODE_EXTENSIONS, isGcodeFileName } from "../src/grbl/gcode.ts";
import { isSvgFileName } from "../src/grbl/svgImport.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(DEFAULT_JOBS_FOLDER.path === "", "default folder empty");
assert(DEFAULT_JOBS_FOLDER.watch === true, "watch on by default");
assert(shortFolderLabel("") === "No folder", "empty label");
assert(
  shortFolderLabel("C:\\Jobs\\parts").includes("parts"),
  "short label keeps tail",
);

const long =
  "C:\\Users\\Chris\\Google Drive\\CNC\\jobs\\production\\plates";
assert(shortFolderLabel(long, 28).startsWith("…"), "truncates long paths");

assert(DEFAULT_DRIVE_CONFIG.folderId === "", "drive default empty");
assert(isDriveConfigured() === false, "no client id in smoke env");
assert(getDriveClientId() === "", "client id empty without env");
assert(
  driveStatusLabel(false, DEFAULT_DRIVE_CONFIG) === "Not configured",
  "drive status",
);
assert(
  driveStatusLabel(true, {
    ...DEFAULT_DRIVE_CONFIG,
    accountHint: "chris@example.com",
  }) === "chris@example.com · pick a folder",
  "drive connected label",
);

for (const ext of GCODE_EXTENSIONS) {
  assert(isGcodeFileName(`job${ext}`), `gcode ${ext}`);
}
assert(isSvgFileName("logo.svg"), "svg");
assert(!isSvgFileName("logo.nc"), "nc not svg");

console.log("smoke-external-jobs: ok");
