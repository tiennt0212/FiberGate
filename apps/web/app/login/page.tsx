import { LoginForm } from "@/components/LoginForm";
import { BrandMark } from "@/components/BrandMark";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px] animate-fade-in">
        <div className="mb-6 flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <div className="text-[17px] font-bold leading-tight text-ink">FiberGate</div>
            <div className="text-xs text-subtle">Self-Hosted Payment Gateway</div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <div className="text-[15px] font-semibold text-ink">Admin sign in</div>
          <div className="mt-1 text-[13px] text-muted">
            Single-admin access to your gateway dashboard.
          </div>
          <LoginForm />
        </div>
        <div className="mt-4 text-center text-[11.5px] text-subtle">
          Set <code className="font-mono">ADMIN_PASSWORD_HASH</code> in your environment to sign in.
        </div>
      </div>
    </div>
  );
}
