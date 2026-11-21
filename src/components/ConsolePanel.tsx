import { useState } from "react";
import type { GcodeMacro } from "../grbl";

interface ConsolePanelProps {
  enabled: boolean;
  blockedReason?: string | null;
  macros: GcodeMacro[];
  lastResult?: string | null;
  onSend: (text: string) => void;
  onRunMacro: (macro: GcodeMacro) => void;
  onSaveMacro: (name: string, body: string) => void;
  onDeleteMacro: (id: string) => void;
}

export function ConsolePanel({
  enabled,
  blockedReason = null,
  macros,
  lastResult,
  onSend,
  onRunMacro,
  onSaveMacro,
  onDeleteMacro,
}: ConsolePanelProps) {
  const [draft, setDraft] = useState("");
  const [macroName, setMacroName] = useState("");

  return (
    <section className="console" aria-label="G-code console">
      <header className="console__head">
        <h2 className="console__title">Console</h2>
        <span className="console__meta">Manual lines · macros</span>
      </header>

      <label className="console__label" htmlFor="console-input">
        Send G-code
      </label>
      <textarea
        id="console-input"
        className="console__input"
        rows={3}
        spellCheck={false}
        disabled={!enabled}
        placeholder="G21&#10;G0 X0 Y0"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />

      <div className="console__row">
        <button
          type="button"
          className="console__btn"
          disabled={!enabled || !draft.trim()}
          title={blockedReason ?? "Send line(s)"}
          onClick={() => onSend(draft)}
        >
          Send
        </button>
        <button
          type="button"
          className="console__btn console__btn--ghost"
          disabled={!draft.trim()}
          onClick={() => setDraft("")}
        >
          Clear
        </button>
      </div>

      {blockedReason ? (
        <p className="console__warn" role="status">
          {blockedReason}
        </p>
      ) : null}
      {lastResult ? (
        <p className="console__result" role="status">
          {lastResult}
        </p>
      ) : null}

      <div className="console__macros">
        <p className="console__section">Macros</p>
        <ul className="console__macro-list">
          {macros.map((m) => (
            <li key={m.id} className="console__macro">
              <button
                type="button"
                className="console__macro-run"
                disabled={!enabled}
                onClick={() => onRunMacro(m)}
                title={m.body}
              >
                {m.name}
              </button>
              <button
                type="button"
                className="console__macro-del"
                disabled={m.id.startsWith("spindle") || m.id.startsWith("coolant") || m.id.startsWith("units")}
                title="Delete macro"
                onClick={() => onDeleteMacro(m.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        <div className="console__save-macro">
          <input
            type="text"
            className="console__macro-name"
            placeholder="Macro name"
            value={macroName}
            onChange={(e) => setMacroName(e.target.value)}
            disabled={!draft.trim()}
          />
          <button
            type="button"
            className="console__btn console__btn--ghost"
            disabled={!draft.trim() || !macroName.trim()}
            onClick={() => {
              onSaveMacro(macroName, draft);
              setMacroName("");
            }}
          >
            Save as macro
          </button>
        </div>
      </div>
    </section>
  );
}
