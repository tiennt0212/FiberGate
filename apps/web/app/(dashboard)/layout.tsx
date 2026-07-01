import { redirect } from "next/navigation";
import { hasAdminSession } from "@/lib/auth/guard";
import { Sidebar } from "@/components/Sidebar";
import { DashboardHeader } from "@/components/DashboardHeader";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware already gates these routes; re-check here as defence in depth.
  if (!(await hasAdminSession())) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <div className="ml-[240px] flex min-h-screen flex-col">
        <DashboardHeader />
        <main className="flex-1 px-7 pb-14 pt-7">{children}</main>
      </div>
    </div>
  );
}
