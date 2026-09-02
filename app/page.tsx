import Image from "next/image";
import AbstractBackground from "@/components/AbstractBackground";
import Badge from "@/components/Badge";
import BarChart from "@/components/BarChart";
import GlassCard from "@/components/GlassCard";
import KpiCard from "@/components/KpiCard";
import LineChart from "@/components/LineChart";
import PillButton from "@/components/PillButton";
import TabGroup from "@/components/TabGroup";

// Indicador circular de avanço para os cards de projeto.
function ProgressRing({ value }: { value: number }) {
  return <div className="relative grid h-16 w-16 place-items-center"><svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90"><circle cx="18" cy="18" r="15.9" fill="none" stroke="#37333c" strokeWidth="3" /><circle cx="18" cy="18" r="15.9" fill="none" stroke="#9457DF" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${value} 100`} /></svg><span className="font-sora text-sm font-semibold">{value}%</span></div>;
}

// Dashboard de demonstração composto apenas por dados estáticos.
export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden text-luminous-on-surface">
      <AbstractBackground />

      <header className="border-b border-luminous-outline-variant/70 bg-luminous-surface/55 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-8">
          <Image src="/Montreal-logo.png" alt="Montreal" width={108} height={24} priority />
          <div className="order-3 flex w-full items-center gap-2 rounded-full border border-white/10 bg-luminous-surface-container/70 px-4 py-2 text-sm sm:order-none sm:w-auto sm:min-w-[360px]">
            <span className="text-luminous-on-surface-variant">⌕</span><span className="flex-1 text-luminous-on-surface-variant">Projeto: Redesign Core</span><span className="h-5 w-px bg-luminous-outline-variant" /><span className="text-luminous-on-surface-variant">Squad Alpha⌄</span><PillButton className="px-4 py-1.5" variant="primary">Filtrar</PillButton>
          </div>
          <div className="flex gap-2"><button aria-label="Suporte" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10">?</button><button aria-label="Configurações" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10">⚙</button><div className="grid h-10 w-10 place-items-center rounded-full border border-luminous-primary/50 bg-luminous-primary-container font-mono text-xs">PO</div></div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1440px] space-y-6 px-6 py-10 lg:px-8">
        <section className="grid gap-6 lg:grid-cols-12">
          <div className="flex min-h-[420px] flex-col justify-between lg:col-span-7">
            <div><div className="mb-3 flex items-center gap-3"><h1 className="font-sora text-5xl font-bold leading-none tracking-[-.04em] sm:text-7xl">UX</h1><Badge variant="info">Com IA</Badge></div><h2 className="font-sora text-5xl font-bold leading-none tracking-[-.04em] sm:text-7xl">BRIDGE <sup className="align-top font-mono text-base tracking-normal text-luminous-primary">&#123;PO&#125;</sup></h2></div>
            <GlassCard className="mt-10 min-h-64 overflow-hidden"><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.1em] text-luminous-on-surface-variant">Métrica principal</p><h3 className="font-sora text-lg font-semibold">Eficiência de Requisitos (Dias)</h3></div><span className="grid h-8 w-8 place-items-center rounded-full bg-luminous-primary/15 text-luminous-primary">↗</span></div><div className="grid h-40 grid-cols-[auto_1fr] gap-4"><div className="flex flex-col justify-between pb-6 font-mono text-[10px] uppercase text-luminous-on-surface-variant"><span>Lento</span><span>Rápido</span></div><LineChart /></div><div className="ml-12 flex justify-between font-mono text-[10px] uppercase tracking-[.1em] text-luminous-on-surface-variant"><span>Mar</span><span>Abr</span><span>Mai</span><span>Jun</span><span>Jul</span><span>Ago</span></div></GlassCard>
          </div>

          <div className="space-y-6 lg:col-span-5">
            <GlassCard><div className="mb-6 flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.1em] text-luminous-on-surface-variant">Média atual</p><h3 className="font-sora text-lg font-semibold">Tempo de Levantamento</h3></div><span className="text-luminous-primary">↘</span></div><div className="mb-6 grid grid-cols-3 gap-4"><KpiCard title="Épico" value="14" unit="dias" /><KpiCard title="História" value="8" unit="dias" /><KpiCard title="Tarefa" value="3" unit="dias" /></div><TabGroup tabs={["Épico", "História", "Tarefa"]} activeTab="Tarefa" /></GlassCard>
            <div className="grid gap-6 sm:grid-cols-2"><GlassCard className="min-h-56"><h3 className="text-sm text-luminous-on-surface-variant">Entrega de Wireframes</h3><div className="mt-5 flex items-end gap-2"><strong className="font-sora text-4xl">92%</strong><span className="mb-1 font-mono text-xs text-luminous-primary">+12%</span></div><div className="mt-7 flex justify-between text-xs text-luminous-on-surface-variant"><span>No Prazo</span><span>Atrasados</span></div><div className="mt-3 h-1 rounded-full bg-luminous-surface-container-high"><div className="relative h-1 w-[92%] rounded-full bg-luminous-primary"><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-luminous-primary shadow-[0_0_14px_#9457DF]" /></div></div></GlassCard><GlassCard className="min-h-56"><h3 className="text-sm text-luminous-on-surface-variant">Fluxos de Trabalho</h3><div className="mt-5 flex items-end gap-2"><strong className="font-sora text-4xl">128</strong><span className="mb-1 text-sm text-luminous-on-surface-variant">Ativos</span></div><div className="mt-5"><BarChart /></div></GlassCard></div>
          </div>
        </section>

        <section className="flex flex-wrap gap-3 border-y border-white/10 py-5"><PillButton variant="secondary">Este mês⌄</PillButton><PillButton variant="secondary">Squad Alpha⌄</PillButton><PillButton variant="secondary">Alta Prioridade⌄</PillButton><PillButton variant="secondary">Em Andamento⌄</PillButton><PillButton aria-label="Mais filtros" className="px-3" variant="primary">☷</PillButton></section>

        <section className="grid gap-6 md:grid-cols-2"><GlassCard className="min-h-72"><div className="flex items-start justify-between"><div className="flex gap-4"><div className="grid h-12 w-12 place-items-center rounded-lg bg-luminous-primary text-xl text-luminous-on-primary">ϟ</div><div><h3 className="font-sora text-lg font-semibold">Projetos em Otimização</h3><p className="mt-1 text-xs text-luminous-on-surface-variant">Squad Alpha • Atualizado há 2 h</p></div></div><span className="text-luminous-on-surface-variant">•••</span></div><div className="mt-7 flex flex-wrap gap-2"><Badge variant="warning">Prioridade Alta</Badge><Badge>Fase: Discovery</Badge><Badge variant="success">Redução 30% tempo</Badge><Badge variant="info">Automatizado</Badge></div><div className="mt-8 flex items-end justify-between"><span className="text-xs text-luminous-on-surface-variant">▣ 12/15 Requisitos validados</span><ProgressRing value={85} /></div></GlassCard><GlassCard className="min-h-72"><div className="flex items-start justify-between"><div className="flex gap-4"><div className="grid h-12 w-12 place-items-center rounded-lg bg-luminous-secondary text-xl text-luminous-on-secondary">⌘</div><div><h3 className="font-sora text-lg font-semibold">Fluxos de Trabalho</h3><p className="mt-1 text-xs text-luminous-on-surface-variant">Squad Beta • há 1 d</p></div></div><span className="text-luminous-on-surface-variant">•••</span></div><div className="mt-7 flex flex-wrap gap-2"><Badge>Prioridade Média</Badge><Badge>Fase: Delivery</Badge><Badge variant="info">Otimização UX</Badge><Badge>Manual</Badge></div><div className="mt-8 flex items-end justify-between"><span className="text-xs text-luminous-on-surface-variant">▣ 8/20 Requisitos validados</span><ProgressRing value={40} /></div></GlassCard></section>
      </main>
    </div>
  );
}
