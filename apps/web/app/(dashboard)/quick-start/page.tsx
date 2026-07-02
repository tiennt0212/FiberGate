import { Card } from "antd";
import { CodeBlock } from "@/components/CodeBlock";

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Configure & deploy",
    body: (
      <>
        <p className="mb-3 text-[13px] text-text-secondary">
          Copy the example env, set the required secrets, then bring the stack
          up. FiberGate runs Fiber node + PostgreSQL + core in one compose file.
        </p>
        <CodeBlock>{`cp .env.example .env
# set ADMIN_PASSWORD, FIBERGATE_INTERNAL_SECRET, DATABASE_URL, FIBER_NODE_URL
docker compose up -d`}</CodeBlock>
      </>
    ),
  },
  {
    title: "Install the SDK",
    body: <CodeBlock>{`npm install @fibergate/sdk`}</CodeBlock>,
  },
  {
    title: "Create an invoice (server-side)",
    body: (
      <CodeBlock>{`import { FiberGate } from '@fibergate/sdk'

const gateway = new FiberGate({
  baseUrl: process.env.FIBERGATE_BASE_URL,
  internalSecret: process.env.FIBERGATE_INTERNAL_SECRET,
})

const invoice = await gateway.invoices.create({
  amount: 1,
  asset: 'CKB',
  description: 'Order #123',
})`}</CodeBlock>
    ),
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
        <CodeBlock>{`const isValid = gateway.webhooks.verify(rawBody, signature, secret)`}</CodeBlock>
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
