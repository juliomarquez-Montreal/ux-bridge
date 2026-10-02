"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Badge from "@/components/Badge";
import BarChart from "@/components/BarChart";
import GlassCard from "@/components/GlassCard";
import KpiCard from "@/components/KpiCard";
import LineChart from "@/components/LineChart";
import PillButton from "@/components/PillButton";
import Skeleton from "@/components/Skeleton";
import TabGroup from "@/components/TabGroup";
import { PROJECT_STATUS_LABEL } from "@/app/projetos/statusMeta";
import type { ProjectStatus } from "@/app/projetos/types";

interface DashboardData {
  galaxies: { id: string; name: string }[];
  totalBridgesVisible: number;
  prioritySamples: number;
  efficiency: { label: string; days: number | null; samples: number }[];
  stageTimes: Record<"spec" | "wireframePo" | "wireframeUx", { avgMs: number | null; samples: number }>;
  delivery: { pct: number | null; total: number; finalized: number; trend: number | null };
  flows: { active: number; bars: { label: string; count: number }[] };
  projects: {
    id: string;
    code: string;
    name: string;
    status: ProjectStatus;
    galaxyNames: string[];
    bridgeCount: number;
    finalizedCount: number;
    progressPct: number;
    updatedAt: string;
  }[];
}

const PERIOD_OPTIONS = [
  { value: "all", label: "Todo o período" },
  { value: "month", label: "Este mês" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "year", label: "Este ano" },
];
const PRIORITY_OPTIONS = [
  { value: "", label: "Qualquer prioridade" },
  { value: "ALTA", label: "Prioridade Alta" },
  { value: "MEDIA", label: "Prioridade Média" },
  { value: "BAIXA", label: "Prioridade Baixa" },
];
const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "ACTIVE", label: "Em Andamento" },
  { value: "DONE", label: "Finalizados" },
];

const STAGE_TABS = ["Bridge Spec", "Wireframe PO", "Wireframe UX"] as const;
type StageTab = (typeof STAGE_TABS)[number];
const STAGE_KEY: Record<StageTab, keyof DashboardData["stageTimes"]> = {
  "Bridge Spec": "spec",
  "Wireframe PO": "wireframePo",
  "Wireframe UX": "wireframeUx",
};

// Duração média legível: "3 min", "5 h", "2,4 dias".
function formatDuration(ms: number | null): { value: string; unit: string } {
  if (ms === null) return { value: "—", unit: "sem dados" };
  const minutes = ms / 60000;
  if (minutes < 1) return { value: "<1", unit: "min" };
  if (minutes < 60) return { value: String(Math.round(minutes)), unit: "min" };
  const hours = minutes / 60;
  if (hours < 48) return { value: hours < 10 ? hours.toFixed(1).replace(".", ",") : String(Math.round(hours)), unit: "h" };
  const days = hours / 24;
  return { value: days < 10 ? days.toFixed(1).replace(".", ",") : String(Math.round(days)), unit: "dias" };
}

function durationText(ms: number): string {
  const { value, unit } = formatDuration(ms);
  return `${value} ${unit}`;
}

const RELATIVE = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
function relativeTime(iso: string): string {
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return "agora mesmo";
  if (abs < 3600) return RELATIVE.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return RELATIVE.format(Math.round(diff / 3600), "hour");
  return RELATIVE.format(Math.round(diff / 86400), "day");
}

function ProgressRing({ value, color = "#9457DF" }: { value: number; color?: string }) {
  return (
    <div className="relative grid h-16 w-16 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#37333c" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.9"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${value} 100`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
      </svg>
      <span className="font-sora text-sm font-semibold">{value}%</span>
    </div>
  );
}

