"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GeneratingProgress from "@/components/GeneratingProgress";
import { Btn, Card, Pill, fieldClass, labelClass } from "@/app/projetos/ui";
import { STATUS_LABEL, STATUS_TONE } from "../statusMeta";
import type { ApiBridge } from "../types";
import PageSkeleton from "@/components/PageSkeleton";

const GENERATING_STATUSES: ApiBridge["status"][] = ["GERANDO_BDD", "GERANDO_WIREFRAME"];

// Tela de revisão do Bridge — cobre GERANDO_BDD, AGUARDANDO_APROVACAO_BDD,
// GERANDO_WIREFRAME, FINALIZADO e ERRO_GERACAO. AGUARDANDO_APROVACAO_
// WIREFRAME_PO e AGUARDANDO_APROVACAO_UX são tratados à parte por page.tsx,
// que renderiza o WireframeEditor em tela cheia nesses dois casos (nunca
// chega a montar este componente pra esses status — ver WIREFRAME_EDITING_
// STATUSES lá).
export default function BridgeDetail({ bridgeId }: { bridgeId: string }) {
  const router = useRouter();
  const [bridge, setBridge] = useState<ApiBridge | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/bridges/${bridgeId}`);
    if (!res.ok) throw new Error("not ok");
    const data = (await res.json()) as { bridge: ApiBridge };
    setBridge(data.bridge);
    return data.bridge;
  }, [bridgeId]);

  useEffect(() => {
    refresh().catch(() => setLoadError("Não foi possível carregar este Bridge."));
  }, [refresh]);

  // Enquanto está gerando (BDD ou Wireframe), faz polling — o usuário pode
  // ter chegado aqui recarregando a página enquanto OUTRA aba/sessão
  // disparou a geração. Assim que o Wireframe termina de gerar
  // (AGUARDANDO_APROVACAO_WIREFRAME_PO), força o Next.js a re-renderizar o
  // Server Component da página — é ele quem decide trocar pra casca do
  // WireframeEditor em tela cheia (ver app/bridges/[id]/page.tsx).
  useEffect(() => {
    if (!bridge || !GENERATING_STATUSES.includes(bridge.status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => {
      refresh()
        .then((updated) => {
          if (updated.status === "AGUARDANDO_APROVACAO_WIREFRAME_PO") router.refresh();
        })
        .catch(() => {});
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [bridge, refresh, router]);

  async function handleApprove() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridges/${bridgeId}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao aprovar.");
      setBridge(data.bridge);
      if (data.bridge.status === "AGUARDANDO_APROVACAO_WIREFRAME_PO") router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao aprovar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!rejectComment.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridges/${bridgeId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: rejectComment.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao rejeitar.");
      setBridge(data.bridge);
      setShowRejectForm(false);
      setRejectComment("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao rejeitar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRetry() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridges/${bridgeId}/retry`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao tentar novamente.");
      setBridge(data.bridge);
      if (data.bridge.status === "AGUARDANDO_APROVACAO_WIREFRAME_PO") router.refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao tentar novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="text-sm text-[#C42B2B]">{loadError}</p>;
  if (!bridge) return <PageSkeleton tone="light" />;

  const galaxia = bridge.planet.parent?.parent;
  const estrela = bridge.planet.parent;

  return (
    <div>
      <a href="/bridges" className="text-sm text-[#50545C] transition hover:text-[#8B40F5]">
        ← Voltar para Bridges
      </a>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-[#15161A]">{bridge.planet.name}</h1>
        <Pill tone={STATUS_TONE[bridge.status] === "done" ? "blue" : STATUS_TONE[bridge.status] === "error" ? "red" : "amber"}>{STATUS_LABEL[bridge.status]}</Pill>
      </div>
      <p className="mt-1 text-sm text-[#50545C]">
        {galaxia ? `${galaxia.name} / ` : ""}
        {estrela ? `${estrela.name} / ` : ""}
        {bridge.planet.name}
      </p>

      {actionError && <p className="mt-4 text-sm text-[#C42B2B]">{actionError}</p>}

      {(bridge.status === "GERANDO_BDD" || bridge.status === "GERANDO_WIREFRAME") && (
        <Card className="mt-6 p-6">
          <GeneratingProgress tone="light" label={bridge.status === "GERANDO_BDD" ? "Gerando Bridge Spec..." : "Gerando Wireframe..."} />
          <div className="mt-4 flex justify-end">
            <Btn onClick={() => router.push("/bridges")}>Fechar e continuar depois</Btn>
          </div>
        </Card>
      )}

      {bridge.status === "ERRO_GERACAO" && (
        <Card className="mt-6 border-[#F2B8BA] bg-[#FDF1F1] p-6">
          <p className="text-sm font-semibold text-[#C42B2B]">
            {bridge.bddApprovedAt ? "Falha ao gerar o wireframe" : "Falha ao gerar o Bridge Spec"}
          </p>
          <p className="mt-1 text-sm text-[#50545C]">{bridge.errorMessage ?? "Erro desconhecido."}</p>
          <Btn variant="primary" className="mt-4" onClick={handleRetry} disabled={busy}>
            {busy ? "Tentando..." : "Tentar novamente"}
          </Btn>
        </Card>
      )}

      {/* Revisão do Bridge Spec (BS) */}
      {bridge.status === "AGUARDANDO_APROVACAO_BDD" && (
        <Card className="mt-6 p-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-[#6B6F77]">Bridge Spec gerado</p>
          <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#E6E8EC] bg-[#FAFBFC] p-4 text-sm text-[#1D1F25]">
            {bridge.generatedBddPbi}
          </pre>

          {bridge.attemptCount >= 2 && (
            <p className="mt-4 rounded-lg border border-[#F0DC9E] bg-[#FDF0CC] px-4 py-3 text-sm text-[#8A5A00]">
              Já são {bridge.attemptCount} tentativas — considere editar manualmente (edição manual chega numa fase futura).
            </p>
          )}

          {!showRejectForm ? (
            <div className="mt-4 flex gap-2">
              <Btn variant="primary" onClick={handleApprove} disabled={busy}>
                {busy ? "Confirmando..." : "OK"}
              </Btn>
              <Btn onClick={() => setShowRejectForm(true)} disabled={busy}>
                Rejeitar e comentar
              </Btn>
            </div>
          ) : busy ? (
            <div className="mt-4">
              <GeneratingProgress tone="light" label="Gerando Bridge Spec..." />
            </div>
          ) : (
            <RejectForm
              value={rejectComment}
              onChange={setRejectComment}
              onCancel={() => {
                setShowRejectForm(false);
                setRejectComment("");
              }}
              onSubmit={handleReject}
              busy={busy}
            />
          )}
        </Card>
      )}

      {bridge.status === "FINALIZADO" && (
        <>
          <Card className="mt-6 border-[#BFE5CB] bg-[#EDF9F0] p-6">
            <p className="text-sm font-semibold text-[#1A7A3C]">Wireframe aprovado pelo UX e finalizado.</p>
            <p className="mt-1 text-sm text-[#50545C]">
              O arquivo SVG já foi exportado e está pronto para ser importado dentro do Figma.
            </p>
            {bridge.wireframeExportUrl && (
              <a
                href={bridge.wireframeExportUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-full bg-[#8B40F5] px-4 py-2 font-mono text-xs uppercase tracking-[0.1em] text-white transition hover:bg-[#7B3BF0]"
              >
                Baixar SVG novamente
              </a>
            )}
          </Card>
          <Card className="mt-4 p-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-[#6B6F77]">Bridge Spec final</p>
            <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-[#E6E8EC] bg-[#FAFBFC] p-4 text-sm text-[#1D1F25]">
              {bridge.generatedBddPbi}
            </pre>
          </Card>
        </>
      )}
    </div>
  );
}

function RejectForm({
  value,
  onChange,
  onCancel,
  onSubmit,
  busy,
}: {
  value: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <div className="mt-4 space-y-2">
      <label htmlFor="reject-comment" className={labelClass}>
        O que precisa ser corrigido?
      </label>
      <textarea
        id="reject-comment"
        rows={4}
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ex: os critérios de aceite não cobrem o caso de erro de validação..."
        className={`${fieldClass} resize-none`}
      />
      <div className="flex justify-end gap-2">
        <Btn onClick={onCancel} disabled={busy}>
          Cancelar
        </Btn>
        <Btn variant="primary" onClick={onSubmit} disabled={busy || !value.trim()}>
          {busy ? "Enviando..." : "Rejeitar e gerar de novo"}
        </Btn>
      </div>
    </div>
  );
}
