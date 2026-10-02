import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import WireframesPanel from "./WireframesPanel";

// /wireframes: biblioteca dos Wireframes já gerados (Bridges com Wireframe),
// restrita às Galáxias do usuário (ADMIN vê todos) — ver app/api/wireframes.
export default async function WireframesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/wireframes");
  }

  return (
    // TEMA CLARO só no conteúdo (mesmo padrão de /projetos) — ver /bridges.
    <div className="relative flex min-h-screen flex-col bg-[#F4F5F7]">
      <AppHeader />

      <main className="relative mx-auto w-full max-w-[1440px] flex-1 px-6 py-10 text-[#1D1F25] lg:px-10">
        <WireframesPanel />
      </main>

      <div className="bg-[#0D0D0D]">
        <AppFooter />
      </div>
    </div>
  );
}
