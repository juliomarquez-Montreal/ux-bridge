import AbstractBackground from "@/components/AbstractBackground";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import DashboardPanel from "./DashboardPanel";

// Dashboard (Home): números reais do sistema — ver DashboardPanel e
// app/api/dashboard. (A rota exige login pelo middleware.)
export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
      <AbstractBackground />

      <AppHeader />

      <main className="relative mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-6 py-10 lg:px-8">
        <DashboardPanel />
      </main>

      <AppFooter />
    </div>
  );
}
