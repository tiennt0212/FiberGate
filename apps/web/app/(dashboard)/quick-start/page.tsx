import { Card } from "antd";
import { CodeBlock } from "@/components/CodeBlock";
import {
  CREATE_INVOICE_SNIPPET,
  DEPLOY_SNIPPET,
  INSTALL_SNIPPET,
  VERIFY_WEBHOOK_SNIPPET,
} from "./constants";

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Configure & deploy",
    body: (
      <>
        <p className="mb-3 text-[13px] text-text-secondary">
          Copy the example env, set the required secrets, then bring the stack
          up. FiberGate runs Fiber node + PostgreSQL + core in one compose file.
        </p>
        <CodeBlock>{DEPLOY_SNIPPET}</CodeBlock>
      </>
    ),
  },
  {
    title: "Install the SDK",
    body: <CodeBlock>{INSTALL_SNIPPET}</CodeBlock>,
  },
  {
    title: "Create an invoice (server-side)",
    body: <CodeBlock>{CREATE_INVOICE_SNIPPET}</CodeBlock>,
  },
  {
    title: "Verify webhook signatures",
    body: (
      <>
        <p className="mb-3 text-[13px] text-text-secondary">
          Add an endpoint under Webhooks, then verify the{" "}
          <span className="font-mono text-[12px]">X-Fiber-Signature</span> header
          on each delivery.
        </p>
        <CodeBlock>{VERIFY_WEBHOOK_SNIPPET}</CodeBlock>
      </>
    ),
  },
];

export default function QuickStartPage() {
  return (
    <div className="flex flex-col gap-4">
      <Card styles={{ body: { padding: "16px 20px" } }}>
        <div className="text-[13.5px] font-semibold text-text-primary">
          Quick Start
        </div>
        <p className="m-0 mt-1 text-[13px] text-text-secondary">
          Integrate Fiber payments into your storefront in a few minutes.
        </p>
      </Card>

      {STEPS.map((step, idx) => (
        <Card key={step.title} styles={{ body: { padding: "18px 20px" } }}>
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-light text-[12px] font-semibold text-accent">
              {idx + 1}
            </span>
            <span className="text-[14px] font-semibold text-text-primary">
              {step.title}
            </span>
          </div>
          <div className="pl-9">{step.body}</div>
        </Card>
      ))}
    </div>
  );
}
