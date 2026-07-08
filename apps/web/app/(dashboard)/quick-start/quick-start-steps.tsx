"use client";

import { useQuickStartProgress } from "./use-quick-start-progress";

// Code snippets below are copied verbatim from real, already-documented
// sources (CLAUDE.md's `docker compose up -d`, packages/sdk/README.md's
// `npm install @fibergate/sdk` + usage examples, lib/webhooks/sign.ts's
// `X-Fiber-Signature: sha256=<hmac>` scheme) — never invented syntax.

const CODE_DEPLOY = `docker compose up -d`;

const CODE_INSTALL = `npm install @fibergate/sdk`;

const CODE_INVOICE = `import { FiberGate } from "@fibergate/sdk";

const gateway = new FiberGate({
  baseUrl: process.env.FIBERGATE_BASE_URL!,
  internalSecret: process.env.FIBERGATE_INTERNAL_SECRET!,
});

const invoice = await gateway.invoices.create({
  amount: 1,
  asset: "CKB",
});
// invoice.invoice_address -> share with the payer`;

const CODE_WEBHOOK = `import { verifyWebhookSignature } from "@fibergate/sdk";

// body must be the raw request body string, not a re-serialized object
const isValid = verifyWebhookSignature(
  body,
  req.headers["x-fiber-signature"],
  secret,
);`;

interface StepCardProps {
  index: number;
  title: string;
  description: React.ReactNode;
  code?: string;
  status: "done" | "current" | "upcoming";
  action?: React.ReactNode;
}

function StepCard({ index, title, description, code, status, action }: StepCardProps) {
  const dotBg = status === "upcoming" ? "bg-[#e4e4e7]" : "bg-[#4f46e5]";
  const dotColor = status === "upcoming" ? "text-[#a1a1aa]" : "text-white";
  const containerClass =
    status === "current"
      ? "border-[#c7d2fe] shadow-[0_0_0_3px_rgba(79,70,229,0.08)]"
      : "border-[#e4e4e7]";
  const opacity = status === "upcoming" ? "opacity-70" : "";

  return (
    <div className={`overflow-hidden rounded-[8px] border bg-white ${containerClass} ${opacity}`}>
      <div className="flex items-center gap-3.5 px-5 py-4">
        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${dotBg} ${dotColor}`}>
          {status === "done" ? "✓" : index}
        </div>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-[#141414]">{title}</div>
          <div className="mt-0.5 text-[12.5px] text-[#71717a]">{description}</div>
        </div>
        {status === "done" ? (
          <span className="rounded-full bg-[#dcfce7] px-2.5 py-0.75 text-[12px] font-medium text-[#15803d]">Done</span>
        ) : status === "current" ? (
          <span className="rounded-full bg-[#eef2ff] px-2.5 py-0.75 text-[12px] font-medium text-[#4f46e5]">Current</span>
        ) : null}
      </div>
      {code ? (
        <div className="px-5 pb-4 pl-[62px]">
          <pre className="m-0 overflow-x-auto rounded-[6px] bg-[#0f172a] px-4 py-3 font-mono text-[12px] leading-relaxed text-[#e2e8f0]">{code}</pre>
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function QuickStartSteps({ step4Done, step5Done }: { step4Done: boolean; step5Done: boolean }) {
  const { step3Done, markStep3Done, completedSteps, totalSteps } = useQuickStartProgress(step4Done, step5Done);
  const progressPct = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div className="max-w-[800px] animate-[fade-in_0.2s_ease-out_forwards]">
      <div className="mb-5.5">
        <div className="text-[15px] font-semibold text-[#141414]">Quick Start</div>
        <div className="mt-0.5 text-[12.5px] text-[#71717a]">Self-host FiberGate and accept your first payment</div>
      </div>

      <div className="mb-5 flex items-center gap-3.5 rounded-[8px] border border-[#e4e4e7] bg-white px-5 py-4">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f3f4f6]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] transition-[width]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="whitespace-nowrap text-[13px] font-semibold text-[#141414]">
          {completedSteps}/{totalSteps} complete
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        <StepCard
          index={1}
          title="Deploy FiberGate"
          description="Run via Docker Compose with your environment variables"
          code={CODE_DEPLOY}
          status="done"
        />
        <StepCard
          index={2}
          title="Login to dashboard"
          description={
            <>
              Generate a bcrypt hash, base64-encode it, set{" "}
              <code className="font-mono text-[11.5px]">ADMIN_PASSWORD_HASH_B64</code> in .env (see README), then open
              the dashboard URL
            </>
          }
          status="done"
        />
        <StepCard
          index={3}
          title="Install the SDK"
          description="Add the FiberGate SDK to your project"
          code={CODE_INSTALL}
          status={step3Done ? "done" : "current"}
          action={
            !step3Done ? (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={markStep3Done}
                  className="cursor-pointer rounded-[6px] border-0 bg-[#4f46e5] px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-[#4338ca]"
                >
                  Mark as done
                </button>
                <a
                  href="https://www.npmjs.com/package/@fibergate/sdk"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-[6px] border border-[#e4e4e7] px-3.5 py-1.5 text-[13px] text-[#374151] no-underline! hover:bg-[#f4f4f5]"
                >
                  View SDK docs
                </a>
              </div>
            ) : null
          }
        />
        <StepCard
          index={4}
          title="Create your first invoice"
          description="Use the API to generate a payment request"
          code={CODE_INVOICE}
          status={step4Done ? "done" : "upcoming"}
        />
        <StepCard
          index={5}
          title="Configure webhook + test payment"
          description="Add an endpoint on the Webhooks page, then verify signatures end-to-end"
          code={CODE_WEBHOOK}
          status={step5Done ? "done" : "upcoming"}
        />
      </div>
    </div>
  );
}
