"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import GlassCard from "@/components/GlassCard";
import { STATUS_BADGE_VARIANT, STATUS_LABEL } from "./statusMeta";
import type { ApiBridgeListItem } from "./types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function BridgesPanel() {
  const router = useRouter();
  const [bridges, setBridges] = useState<ApiBridgeListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/bridges")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { bridges: ApiBridgeListItem[] }) => setBridges(data.bridges))
      .catch(() => setLoadError("Não foi possível carregar os Bridges. Tente recarregar a página."));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold text-white">Bridges</h1>
      <p className="mt-1 text-sm text-luminous-on-surface-variant">
        Acompanhe a criação de cada Bridge, do material bruto até o BDD/PBI aprovado.
      </p>

      {loadError && <p className="mt-6 text-sm text-luminous-error">{loadError}</p>}

      {!loadError && bridges === null && (
        <p className="mt-6 text-sm text-luminous-on-surface-variant">Carregando...</p>
      )}

      {!loadError && bridges !== null && bridges.length === 0 && (
        <GlassCard className="mt-6 text-center text-sm text-luminous-on-surface-variant">
          Nenhum Bridge criado ainda. Use o botão &quot;Criar novo Bridge&quot; no topo da página.
        </GlassCard>
      )}

      {!loadError && bridges !== null && bridges.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-[.05em] text-luminous-on-surface-variant">
                <th className="px-4 py-3 font-medium">Planeta</th>
                <th className="px-4 py-3 font-medium">Estrela</th>
                <th className="px-4 py-3 font-medium">Galáxia</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {bridges.map((bridge) => (
                <tr
                  key={bridge.id}
                  onClick={() => router.push(`/bridges/${bridge.id}`)}
                  className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/5"
                >
                  <td className="px-4 py-3 text-luminous-on-surface">{bridge.planeta.name}</td>
                  <td className="px-4 py-3 text-luminous-on-surface-variant">{bridge.estrela?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-luminous-on-surface-variant">{bridge.galaxia?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE_VARIANT[bridge.status]}>{STATUS_LABEL[bridge.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-luminous-on-surface-variant">{formatDate(bridge.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
