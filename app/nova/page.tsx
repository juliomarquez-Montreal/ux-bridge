import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import AbstractBackground from "@/components/AbstractBackground";
import AppFooter from "@/components/AppFooter";
import AppHeader from "@/components/AppHeader";
import NovaPanel from "./NovaPanel";

// NOVA: visualização e gestão da hierarquia de contexto (Universo > Galáxia >
// Estrela > Planeta). Aberta a qualquer usuário autenticado — a árvore
// completa é sempre visível, mas os botões de criar/editar/excluir em cada
// nível respeitam as mesmas regras de permissão já aplicadas pela API
// (app/api/nova/**): aqui só escondemos/desabilitamos visualmente o que o
// usuário não pode fazer, pra não deixar clicar e levar um 403 sem explicação.
export default async function NovaPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/nova");
  }

  return (
    <div className="relative flex min-h-screen flex-col text-luminous-on-surface">
      <AbstractBackground />
      <AppHeader />

      <main className="relative mx-auto w-full max-w-[1440px] px-6 py-10 lg:px-10">
        <NovaPanel
          user={{
            id: user.id,
            permissionLevel: user.permissionLevel,
          }}
        />
      </main>

      <AppFooter />
    </div>
  );
}