// Pílula de filtro: <select> nativo estilizado como o PillButton secundário.
function PillSelect({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ colorScheme: "dark" }}
        className="cursor-pointer appearance-none rounded-full border border-luminous-primary/50 bg-luminous-primary/10 py-2 pl-4 pr-9 font-mono text-xs uppercase tracking-[0.1em] text-luminous-on-surface outline-none transition hover:bg-luminous-primary/20 focus:border-luminous-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-luminous-surface-container normal-case text-luminous-on-surface">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-luminous-on-surface-variant">⌄</span>
    </div>
  );
}

const PROJECT_ICONS = [
  { glyph: "ϟ", bg: "bg-luminous-primary text-luminous-on-primary", ring: "#9457DF" },
  { glyph: "⌘", bg: "bg-luminous-secondary text-luminous-on-secondary", ring: "#0077ff" },
];

// Dashboard (Home) com números REAIS — ver app/api/dashboard/route.ts pra regra
// de cada métrica. Os gráficos/cards mantêm a forma visual original.
export default function DashboardPanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState("all");
  const [galaxyId, setGalaxyId] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [stageTab, setStageTab] = useState<StageTab>("Bridge Spec");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (galaxyId) params.set("galaxyId", galaxyId);
    if (priority) params.set("priority", priority);
    if (status) params.set("status", status);
    fetch(`/api/dashboard?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: DashboardData) => {
        if (cancelled) return;
        setData(json);
        setError(false);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [period, galaxyId, priority, status]);

  const filtersActive = period !== "all" || galaxyId !== "" || priority !== "" || status !== "";
  const dim = loading && data ? "opacity-60" : "opacity-100";

  const stage = data?.stageTimes[STAGE_KEY[stageTab]];
  const efficiencyPoints =
    data?.efficiency.map((m) => ({
      label: m.label,
      value: m.days,
      tooltip: m.days === null ? `${m.label}: sem dados` : `${m.label}: ${durationText(m.days * 86400000)} em média (${m.samples} Bridge(s))`,
    })) ?? [];
  const lastEfficiency = [...(data?.efficiency ?? [])].reverse().find((m) => m.days !== null);

  return (
    <>
      <section className="grid gap-6 lg:grid-cols-12">
        <div className="flex min-h-[420px] flex-col justify-between lg:col-span-7">
          <div className="flex flex-wrap items-center gap-3">
            <Image src="/logo-ux-bridge.png" alt="UX Bridge" width={1749} height={333} priority className="h-auto w-[280px] sm:w-[380px]" />
            <sup className="align-top font-mono text-base tracking-normal text-luminous-primary">&#123;PO&#125;</sup>
          </div>
          <GlassCard className="mt-10 min-h-64 overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.1em] text-luminous-on-surface-variant">Métrica principal · últimos 6 meses</p>
                <h3 className="font-sora text-lg font-semibold">Eficiência de Requisitos (Dias)</h3>
              </div>
              <span className="text-right font-mono text-xs text-luminous-primary" title="Média do mês mais recente com dados">
                {lastEfficiency?.days != null ? `${durationText(lastEfficiency.days * 86400000)} (${lastEfficiency.label})` : ""}
              </span>
            </div>
            {data === null ? (
              <Skeleton className="h-40 w-full rounded-lg" />
            ) : (
              <div className={`transition-opacity duration-300 ${dim}`}>
                <div className="grid h-40 grid-cols-[auto_1fr] gap-4">
                  <div className="flex flex-col justify-between pb-6 font-mono text-[10px] uppercase text-luminous-on-surface-variant">
                    <span>Lento</span>
                    <span>Rápido</span>
                  </div>
                  <LineChart points={efficiencyPoints} ariaLabel="Dias médios entre criar o Bridge e aprovar o Bridge Spec, por mês" />
                </div>
                <div className="ml-12 flex justify-between font-mono text-[10px] uppercase tracking-[.1em] text-luminous-on-surface-variant">
                  {data.efficiency.map((m) => (
                    <span key={m.label}>{m.label}</span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-3 text-[11px] text-luminous-on-surface-variant">Tempo médio entre criar o Bridge e aprovar o Bridge Spec (BS), por mês de criação.</p>
          </GlassCard>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <GlassCard>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.1em] text-luminous-on-surface-variant">Média atual</p>
                <h3 className="font-sora text-lg font-semibold">Tempo de Levantamento</h3>
              </div>
              <span className="text-luminous-primary">↘</span>
            </div>
            <div className={`mb-6 grid grid-cols-3 gap-4 transition-opacity duration-300 ${dim}`}>
              {STAGE_TABS.map((tab) => {
                const t = data?.stageTimes[STAGE_KEY[tab]];
                const { value, unit } = formatDuration(t?.avgMs ?? null);
                return (
                  <div key={tab} className={`transition-opacity ${tab === stageTab ? "opacity-100" : "opacity-50"}`}>
                    <KpiCard title={tab} value={data ? value : "…"} unit={data ? unit : undefined} />
                  </div>
                );
              })}
            </div>
            <TabGroup tabs={[...STAGE_TABS]} activeTab={stageTab} onTabChange={(tab) => setStageTab(tab as StageTab)} />
            <p className="mt-3 text-[11px] text-luminous-on-surface-variant">
              {stage ? `${stage.samples} Bridge(s) medido(s) nesta etapa.` : ""}
              {stage && stage.samples === 0 && stageTab !== "Bridge Spec" ? " O histórico dessa etapa começou com o módulo Atividades." : ""}
            </p>
          </GlassCard>

          <div className="grid gap-6 sm:grid-cols-2">
            <GlassCard className="min-h-56">
              <h3 className="text-sm text-luminous-on-surface-variant">Entrega de Wireframes</h3>
              <div className="mt-5 flex items-end gap-2">
                <strong className="font-sora text-4xl">{data ? (data.delivery.pct === null ? "—" : `${data.delivery.pct}%`) : "…"}</strong>
                {data?.delivery.trend != null && (
                  <span className="mb-1 font-mono text-xs text-luminous-primary" title="Diferença para o período anterior">
                    {data.delivery.trend > 0 ? "+" : ""}
                    {data.delivery.trend} p.p.
                  </span>
                )}
              </div>
              <div className="mt-7 flex justify-between text-xs text-luminous-on-surface-variant">
                <span>Finalizados</span>
                <span>Em andamento</span>
              </div>
              <div className="mt-3 h-1 rounded-full bg-luminous-surface-container-high">
                <div className="relative h-1 rounded-full bg-luminous-primary transition-[width] duration-700 ease-out" style={{ width: `${data?.delivery.pct ?? 0}%` }}>
                  <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-luminous-primary shadow-[0_0_14px_#9457DF]" />
                </div>
              </div>
              <p className="mt-4 text-[11px] text-luminous-on-surface-variant">
                {data ? `${data.delivery.finalized} de ${data.delivery.total} Bridge(s) com Wireframe finalizado.` : ""}
              </p>
            </GlassCard>
            <GlassCard className="min-h-56">
              <h3 className="text-sm text-luminous-on-surface-variant">Fluxos de Trabalho</h3>
              <div className="mt-5 flex items-end gap-2">
                <strong className="font-sora text-4xl">{data ? data.flows.active : "…"}</strong>
                <span className="mb-1 text-sm text-luminous-on-surface-variant">Ativos</span>
              </div>
              <div className="mt-5">{data ? <BarChart items={data.flows.bars} ariaLabel="Bridges em andamento por dia da última atividade, últimos 7 dias" /> : <Skeleton className="h-20 w-full rounded" />}</div>
              <p className="mt-3 text-[11px] text-luminous-on-surface-variant">Em andamento, por dia da última atividade (7 dias).</p>
            </GlassCard>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3 border-y border-white/10 py-5">
        <PillSelect label="Período" value={period} onChange={setPeriod} options={PERIOD_OPTIONS} />
        <PillSelect
          label="Galáxia"
          value={galaxyId}
          onChange={setGalaxyId}
          options={[{ value: "", label: "Todas as Galáxias" }, ...(data?.galaxies.map((g) => ({ value: g.id, label: g.name })) ?? [])]}
        />
        <PillSelect label="Prioridade" value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} />
        <PillSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <PillButton
          aria-label="Limpar filtros"
          title="Limpar filtros"
          disabled={!filtersActive}
          onClick={() => {
            setPeriod("all");
            setGalaxyId("");
            setPriority("");
            setStatus("");
          }}
          className="px-3 disabled:opacity-40"
          variant="primary"
        >
          ✕
        </PillButton>
        {data && priority && data.prioritySamples === 0 && (
          <span className="text-xs text-luminous-on-surface-variant">Nenhum Bridge Spec tem prioridade identificável.</span>
        )}
      </section>

      {error && <p className="text-sm text-luminous-error">Não foi possível carregar os números do Dashboard. Tente recarregar a página.</p>}

      <section className="grid gap-6 md:grid-cols-2">
        {[0, 1].map((slot) => {
          const project = data?.projects[slot];
          const icon = PROJECT_ICONS[slot];
          if (data === null) return <Skeleton key={slot} className="min-h-72 rounded-xl" />;
          if (!project) {
            return (
              <GlassCard key={slot} className="flex min-h-72 flex-col items-center justify-center text-center">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-white/5 text-xl text-luminous-on-surface-variant">+</div>
                <h3 className="mt-4 font-sora text-lg font-semibold">{slot === 0 ? "Nenhum Projeto ainda" : "Espaço para um novo Projeto"}</h3>
                <p className="mt-1 max-w-xs text-xs text-luminous-on-surface-variant">Agrupe Bridges e colaboradores sob um mesmo Projeto de entrega.</p>
                <a href="/projetos" className="mt-5 rounded-full bg-luminous-primary px-5 py-2 font-mono text-xs uppercase tracking-[0.1em] text-luminous-on-primary transition hover:bg-luminous-primary-fixed">
                  Criar Projeto
                </a>
              </GlassCard>
            );
          }
          return (
            <a key={project.id} href={`/projetos/${project.id}`} className="group block rounded-xl transition hover:-translate-y-0.5">
              <GlassCard className="min-h-72 transition group-hover:border-luminous-primary/40">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className={`grid h-12 w-12 place-items-center rounded-lg text-xl ${icon.bg}`}>{icon.glyph}</div>
                    <div>
                      <h3 className="font-sora text-lg font-semibold">{project.name}</h3>
                      <p className="mt-1 text-xs text-luminous-on-surface-variant">
                        {project.galaxyNames.length > 0 ? project.galaxyNames.join(", ") : "Sem Galáxia"} • Atualizado {relativeTime(project.updatedAt)}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-luminous-on-surface-variant">{project.code}</span>
                </div>
                <div className="mt-7 flex flex-wrap gap-2">
                  <Badge variant={project.status === "FINALIZADO" ? "success" : project.status === "EM_EXECUCAO" ? "info" : project.status === "EM_VALIDACAO" ? "warning" : "neutral"}>
                    {PROJECT_STATUS_LABEL[project.status]}
                  </Badge>
                  <Badge>{project.bridgeCount} Bridge(s)</Badge>
                  {project.bridgeCount > 0 && <Badge variant={project.progressPct === 100 ? "success" : "neutral"}>{project.finalizedCount} finalizado(s)</Badge>}
                </div>
                <div className="mt-8 flex items-end justify-between">
                  <span className="text-xs text-luminous-on-surface-variant">
                    ▣ {project.finalizedCount}/{project.bridgeCount} Bridges finalizados
                  </span>
                  <ProgressRing value={project.progressPct} color={icon.ring} />
                </div>
              </GlassCard>
            </a>
          );
        })}
      </section>
    </>
  );
}
