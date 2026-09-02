"use client";

import { useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import Badge from "@/components/Badge";
import Switch from "@/components/Switch";

type ProviderKey = "gemini" | "openai" | "claude";

interface EngineRow {
  provider: ProviderKey;
  enabled: boolean;
  hasKey: boolean;
  apiKeyMasked: string | null;
  updatedAt: string | null;
}

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  openai: "ChatGPT API",
  claude: "Claude API",
  gemini: "Gemini API",
};

const PROVIDER_ORDER: ProviderKey[] = ["openai", "claude", "gemini"];

async function fetchEngines(): Promise<Record<ProviderKey, EngineRow>> {
  const res = await fetch("/api/admin/settings/engine");
  if (!res.ok) throw new Error("Falha ao carregar engines.");
  const data = (await res.json()) as { engines: EngineRow[] };
  return Object.fromEntries(data.engines.map((e) => [e.provider, e])) as Record<ProviderKey, EngineRow>;
}

export default function EnginePanel() {
  const [engines, setEngines] = useState<Record<ProviderKey, EngineRow> | null>(null);
  const [drafts, setDrafts] = useState<Record<ProviderKey, string>>({ gemini: "", openai: "", claude: "" });
  const [savingProvider, setSavingProvider] = useState<ProviderKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEngines()
      .then(setEngines)
      .catch(() => setError("Não foi possível carregar as configurações de engine."));
  }, []);

  async function persist(body: { provider: ProviderKey; apiKey?: string; enabled?: boolean }) {
    const res = await fetch("/api/admin/settings/engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Falha ao salvar.");
  }

  async function handleToggle(provider: ProviderKey, nextEnabled: boolean) {
    if (!engines) return;
    setError(null);

    // Feedback imediato: desliga visualmente os outros dois antes da resposta do servidor.
    setEngines((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      for (const key of PROVIDER_ORDER) {
        next[key] = { ...next[key], enabled: key === provider ? nextEnabled : nextEnabled ? false : next[key].enabled };
      }
      return next;
    });

    try {
      await persist({ provider, enabled: nextEnabled });
    } catch {
      setError("Não foi possível atualizar o engine ativo. Tentando recarregar...");
      fetchEngines().then(setEngines).catch(() => {});
    }
  }

  async function handleSave(provider: ProviderKey) {
    const apiKey = drafts[provider].trim();
    if (!apiKey) return;

    setSavingProvider(provider);
    setError(null);
    try {
      await persist({ provider, apiKey });
      const updated = await fetchEngines();
      setEngines(updated);
      setDrafts((prev) => ({ ...prev, [provider]: "" }));
    } catch {
      setError("Não foi possível salvar a chave. Tente novamente.");
    } finally {
      setSavingProvider(null);
    }
  }

  if (error && !engines) {
    return <p className="text-sm text-luminous-error">{error}</p>;
  }

  if (!engines) {
    return <p className="text-sm text-luminous-on-surface-variant">Carregando engines...</p>;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-luminous-error">{error}</p>}

      {PROVIDER_ORDER.map((provider) => {
        const row = engines[provider];
        return (
          <GlassCard key={provider} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-sora text-base font-semibold">{PROVIDER_LABELS[provider]}</h3>
                <p className="mt-1 font-mono text-xs text-luminous-on-surface-variant">
                  {row.apiKeyMasked ?? "Nenhuma chave salva"}
                </p>
              </div>
              {row.enabled && <Badge variant="success">Ativo</Badge>}
            </div>

            <div className="flex flex-1 items-center gap-3 sm:justify-end">
              <input
                type="password"
                placeholder="Colar nova chave de API"
                value={drafts[provider]}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [provider]: e.target.value }))}
                className="w-full max-w-xs rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-luminous-primary sm:w-56"
              />
              <PillButton
                type="button"
                variant="secondary"
                onClick={() => handleSave(provider)}
                disabled={savingProvider === provider || !drafts[provider].trim()}
              >
                {savingProvider === provider ? "Salvando..." : "Salvar"}
              </PillButton>
              <Switch
                checked={row.enabled}
                onChange={(checked) => handleToggle(provider, checked)}
                ariaLabel={`Ativar ${PROVIDER_LABELS[provider]}`}
              />
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
