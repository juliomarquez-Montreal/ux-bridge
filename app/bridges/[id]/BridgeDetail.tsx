"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import GeneratingProgress from "@/components/GeneratingProgress";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import SketchEditor from "@/components/SketchEditor";
import SketchPreview from "@/components/SketchPreview";
import { STATUS_BADGE_VARIANT, STATUS_LABEL } from "../statusMeta";
import type { ApiBridge } from "../types";

// Depois de 2 tentativas rejeitadas do Sketch, destaca o aviso pra editar
// manualmente (Bridge-3b) — o botão em si já fica disponível desde a
// primeira geração, isso só chama mais atenção pra essa alternativa.
const MANUAL_EDIT_HINT_THRESHOLD = 2;

const GENERATING_STATUSES: ApiBridge["status"][] = ["GERANDO_BDD", "GERANDO_SKETCH"];

export default function BridgeDetail({ bridgeId }: { bridgeId: string }) {
  const router = useRouter();
  const [bridge, setBridge] = useState<ApiBridge | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
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

  // Enquanto está gerando (BDD ou Sketch), faz polling — o usuário pode ter
  // chegado aqui recarregando a página enquanto OUTRA aba/sessão disparou a
  // geração.
  useEffect(() => {
    if (!bridge || !GENERATING_STATUSES.includes(bridge.status)) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => {
      refresh().catch(() => {});
    }, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [bridge, refresh]);

  async function handleApprove() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/bridges/${bridgeId}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao aprovar.");
      setBridge(data.bridge);
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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao tentar novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="text-sm text-luminous-error">{loadError}</p>;
  if (!bridge) return <p className="text-sm text-luminous-on-surface-variant">Carregando...</p>;

  const galaxia = bridge.planet.parent?.parent;
  const estrela = bridge.planet.parent;

  return (
    <div>
      <a href="/bridges" className="text-sm text-luminous-on-surface-variant hover:text-luminous-on-surface">
        ← Voltar para Bridges
      </a>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white">{bridge.planet.name}</h1>
        <Badge variant={STATUS_BADGE_VARIANT[bridge.status]}>{STATUS_LABEL[bridge.status]}</Badge>
      </div>
      <p className="mt-1 text-sm text-luminous-on-surface-variant">
        {galaxia ? `${galaxia.name} / ` : ""}
        {estrela ? `${estrela.name} / ` : ""}
        {bridge.planet.name}
      </p>

      {actionError && <p className="mt-4 text-sm text-luminous-error">{actionError}</p>}

      {(bridge.status === "GERANDO_BDD" || bridge.status === "GERANDO_SKETCH") && (
        <GlassCard className="mt-6">
          <GeneratingProgress label={bridge.status === "GERANDO_BDD" ? "Gerando BDD/PBI..." : "Gerando sketch..."} />
          <div className="mt-4 flex justify-end">
            <PillButton type="button" variant="inactive" onClick={() => router.push("/bridges")}>
              Fechar e continuar depois
            </PillButton>
          </div>
        </GlassCard>
      )}

      {bridge.status === "ERRO_GERACAO" && (
        <GlassCard className="mt-6">
          <p className="text-sm font-medium text-luminous-error">
            {bridge.bddApprovedAt ? "Falha ao gerar o sketch" : "Falha ao gerar o BDD/PBI"}
          </p>
          <p className="mt-1 text-sm text-luminous-on-surface-variant">
            {bridge.errorMessage ?? "Erro desconhecido."}
          </p>
          <PillButton type="button" variant="primary" className="mt-4" onClick={handleRetry} disabled={busy}>
            {busy ? "Tentando..." : "Tentar novamente"}
          </PillButton>
        </GlassCard>
      )}

      {/* Passo 1 de 2 — texto do BDD/PBI */}
      {bridge.status === "AGUARDANDO_APROVACAO_BDD" && (
        <GlassCard className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
            Passo 1 de 2 · BDD/PBI gerado
          </p>
          <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-luminous-on-surface">
            {bridge.generatedBddPbi}
          </pre>

          {bridge.attemptCount >= MANUAL_EDIT_HINT_THRESHOLD && (
            <p className="mt-4 rounded-lg border border-[#ffb688]/30 bg-[#ffb688]/10 px-4 py-3 text-sm text-[#ffb688]">
              Já são {bridge.attemptCount} tentativas — considere editar manualmente (edição manual chega numa fase futura).
            </p>
          )}

          {!showRejectForm ? (
            <div className="mt-4 flex gap-2">
              <PillButton type="button" variant="primary" onClick={handleApprove} disabled={busy}>
                {busy ? "Confirmando..." : "OK"}
              </PillButton>
              <PillButton type="button" variant="inactive" onClick={() => setShowRejectForm(true)} disabled={busy}>
                Rejeitar e comentar
              </PillButton>
            </div>
          ) : busy ? (
            <div className="mt-4">
              <GeneratingProgress label="Gerando BDD/PBI..." />
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
        </GlassCard>
      )}

      {/* Passo 2 de 2 — sketch */}
      {bridge.status === "AGUARDANDO_APROVACAO_SKETCH" && (
        <GlassCard className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
            Passo 2 de 2 · Sketch gerado
          </p>
          <SketchPreview sketchData={bridge.sketchData} />

          {bridge.sketchAttemptCount >= MANUAL_EDIT_HINT_THRESHOLD && (
            <div className="mt-4 rounded-lg border border-[#ffb688]/30 bg-[#ffb688]/10 px-4 py-3">
              <p className="text-sm text-[#ffb688]">
                Já são {bridge.sketchAttemptCount} tentativas — considere editar manualmente.
              </p>
              <PillButton type="button" variant="inactive" className="mt-3" onClick={() => setEditorOpen(true)} disabled={busy}>
                Editar manualmente
              </PillButton>
            </div>
          )}

          {!showRejectForm ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <PillButton type="button" variant="primary" onClick={handleApprove} disabled={busy}>
                {busy ? "Aprovando..." : "Aprovar"}
              </PillButton>
              <PillButton type="button" variant="inactive" onClick={() => setShowRejectForm(true)} disabled={busy}>
                Rejeitar e comentar
              </PillButton>
              <PillButton type="button" variant="inactive" onClick={() => setEditorOpen(true)} disabled={busy}>
                Editar manualmente
              </PillButton>
            </div>
          ) : busy ? (
            <div className="mt-4">
              <GeneratingProgress label="Gerando sketch..." />
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
        </GlassCard>
      )}

      {bridge.status === "AGUARDANDO_WIREFRAME" && (
        <>
          <GlassCard className="mt-6 border-emerald-300/30 bg-emerald-300/5">
            <p className="text-sm font-medium text-emerald-200">BDD/PBI e Sketch aprovados.</p>
            <p className="mt-1 text-sm text-luminous-on-surface-variant">
              A geração de wireframe estará disponível em uma futura atualização — você será notificado quando estiver
              pronta.
            </p>
          </GlassCard>
          <GlassCard className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
              BDD/PBI final
            </p>
            <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-luminous-on-surface">
              {bridge.generatedBddPbi}
            </pre>
          </GlassCard>
          <GlassCard className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
              Sketch final
            </p>
            <SketchPreview sketchData={bridge.sketchData} />
          </GlassCard>
        </>
      )}

      {editorOpen && bridge.status === "AGUARDANDO_APROVACAO_SKETCH" && (
        <SketchEditor
          bridgeId={bridge.id}
          initialSketchData={bridge.sketchData}
          onClose={() => setEditorOpen(false)}
          onSaved={(updated) => {
            setBridge(updated);
            setEditorOpen(false);
          }}
        />
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
      <label
        htmlFor="reject-comment"
        className="block text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant"
      >
        O que precisa ser corrigido?
      </label>
      <textarea
        id="reject-comment"
        rows={4}
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ex: os critérios de aceite não cobrem o caso de erro de validação..."
        className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
      />
      <div className="flex justify-end gap-2">
        <PillButton type="button" variant="inactive" onClick={onCancel} disabled={busy}>
          Cancelar
        </PillButton>
        <PillButton type="button" variant="primary" onClick={onSubmit} disabled={busy || !value.trim()}>
          {busy ? "Enviando..." : "Rejeitar e gerar de novo"}
        </PillButton>
      </div>
    </div>
  );
}
