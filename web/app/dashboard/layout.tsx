import { DashNav } from "@/components/dash-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashNav />
      <main className="flex-1">
        <div className="shell py-10">{children}</div>
      </main>
    </>
  );
}
