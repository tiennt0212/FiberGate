import { getQuickStartStatus } from "./status";
import { QuickStartSteps } from "./quick-start-steps";

export default async function QuickStartPage() {
  let step4Done = false;
  let step5Done = false;
  try {
    ({ step4Done, step5Done } = await getQuickStartStatus());
  } catch (error) {
    console.error("Quick Start: getQuickStartStatus failed:", error);
  }

  return <QuickStartSteps step4Done={step4Done} step5Done={step5Done} />;
}
