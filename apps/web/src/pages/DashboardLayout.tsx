import { Outlet } from "react-router-dom";
import { DashboardHeader } from "../components/layout/DashboardHeader";

export function DashboardLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
