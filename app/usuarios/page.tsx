import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import UsuariosPanel from "./UsuariosPanel";

// /usuarios: gestão de usuários — só ADMIN. TEMA CLARO no conteúdo (mesmo
// padrão de /projetos): a cor do tema fica no <main>, nunca no div externo que
// envolve o header (senão ela vaza pro header, que é sempre escuro).
export default async function UsuariosPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/usuarios");
  }
  if (user.permissionLevel !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F4F5F7]">
      <AppHeader />

      <main className="relative mx-auto w-full max-w-[1480px] flex-1 px-6 py-8 text-[#1D1F25] lg:px-8">
        <UsuariosPanel currentUserId={user.id} />
      </main>

      {/* O logo do rodapé é claro — faixa escura pra continuar visível. */}
      <div className="bg-[#0D0D0D]">
        <AppFooter />
      </div>
    </div>
  );
}
