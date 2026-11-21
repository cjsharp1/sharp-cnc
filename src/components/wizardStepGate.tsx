import { useCallback, useMemo, useState } from "react";

/**
 * Session-only wizard step confirmation gates.
 * Next / step-dot skip-ahead stay locked until the current step is confirmed.
 * Back and revisit of already-unlocked steps stay allowed. Nothing is persisted.
 */

export function useWizardStepGate(stepCount: number) {
  const [stepIndex, setStepIndex] = useState(0);
  const [confirmed, setConfirmed] = useState<boolean[]>(() =>
    Array.from({ length: stepCount }, () => false),
  );

  /** Highest index the operator may open (confirmed prefix + current). */
  const furthestUnlocked = useMemo(() => {
    let unlocked = 0;
    for (let i = 0; i < confirmed.length; i++) {
      if (!confirmed[i]) break;
      unlocked = i + 1;
    }
    return Math.min(unlocked, Math.max(0, stepCount - 1));
  }, [confirmed, stepCount]);

  const canVisit = useCallback(
    (index: number) =>
      index >= 0 && index < stepCount && index <= furthestUnlocked,
    [furthestUnlocked, stepCount],
  );

  const isConfirmed = confirmed[stepIndex] === true;

  const setStepConfirmed = useCallback(
    (value: boolean, index: number = stepIndex) => {
      setConfirmed((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        if (value) {
          if (prev[index]) return prev;
          const next = [...prev];
          next[index] = true;
          return next;
        }
        let dirty = prev[index] === true;
        if (!dirty) {
          for (let i = index + 1; i < prev.length; i++) {
            if (prev[i]) {
              dirty = true;
              break;
            }
          }
        }
        if (!dirty) return prev;
        const next = [...prev];
        next[index] = false;
        for (let i = index + 1; i < next.length; i++) next[i] = false;
        return next;
      });
    },
    [stepIndex],
  );

  const goNext = useCallback(() => {
    setStepIndex((i) => {
      if (i >= stepCount - 1) return i;
      if (!confirmed[i]) return i;
      return Math.min(i + 1, stepCount - 1);
    });
  }, [confirmed, stepCount]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (!canVisit(index)) return;
      setStepIndex(index);
    },
    [canVisit],
  );

  return {
    stepIndex,
    confirmed,
    isConfirmed,
    furthestUnlocked,
    canVisit,
    setStepConfirmed,
    goNext,
    goBack,
    goTo,
    isFirst: stepIndex === 0,
    isLast: stepIndex === stepCount - 1,
  };
}

interface WizardStepConfirmProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  /** firstrun uses its own checkbox styling via className. */
  className?: string;
  id?: string;
}

/** Shared “I completed this step” checkbox for wizard footers / bodies. */
export function WizardStepConfirm({
  checked,
  disabled = false,
  label,
  onChange,
  className = "cal__check wizard-gate",
  id,
}: WizardStepConfirmProps) {
  return (
    <label className={className} htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
