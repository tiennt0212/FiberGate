"use client";

import { useEffect, useState } from "react";

// Quick Start step 3 ("Install the SDK — Mark as done") persistence —
// harness-brief.md issue #10 Resolved Decision #2: client-side only via
// localStorage, no DB column, does not survive across devices/browsers.
// Steps 1/2 are static ("Done" always); steps 4/5 are server-derived (see
// ./status.ts) and passed in as props here rather than re-derived
// client-side. Shared by the sidebar's "N/5" badge (sidebar.tsx) and the
// Quick Start page itself so both agree on the same completed-step count.

const STORAGE_KEY = "fibergate.quickStart.sdkInstalled";
const TOTAL_STEPS = 5;

export interface QuickStartProgress {
  step3Done: boolean;
  markStep3Done: () => void;
  completedSteps: number;
  totalSteps: number;
}

export function useQuickStartProgress(step4Done: boolean, step5Done: boolean): QuickStartProgress {
  const [step3Done, setStep3Done] = useState(false);

  useEffect(() => {
    try {
      setStep3Done(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch (error) {
      // localStorage can throw (privacy mode, disabled storage) — fail open
      // to "not done" rather than crashing the dashboard shell over a
      // purely cosmetic onboarding checklist.
      console.error("Failed to read Quick Start step 3 state from localStorage:", error);
    }
  }, []);

  function markStep3Done(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch (error) {
      console.error("Failed to persist Quick Start step 3 state to localStorage:", error);
    }
    setStep3Done(true);
  }

  // Steps 1/2 are always "Done" (static deploy/login instructions, not
  // derived from anything) — see quick-start/page.tsx.
  const completedSteps = 2 + (step3Done ? 1 : 0) + (step4Done ? 1 : 0) + (step5Done ? 1 : 0);

  return { step3Done, markStep3Done, completedSteps, totalSteps: TOTAL_STEPS };
}
