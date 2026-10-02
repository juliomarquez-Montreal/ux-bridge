"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import WireframeEditor from "@/components/WireframeEditor";
import type { ApiBridge } from "../types";
import PageSkeleton from "@/components/PageSkeleton";

// Wrapper client-side do editor de Wireframe em tela cheia — busca o Bridge
// (mesmo padrão de fetch do BridgeDetail) e repassa pro WireframeEditor.
// Existe como componente à parte (em vez de dentro de page.tsx, que é
// Server Component) só porque precisa de estado/efeitos do client.
//
// Wireframe-2: na fase AGUARDANDO_APROVACAO_UX, o mesmo editor é montado
// tanto pro PO quanto pro UX atribuído — só o UX (ou ADMIN) pode editar de
// verdade, o PO fica em modo leitura. `readOnly` é calculado aqui (a partir
// da sessão do usuário atual) e repassado como prop; o servidor reforça a
// mesma regra em cada rota de escrita (ver canEditWireframeContent), então
// isso é só a gate de UI — nunca a única camada de proteção.
export default function WireframeEditorPage({ bridgeId }: { bridgeId: string }) {
  const { data: session, status: sessionStatus } = useSession();
  const [bridge, setBridge] = useState<ApiBridge | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/bridges/${bridgeId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { bridge: ApiBridge }) => setBridge(data.bridge))
      .catch(() => setLoadError("Não foi possível carregar este Bridge."));
  }, [bridgeId]);

  if (loadError) {
    return (
      <div className="grid h-full place-items-center bg-[#f3f3f4]">
        <p className="text-sm text-[#C42B2B]">{loadError}</p>
      </div>
    );
  }
  if (!bridge) {
    return (
      <div className="grid h-full place-items-center bg-[#f3f3f4]">
        <PageSkeleton tone="light" rows={3} />
      </div>
    );
  }

  const isAdmin = session?.user?.permissionLevel === "ADMIN";
  const isAssignedUx = !!session?.user?.id && session.user.id === bridge.uxUserId;
  // Só a fase do UX tem essa gate — na fase do PO, edição continua liberada
  // pra qualquer um com acesso à Galáxia, como sempre foi. Enquanto a sessão
  // ainda carrega (na fase do UX), falha fechado: melhor um instante de UI
  // travada do que deixar editar antes de confirmar quem é.
  const readOnly = bridge.status === "AGUARDANDO_APROVACAO_UX" ? sessionStatus === "loading" || !(isAdmin || isAssignedUx) : false;

  return <WireframeEditor bridge={bridge} onUpdate={setBridge} readOnly={readOnly} />;
}
