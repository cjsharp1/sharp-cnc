import type {
  GcodeMacro,
  GrblSetting,
  Position3,
  SavedWorkOffset,
  SettingsSnapshot,
  WcsId,
} from "../grbl";
import { ConsolePanel } from "./ConsolePanel";
import { ManualSettingsPanel } from "./ManualSettingsPanel";
import { SettingsRestorePanel } from "./SettingsRestorePanel";
import { WorkOffsetsPanel } from "./WorkOffsetsPanel";

interface AdvancedPanelProps {
  consoleEnabled: boolean;
  consoleBlockedReason?: string | null;
  macros: GcodeMacro[];
  consoleResult?: string | null;
  onSendConsole: (text: string) => void;
  onRunMacro: (macro: GcodeMacro) => void;
  onSaveMacro: (name: string, body: string) => void;
  onDeleteMacro: (id: string) => void;
  offsetsEnabled: boolean;
  activeWcs: WcsId;
  offsetSlots: Partial<Record<WcsId, SavedWorkOffset>>;
  currentWco: Position3;
  offsetsMessage?: string | null;
  onSelectWcs: (id: WcsId) => void;
  onSaveOffset: (id: WcsId) => void;
  onRecallOffset: (id: WcsId) => void;
  settingsEnabled: boolean;
  settingsBlockedReason?: string | null;
  settings: Map<number, GrblSetting> | null;
  settingsBusy?: boolean;
  settingsMessage?: string | null;
  onRefreshSettings: () => void;
  onWriteManual: (id: number, value: number) => void;
  /** Persisted Calibrate/session $$ snapshots (last 5). */
  settingsSnapshots?: SettingsSnapshot[];
  onRestoreSettingsSnapshot?: (snapshot: SettingsSnapshot) => void;
  restoreMessage?: string | null;
}

/**
 * One Advanced door: console/macros, G54–G59, free-form $$.
 * Not a phase — opened from Menu → Advanced…, closed by default.
 */
export function AdvancedPanel({
  consoleEnabled,
  consoleBlockedReason = null,
  macros,
  consoleResult = null,
  onSendConsole,
  onRunMacro,
  onSaveMacro,
  onDeleteMacro,
  offsetsEnabled,
  activeWcs,
  offsetSlots,
  currentWco,
  offsetsMessage = null,
  onSelectWcs,
  onSaveOffset,
  onRecallOffset,
  settingsEnabled,
  settingsBlockedReason = null,
  settings,
  settingsBusy = false,
  settingsMessage = null,
  onRefreshSettings,
  onWriteManual,
  settingsSnapshots = [],
  onRestoreSettingsSnapshot,
  restoreMessage = null,
}: AdvancedPanelProps) {
  return (
    <div className="advanced" aria-label="Advanced controls">
      <p className="advanced__intro">
        Raw GRBL tools for debugging. Everyday cutting uses Connect → Calibrate →
        Prepare → Verify → Run — you normally never need this panel.
      </p>

      <ConsolePanel
        enabled={consoleEnabled}
        blockedReason={consoleBlockedReason}
        macros={macros}
        lastResult={consoleResult}
        onSend={onSendConsole}
        onRunMacro={onRunMacro}
        onSaveMacro={onSaveMacro}
        onDeleteMacro={onDeleteMacro}
      />

      <WorkOffsetsPanel
        enabled={offsetsEnabled}
        active={activeWcs}
        slots={offsetSlots}
        currentWco={currentWco}
        message={offsetsMessage}
        onSelect={onSelectWcs}
        onSave={onSaveOffset}
        onRecall={onRecallOffset}
      />

      {onRestoreSettingsSnapshot ? (
        <SettingsRestorePanel
          enabled={settingsEnabled}
          blockedReason={settingsBlockedReason}
          busy={settingsBusy}
          message={restoreMessage}
          settings={settings}
          snapshots={settingsSnapshots}
          onRefreshSettings={onRefreshSettings}
          onRestore={onRestoreSettingsSnapshot}
        />
      ) : null}

      <ManualSettingsPanel
        enabled={settingsEnabled}
        blockedReason={settingsBlockedReason}
        settings={settings}
        busy={settingsBusy}
        message={settingsMessage}
        onRefreshSettings={onRefreshSettings}
        onWriteManual={onWriteManual}
      />
    </div>
  );
}
