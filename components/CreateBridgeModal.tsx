"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GeneratingProgress from "@/components/GeneratingProgress";
import PillButton from "@/components/PillButton";
import { CloseIcon } from "@/components/icons";
import { flattenTree } from "@/app/nova/clientPermissions";
import type { ApiContextNode, ApiPlanetType, ApiUserGalaxy } from "@/app/nova/types";

type Step = "select" | "material";
type MaterialMode = "text" | "file";

// Modal de criação de um Bridge (Bridge-1), em duas etapas:
// 1) Estrela + Planeta, escopados à Galáxia atual do header (currentGalaxyId)
//    — nunca pergunta Universo/Galáxia de novo, já está fixado lá.
// 2) Arquivo de texto (upload OU colar), igual ao padrão já usado na NOVA.
// Ao confirmar a etapa 2, cria o Bridge e a geração roda dentro da própria
// requisição — fechar o modal não perde o progresso (o registro já existe
// no banco antes da chamada à IA).
export default function CreateBridgeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("select");

  const [tree, setTree] = useState<ApiContextNode[] | null>(null);
  // undefined = ainda carregando; null = usuário não tem Galáxia selecionada.
  const [currentGalaxyId, setCurrentGalaxyId] = useState<string | null | undefined>(undefined);
  const [planetTypes, setPlanetTypes] = useState<ApiPlanetType[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedEstrelaId, setSelectedEstrelaId] = useState<string | null>(null);
  const [selectedPlanetaId, setSelectedPlanetaId] = useState<string | null>(null);

  const [newEstrelaName, setNewEstrelaName] = useState("");
  const [creatingEstrela, setCreatingEstrela] = useState(false);
  const [newPlanetaName, setNewPlanetaName] = useState("");
  const [newPlanetaTypeId, setNewPlanetaTypeId] = useState("");
  const [creatingPlaneta, setCreatingPlaneta] = useState(false);

  const [materialMode, setMaterialMode] = useState<MaterialMode>("text");
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialText, setMaterialText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Evita setState depois que o usuário clica "Fechar e continuar depois" e
  // o modal desmonta enquanto a geração (fetch em andamento) ainda não voltou.
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  async function refreshTree(): Promise<ApiContextNode[]> {
    const res = await fetch("/api/nova/nodes");
    if (!res.ok) throw new Error("Falha ao carregar a hierarquia.");
    const data = (await res.json()) as { tree: ApiContextNode[] };
    setTree(data.tree);
    return data.tree;
  }

  useEffect(() => {
    Promise.all([
      refreshTree(),
      fetch("/api/nova/users/me/galaxies").then((r) => r.json()) as Promise<{
        galaxies: ApiUserGalaxy[];
        currentGalaxyId: string | null;
      }>,
      fetch("/api/nova/planet-types").then((r) => r.json()) as Promise<{ planetTypes: ApiPlanetType[] }>,
    ])
      .then(([, galaxyData, planetTypeData]) => {
        setCurrentGalaxyId(galaxyData.currentGalaxyId);
        setPlanetTypes(planetTypeData.planetTypes);
      })
      .catch(() => setLoadError("Não foi possível carregar os dados. Tente novamente."));
  }, []);

  const byId = useMemo(() => flattenTree(tree ?? []), [tree]);
  const galaxyNode = currentGalaxyId ? (byId.get(currentGalaxyId) ?? null) : null;
  const estrelas = galaxyNode?.children ?? [];
  const selectedEstrela = selectedEstrelaId ? (byId.get(selectedEstrelaId) ?? null) : null;
  const planetas = selectedEstrela?.children ?? [];

  async function handleCreateEstrela() {
    if (!newEstrelaName.trim() || !currentGalaxyId) return;
    setCreatingEstrela(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/nova/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ESTRELA", name: newEstrelaName.trim(), parentId: currentGalaxyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar Estrela.");
      await refreshTree();
      setSelectedEstrelaId(data.node.id);
      setNewEstrelaName("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Falha ao criar Estrela.");
    } finally {
      setCreatingEstrela(false);
    }
  }

  async function handleCreatePlaneta() {
    if (!newPlanetaName.trim() || !newPlanetaTypeId || !selectedEstrelaId) return;
    setCreatingPlaneta(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/nova/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "PLANETA",
          name: newPlanetaName.trim(),
          parentId: selectedEstrelaId,
          planetTypeId: newPlanetaTypeId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar Planeta.");
      await refreshTree();
      setSelectedPlanetaId(data.node.id);
      setNewPlanetaName("");
      setNewPlanetaTypeId("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Falha ao criar Planeta.");
    } finally {
      setCreatingPlaneta(false);
    }
  }

  async function handleSubmitMaterial() {
    if (!selectedPlanetaId) return;
    if (materialMode === "text" && !materialText.trim()) return;
    if (materialMode === "file" && !materialFile) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.append("planetContextNodeId", selectedPlanetaId);
      if (materialMode === "file" && materialFile) formData.append("file", materialFile);
      else formData.append("textContent", materialText.trim());

      const res = await fetch("/api/bridges", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      // Se o usuário já clicou "Fechar e continuar depois" e navegou pra
      // /bridges, não force outra navegação quando esta resposta chegar.
      if (!mountedRef.current) return;
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar o Bridge.");
      onClose();
      router.push(`/bridges/${data.bridge.id}`);
    } catch (err) {
      if (!mountedRef.current) return;
      setSubmitError(err instanceof Error ? err.message : "Falha ao criar o Bridge.");
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  }

  // O Bridge já foi criado no banco (status GERANDO_BDD) antes da resposta
  // desta requisição voltar — fechar e sair pra /bridges não perde nada, a
  // geração continua no servidor independente do cliente estar conectado.
  function handleCloseAndContinueLater() {
    onClose();
    router.push("/bridges");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-luminous-surface-container p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-sora text-lg font-semibold">Criar novo Bridge</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-luminous-on-surface-variant hover:text-luminous-on-surface"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {loadError && <p className="mb-3 text-sm text-luminous-error">{loadError}</p>}

        {currentGalaxyId === undefined ? (
          <p className="text-sm text-luminous-on-surface-variant">Carregando...</p>
        ) : currentGalaxyId === null ? (
          <p className="text-sm text-luminous-on-surface-variant">
            Selecione uma Galáxia no seletor do header antes de criar um Bridge.
          </p>
        ) : step === "select" ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
                Estrela
              </p>
              {estrelas.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {estrelas.map((estrela) => (
                    <button
                      key={estrela.id}
                      type="button"
                      onClick={() => {
                        setSelectedEstrelaId(estrela.id);
                        setSelectedPlanetaId(null);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm transition ${
                        selectedEstrelaId === estrela.id
                          ? "border-luminous-primary bg-luminous-primary/15 text-luminous-on-surface"
                          : "border-white/10 bg-white/5 text-luminous-on-surface-variant hover:bg-white/10"
                      }`}
                    >
                      {estrela.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newEstrelaName}
                  onChange={(event) => setNewEstrelaName(event.target.value)}
                  placeholder="Nova Estrela..."
                  className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
                />
                <PillButton
                  type="button"
                  variant="inactive"
                  onClick={handleCreateEstrela}
                  disabled={!newEstrelaName.trim() || creatingEstrela}
                >
                  {creatingEstrela ? "Criando..." : "Criar"}
                </PillButton>
              </div>
            </div>

            {selectedEstrelaId && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
                  Planeta
                </p>
                {planetas.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {planetas.map((planeta) => (
                      <button
                        key={planeta.id}
                        type="button"
                        onClick={() => setSelectedPlanetaId(planeta.id)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          selectedPlanetaId === planeta.id
                            ? "border-luminous-primary bg-luminous-primary/15 text-luminous-on-surface"
                            : "border-white/10 bg-white/5 text-luminous-on-surface-variant hover:bg-white/10"
                        }`}
                      >
                        {planeta.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newPlanetaName}
                    onChange={(event) => setNewPlanetaName(event.target.value)}
                    placeholder="Novo Planeta..."
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
                  />
                  {planetTypes === null ? (
                    <p className="text-xs text-luminous-on-surface-variant">Carregando tipos...</p>
                  ) : (
                    <select
                      value={newPlanetaTypeId}
                      onChange={(event) => setNewPlanetaTypeId(event.target.value)}
                      style={{ colorScheme: "dark" }}
                      className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
                    >
                      <option value="" className="bg-luminous-surface-container text-luminous-on-surface-variant">
                        Tipo de Planeta...
                      </option>
                      {planetTypes.map((pt) => (
                        <option key={pt.id} value={pt.id} className="bg-luminous-surface-container text-luminous-on-surface">
                          {pt.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <PillButton
                    type="button"
                    variant="inactive"
                    onClick={handleCreatePlaneta}
                    disabled={!newPlanetaName.trim() || !newPlanetaTypeId || creatingPlaneta}
                  >
                    {creatingPlaneta ? "Criando..." : "Criar Planeta"}
                  </PillButton>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <PillButton type="button" variant="inactive" onClick={onClose}>
                Cancelar
              </PillButton>
              <PillButton type="button" variant="primary" disabled={!selectedPlanetaId} onClick={() => setStep("material")}>
                Continuar
              </PillButton>
            </div>
          </div>
        ) : submitting ? (
          <div className="space-y-4">
            <GeneratingProgress label="Gerando Bridge Spec (BS)..." />
            <div className="flex justify-end pt-2">
              <PillButton type="button" variant="inactive" onClick={handleCloseAndContinueLater}>
                Fechar e continuar depois
              </PillButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.05em] text-luminous-on-surface-variant">
                Arquivo de texto
              </p>
              <p className="mt-1 text-xs text-luminous-on-surface-variant">
                Pode ser uma transcrição, anotações, rascunho ou qualquer material de texto bruto.
              </p>
            </div>

            <div className="flex gap-2">
              <PillButton
                type="button"
                variant={materialMode === "text" ? "primary" : "inactive"}
                onClick={() => setMaterialMode("text")}
              >
                Colar texto
              </PillButton>
              <PillButton
                type="button"
                variant={materialMode === "file" ? "primary" : "inactive"}
                onClick={() => setMaterialMode("file")}
              >
                Anexar arquivo
              </PillButton>
            </div>

            {materialMode === "text" ? (
              <textarea
                rows={8}
                autoFocus
                value={materialText}
                onChange={(event) => setMaterialText(event.target.value)}
                placeholder="Cole o texto aqui..."
                className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary"
              />
            ) : (
              <div>
                <input
                  type="file"
                  accept=".txt,.docx"
                  onChange={(event) => setMaterialFile(event.target.files?.[0] ?? null)}
                  className="w-full text-sm text-luminous-on-surface-variant"
                />
                <p className="mt-1 text-[11px] text-luminous-on-surface-variant/70">Arquivo .txt ou .docx, máx. 5MB.</p>
              </div>
            )}

            {submitError && <p className="text-sm text-luminous-error">{submitError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <PillButton type="button" variant="inactive" onClick={() => setStep("select")}>
                Voltar
              </PillButton>
              <PillButton
                type="button"
                variant="primary"
                disabled={materialMode === "text" ? !materialText.trim() : !materialFile}
                onClick={handleSubmitMaterial}
              >
                Criar Bridge
              </PillButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
