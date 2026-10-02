import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getUserGalaxyIds } from "@/lib/nova/permissions";
import { extractPriority, type SpecPriority } from "@/lib/projects/priority";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PERIODS = ["month", "7d", "30d", "year", "all"] as const;
type Period = (typeof PERIODS)[number];

function periodRange(period: Period, now: Date): { start: Date | null; prevStart: Date | null } {
  if (period === "all") return { start: null, prevStart: null };
  if (period === "month") {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), prevStart: new Date(now.getFullYear(), now.getMonth() - 1, 1) };
  }
  if (period === "year") {
    return { start: new Date(now.getFullYear(), 0, 1), prevStart: new Date(now.getFullYear() - 1, 0, 1) };
  }
  const days = period === "7d" ? 7 : 30;
  return { start: new Date(now.getTime() - days * DAY_MS), prevStart: new Date(now.getTime() - 2 * days * DAY_MS) };
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

// GET /api/dashboard?period=&galaxyId=&priority=&status= -> números REAIS do
// Dashboard (Home), calculados a partir dos Bridges que o usuário pode ver
// (ADMIN: todos; demais: das Galáxias a que têm acesso) e dos Projetos que ele
// gerencia. Ver comentários de cada bloco pra regra exata de cada métrica.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const periodParam = params.get("period") ?? "all";
  const period: Period = (PERIODS as readonly string[]).includes(periodParam) ? (periodParam as Period) : "all";
  const galaxyId = params.get("galaxyId") ?? "";
  const priorityParam = params.get("priority") ?? "";
  const priority: SpecPriority | "" = ["ALTA", "MEDIA", "BAIXA"].includes(priorityParam) ? (priorityParam as SpecPriority) : "";
  const statusFilter = params.get("status") === "ACTIVE" ? "ACTIVE" : params.get("status") === "DONE" ? "DONE" : "";

  const isAdmin = user.permissionLevel === "ADMIN";
  const userGalaxyIds = isAdmin ? [] : await getUserGalaxyIds(user);
  const galaxies = await db.contextNode.findMany({
    where: isAdmin ? { type: "GALAXIA" } : { type: "GALAXIA", id: { in: userGalaxyIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const now = new Date();
  const { start, prevStart } = periodRange(period, now);

  // Base (sem período): Bridges visíveis, na Galáxia escolhida (se houver).
  const baseWhere: Prisma.BridgeWhereInput[] = [];
  if (!isAdmin) baseWhere.push({ planet: { parent: { parentId: { in: userGalaxyIds } } } });
  if (galaxyId) baseWhere.push({ planet: { parent: { parentId: galaxyId } } });

  const bridges = await db.bridge.findMany({
    where: { AND: baseWhere },
    take: 5000,
    select: { id: true, status: true, createdAt: true, updatedAt: true, bddApprovedAt: true, generatedBddPbi: true },
  });

  const withPriority = bridges.map((b) => ({ ...b, priority: extractPriority(b.generatedBddPbi) }));
  const passesFilters = (b: (typeof withPriority)[number]) =>
    (!priority || b.priority === priority) &&
    (statusFilter === "" || (statusFilter === "DONE" ? b.status === "FINALIZADO" : b.status !== "FINALIZADO" && b.status !== "ERRO_GERACAO"));
  const filteredNoPeriod = withPriority.filter(passesFilters);
  const inPeriod = (b: { createdAt: Date }, from: Date | null, to: Date | null) =>
    (!from || b.createdAt >= from) && (!to || b.createdAt < to);
  const scoped = filteredNoPeriod.filter((b) => inPeriod(b, start, null));

  // 1) Eficiência de Requisitos: dias médios entre criar o Bridge e aprovar o
  //    Bridge Spec, por mês de criação (últimos 6 meses; ignora o filtro de
  //    período porque é uma série temporal).
  const months = Array.from({ length: 6 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (5 - i), 1));
  const efficiency = months.map((monthStart, i) => {
    const monthEnd = i === 5 ? new Date(now.getFullYear(), now.getMonth() + 1, 1) : months[i + 1];
    const samples = filteredNoPeriod
      .filter((b) => b.bddApprovedAt && inPeriod(b, monthStart, monthEnd))
      .map((b) => (b.bddApprovedAt!.getTime() - b.createdAt.getTime()) / DAY_MS);
    return { label: MONTH_NAMES[monthStart.getMonth()], days: average(samples), samples: samples.length };
  });

  // 2) Tempo por etapa (ms). Bridge Spec: criação -> aprovação do BS (campo
  //    bddApprovedAt, existe em todo Bridge). Wireframe PO / UX: vêm dos
  //    registros de Atividades (WIREFRAME_APPROVED_PO / _UX) — só existem para
  //    Bridges que passaram por essas etapas DEPOIS que o histórico foi criado.
  const approvedIds = scoped.filter((b) => b.bddApprovedAt).map((b) => b.id);
  const logs = approvedIds.length
    ? await db.activityLog.findMany({
        where: { entityId: { in: approvedIds }, action: { in: ["WIREFRAME_APPROVED_PO", "WIREFRAME_APPROVED_UX"] } },
        select: { entityId: true, action: true, createdAt: true },
      })
    : [];
  const logAt = (id: string, action: string) => logs.find((l) => l.entityId === id && l.action === action)?.createdAt ?? null;
  const specTimes = scoped.filter((b) => b.bddApprovedAt).map((b) => b.bddApprovedAt!.getTime() - b.createdAt.getTime());
  const poTimes: number[] = [];
  const uxTimes: number[] = [];
  for (const b of scoped) {
    if (!b.bddApprovedAt) continue;
    const po = logAt(b.id, "WIREFRAME_APPROVED_PO");
    const ux = logAt(b.id, "WIREFRAME_APPROVED_UX");
    if (po) poTimes.push(po.getTime() - b.bddApprovedAt.getTime());
    if (po && ux) uxTimes.push(ux.getTime() - po.getTime());
  }
  const stageTimes = {
    spec: { avgMs: average(specTimes), samples: specTimes.length },
    wireframePo: { avgMs: average(poTimes), samples: poTimes.length },
    wireframeUx: { avgMs: average(uxTimes), samples: uxTimes.length },
  };

  // 3) Entrega de Wireframes: % de Bridges FINALIZADOS sobre os criados no
  //    período. Tendência = diferença em pontos percentuais vs. período
  //    anterior de mesmo tamanho (só quando há período e dados nos dois).
  const pct = (list: typeof filteredNoPeriod) => (list.length === 0 ? null : Math.round((list.filter((b) => b.status === "FINALIZADO").length / list.length) * 100));
  const deliveryPct = pct(scoped);
  const prevList = prevStart && start ? filteredNoPeriod.filter((b) => inPeriod(b, prevStart, start)) : [];
  const prevPct = pct(prevList);
  const delivery = {
    pct: deliveryPct,
    total: scoped.length,
    finalized: scoped.filter((b) => b.status === "FINALIZADO").length,
    trend: deliveryPct !== null && prevPct !== null ? deliveryPct - prevPct : null,
  };

  // 4) Fluxos de Trabalho: Bridges em andamento (nem FINALIZADO nem ERRO) e
  //    última atividade (updatedAt) nos 7 últimos dias.
  const active = scoped.filter((b) => b.status !== "FINALIZADO" && b.status !== "ERRO_GERACAO");
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const bars = Array.from({ length: 7 }, (_, i) => {
    const dayStart = new Date(today.getTime() - (6 - i) * DAY_MS);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    return { label: `${String(dayStart.getDate()).padStart(2, "0")}/${String(dayStart.getMonth() + 1).padStart(2, "0")}`, count: active.filter((b) => b.updatedAt >= dayStart && b.updatedAt < dayEnd).length };
  });
  const flows = { active: active.length, bars };

  // 6) Projetos recentes que o usuário gerencia (ADMIN, criador ou membro —
  //    mesma regra de canManageProject), com o progresso da página do Projeto
  //    (% de Bridges vinculados já Finalizados).
  const projects = await db.project.findMany({
    where: isAdmin ? {} : { OR: [{ createdById: user.id }, { members: { some: { userId: user.id } } }] },
    orderBy: { createdAt: "desc" },
    take: 2,
    include: {
      bridgeLinks: {
        include: { bridge: { select: { status: true, updatedAt: true, planet: { select: { parent: { select: { parent: { select: { name: true } } } } } } } } },
      },
    },
  });
  const recentProjects = projects.map((p) => {
    const finalized = p.bridgeLinks.filter((l) => l.bridge.status === "FINALIZADO").length;
    const total = p.bridgeLinks.length;
    const galaxyNames = Array.from(new Set(p.bridgeLinks.map((l) => l.bridge.planet.parent?.parent?.name).filter((n): n is string => !!n)));
    const lastUpdate = Math.max(p.createdAt.getTime(), ...p.bridgeLinks.map((l) => l.bridge.updatedAt.getTime()));
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      galaxyNames,
      bridgeCount: total,
      finalizedCount: finalized,
      progressPct: total > 0 ? Math.round((finalized / total) * 100) : 0,
      updatedAt: new Date(lastUpdate).toISOString(),
    };
  });

  return NextResponse.json({
    galaxies,
    totalBridgesVisible: bridges.length,
    prioritySamples: withPriority.filter((b) => b.priority).length,
    efficiency,
    stageTimes,
    delivery,
    flows,
    projects: recentProjects,
  });
}
