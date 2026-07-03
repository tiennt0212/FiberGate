import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ScreenTransition } from "@/components/ScreenTransition";
import { nodeInfo } from "@/lib/mock/data";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header node={nodeInfo} />
        <main className="flex-1 overflow-y-auto px-7 py-6 pb-14">
          <ScreenTransition>{children}</ScreenTransition>
        </main>
      </div>
    </div>
  );
}
