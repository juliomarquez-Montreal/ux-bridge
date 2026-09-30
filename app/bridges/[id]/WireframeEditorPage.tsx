"use client";

import { useEffect, useState } from "react";
import WireframeEditor from "@/components/WireframeEditor";
import type { ApiBridge } from "../types";

// Wrapper client-side do editor de Wireframe em tela cheia — busca o Bridge
// (mesmo padrão de fetch do BridgeDetail) e repassa pro WireframeEditor.
// Existe como componente à parte (em vez de dentro de page.tsx, que é
// Server Component) só porque precisa de estado/efeitos do client.
export default function WireframeEditorPage({ bridgeId }: { bridgeId: string }) {
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
        <p className="text-sm text-luminous-error">{loadError}</p>
      </div>
    );
  }
  if (!bridge) {
    return (
      <div className="grid h-full place-items-center bg-[#f3f3f4]">
        <p className="text-sm text-[#55555b]">Carregando...</p>
      </div>
    );
  }

  return <WireframeEditor bridge={bridge} onUpdate={setBridge} />;
}
