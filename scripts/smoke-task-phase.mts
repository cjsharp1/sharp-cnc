/**
 * Smoke: task-phase gates + calibration persistence + connect landing + Verify/Run prefs.
 * Run: npx --yes tsx scripts/smoke-task-phase.mts
 */
import {
  CALIBRATION_GUIDED_STEPS,
  DEFAULT_CALIBRATION,
  loadCalibrationState,
  resetCalibrationState,
  saveCalibrationCompleted,
} from "../src/grbl/calibrationConfig.ts";
import { PREPARE_GUIDED_STEPS } from "../src/grbl/prepareConfig.ts";
import {
  TASK_PHASES,
  canStartFromVerify,
  gateForPhase,
  phaseAfterConnect,
  phaseAfterStreamEnds,
  type TaskPhaseContext,
  type TaskPhaseId,
} from "../src/grbl/taskPhase.ts";
import {
  DEFAULT_VERIFY_RUN,
  VERIFY_CHECKLIST,
  dismissSimNudge,
  emptyVerifyChecklist,
  initialDryRun,
  loadVerifyRunState,
  markStartedOnRealMachine,
  resetVerifyRunState,
  saveDryRunPreferred,
  verifyChecklistComplete,
} from "../src/grbl/verifyRunConfig.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const expected: TaskPhaseId[] = [
  "connect",
  "calibrate",
  "prepare",
  "verify",
  "run",
];
assert(TASK_PHASES.length === 5, "five phases");
assert(
  TASK_PHASES.map((p) => p.id).join(",") === expected.join(","),
  "phase order Connect→Calibrate→Prepare→Verify→Run",
);

assert(phaseAfterConnect(false) === "calibrate", "land calibrate");
assert(phaseAfterConnect(true) === "prepare", "land prepare");
assert(phaseAfterStreamEnds(true) === "verify", "stream end → verify");
assert(phaseAfterStreamEnds(false) === "prepare", "cleared → prepare");

const offline: TaskPhaseContext = {
  connected: false,
  calibrationCompleted: false,
  prepareReady: false,
  jobLoaded: false,
  streaming: false,
};
assert(gateForPhase("connect", offline).enabled, "connect always");
assert(!gateForPhase("calibrate", offline).enabled, "calibrate needs link");
assert(!gateForPhase("prepare", offline).enabled, "prepare needs link");

const linked: TaskPhaseContext = {
  ...offline,
  connected: true,
};
assert(gateForPhase("calibrate", linked).enabled, "calibrate after connect");
assert(
  !gateForPhase("prepare", linked).enabled,
  "prepare blocked until calibrated",
);
assert(
  gateForPhase("prepare", linked).reason?.includes("Calibrate"),
  "prepare reason",
);

const calibrated: TaskPhaseContext = {
  ...linked,
  calibrationCompleted: true,
};
assert(gateForPhase("prepare", calibrated).enabled, "prepare after cal");
assert(
  !gateForPhase("verify", calibrated).enabled,
  "verify needs ready + job",
);

const readyNoJob: TaskPhaseContext = {
  ...calibrated,
  prepareReady: true,
};
assert(
  !gateForPhase("verify", readyNoJob).enabled,
  "verify needs job loaded",
);

const ready: TaskPhaseContext = {
  ...readyNoJob,
  jobLoaded: true,
};
assert(gateForPhase("verify", ready).enabled, "verify unlocked");
assert(!gateForPhase("run", ready).enabled, "run needs stream");
assert(canStartFromVerify(ready), "can start from verify");

const running: TaskPhaseContext = {
  ...ready,
  streaming: true,
};
assert(gateForPhase("run", running).enabled, "run while streaming");
assert(!canStartFromVerify(running), "no start while streaming");

const mem = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => {
    mem.set(k, String(v));
  },
  removeItem: (k: string) => {
    mem.delete(k);
  },
  clear: () => mem.clear(),
  key: () => null,
  get length() {
    return mem.size;
  },
} as Storage;

assert(
  CALIBRATION_GUIDED_STEPS.join(",") ===
    "zero,direction,steps,rates,homing,travel",
  "calibrate = six guided steps (homing before soft travel)",
);
assert(CALIBRATION_GUIDED_STEPS.length === 6, "six calibrate steps");

assert(
  PREPARE_GUIDED_STEPS.join(",") === "stock,xy,probe,load,ready",
  "prepare = five dense steps (stock+tool, XY, Z, load, ready)",
);
assert(PREPARE_GUIDED_STEPS.length === 5, "five prepare steps");
assert(
  !PREPARE_GUIDED_STEPS.includes("tool" as never),
  "tool merged into stock step",
);

assert(
  loadCalibrationState().calibrationCompleted ===
    DEFAULT_CALIBRATION.calibrationCompleted,
  "default cal",
);
const done = saveCalibrationCompleted(true);
assert(done.calibrationCompleted === true, "saved");
assert(typeof done.completedAt === "number", "timestamp");
assert(loadCalibrationState().calibrationCompleted === true, "reload");
const reset = resetCalibrationState();
assert(reset.calibrationCompleted === false, "reset");
assert(loadCalibrationState().calibrationCompleted === false, "reset reload");

/* --- Slice E: Verify checklist + dry-run / real-machine prefs ------------ */
assert(VERIFY_CHECKLIST.length === 3, "verify checklist = 3");
assert(
  VERIFY_CHECKLIST.map((c) => c.id).join(",") === "plate,clamps,path",
  "checklist ids",
);
const emptyChecks = emptyVerifyChecklist();
assert(!verifyChecklistComplete(emptyChecks), "checklist empty blocks Start");
assert(
  verifyChecklistComplete({ plate: true, clamps: true, path: true }),
  "checklist complete",
);

resetVerifyRunState();
assert(
  loadVerifyRunState().hasStartedOnRealMachine ===
    DEFAULT_VERIFY_RUN.hasStartedOnRealMachine,
  "default verify-run",
);
assert(
  initialDryRun(loadVerifyRunState(), false) === true,
  "first real Start → dry-run on",
);
assert(
  initialDryRun(loadVerifyRunState(), true) === true,
  "virtual uses preferred (default on)",
);
saveDryRunPreferred(false);
assert(
  initialDryRun(loadVerifyRunState(), true) === false,
  "virtual remembers dry-run off",
);
assert(
  initialDryRun(loadVerifyRunState(), false) === true,
  "real still forced on until first Start",
);
markStartedOnRealMachine();
assert(loadVerifyRunState().hasStartedOnRealMachine === true, "marked real");
assert(
  initialDryRun(loadVerifyRunState(), false) === false,
  "after real Start, prefer last dry-run",
);
dismissSimNudge();
assert(loadVerifyRunState().simNudgeDismissed === true, "sim nudge dismissed");
resetVerifyRunState();
assert(loadVerifyRunState().hasStartedOnRealMachine === false, "verify-run reset");

console.log("smoke-task-phase: ok");
