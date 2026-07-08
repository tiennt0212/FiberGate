import { loadQuickStartStatus } from "./status";
import { QuickStartSteps } from "./quick-start-steps";

export default async function QuickStartPage() {
  const { step4Done, step5Done } = await loadQuickStartStatus("Quick Start page");

  return <QuickStartSteps step4Done={step4Done} step5Done={step5Done} />;
}
