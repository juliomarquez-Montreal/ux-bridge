"use client";

import { useEffect, useState } from "react";
import Skeleton from "@/components/Skeleton";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  FrameIcon,
  LinkIcon,
  MailIcon,
  SearchIcon,
  ShareIcon,
} from "@/components/icons";
import { copyText } from "@/lib/clipboard";
import { Pill } from "@/app/projetos/ui";
import { STATUS_LABEL, STATUS_TONE } from "@/app/bridges/statusMeta";
import type { BridgeStatus } from "@/app/bridges/types";

interface ApiWireframeItem {
  bridgeId: string;
  planetName: string;
  galaxyName: string | null;
  status: BridgeStatus;
  createdBy: string;
  createdAt: string;
  exportUrl: string | null;
}

interface ApiWireframeResponse {
  items: ApiWireframeItem[];
  total: number;
  page: number;
  totalPages: number;
  pageSize: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Mesmo link do ícone de compartilhar de /bridges: o Wireframe faz parte da
// página somente-leitura do Bridge.
function shareUrlFor(bridgeId: string): string {
  return `${window.location.origin}/bridges/${bridgeId}/share`;
}

const ICON_BTN =
  "grid h-8 w-8 place-items-center rounded-lg border border-[#D7DAE0] bg-white text-[#50545C] transition hover:border-[#C9CDD4] hover:bg-[#F4F5F7] hover:text-[#1D1F25] active:scale-95";

export default function WireframesPanel() {
  const [data, setData] = useState<ApiWireframeResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Debounce da busca: só consulta o servidor 300ms depois da última tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((current) => {
        if (current !== searchInput.trim()) setPage(1);
        return searchInput.trim();
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("q", search);
    fetch(`/api/wireframes?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: ApiWireframeResponse) => {
        if (cancelled) return;
        setData(json);
        setLoadError(null);
      })
      .catch(() => !cancelled && setLoadError("Não foi possível carregar os Wireframes. Tente recarregar a página."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, search]);

  async function handleCopy(item: ApiWireframeItem) {
    await copyText(shareUrlFor(item.bridgeId));
    setCopiedId(item.bridgeId);
    setTimeout(() => setCopiedId((current) => (current === item.bridgeId ? null : current)), 2000);
  }

  const first = data && data.total > 0 ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? (data.page - 1) * data.pageSize + data.items.length : 0;

  return (
    <div>
      <h1 className="text-3xl font-bold text-[#15161A]">Wireframes</h1>
      <p className="mt-1 text-sm text-[#50545C]">
        Todos os Wireframes já gerados nas suas Galáxias. Baixe o SVG, compartilhe o link ou envie por e-mail.
      </p>

      <div className="mt-6 flex h-11 max-w-md items-center gap-2 rounded-lg border border-[#D7DAE0] bg-white px-3.5">
        <SearchIcon className="h-4 w-4 shrink-0 text-[#50545C]" />
        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscar por planeta ou galáxia..."
          aria-label="Buscar Wireframes"
          className="w-full bg-transparent text-sm text-[#1D1F25] outline-none placeholder:text-[#9A9EA6]"
        />
      </div>

      {loadError && <p className="mt-6 text-sm text-[#C42B2B]">{loadError}</p>}

      <div className="mt-4 overflow-hidden rounded-[10px] border border-[#E6E8EC] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E6E8EC] bg-[#FAFBFC] text-xs uppercase tracking-[.05em] text-[#50545C]">
                <th className="px-4 py-3 font-medium">Wireframe</th>
                <th className="px-4 py-3 font-medium">Bridge</th>
                <th className="px-4 py-3 font-medium">Criado por</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
                <th className="px-4 py-3 font-medium">Planeta</th>
                <th className="px-4 py-3 font-medium">Galáxia</th>
                <th className="px-4 py-3 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className={`transition-opacity duration-200 ${loading && data ? "opacity-50" : "opacity-100"}`}>
              {data === null ? (
                [0, 1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-b border-[#EEF0F3]">
                    <td colSpan={7} className="px-4 py-3">
                      <Skeleton tone="light" className="h-8 w-full rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#50545C]">
                    {search
                      ? `Nenhum Wireframe encontrado para "${search}".`
                      : "Nenhum Wireframe gerado ainda nas suas Galáxias. Aprove o Bridge Spec (BS) de um Bridge para gerar o primeiro."}
                  </td>
                </tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.bridgeId} className="border-b border-[#EEF0F3] last:border-0 hover:bg-[#FAFBFC]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#B9D0F7] bg-[#DBE8FC] text-[#1A5FD0]">
                          <FrameIcon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="font-medium text-[#1D1F25]">{item.planetName}</p>
                          <div className="mt-1">
                            <Pill tone={STATUS_TONE[item.status] === "done" ? "blue" : STATUS_TONE[item.status] === "error" ? "red" : "amber"}>{STATUS_LABEL[item.status]}</Pill>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`/bridges/${item.bridgeId}`}
                        className="inline-flex items-center gap-1.5 font-medium text-[#6B2FD1] underline-offset-2 transition hover:underline"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        Abrir Bridge
                      </a>
                    </td>
                    <td className="px-4 py-3 text-[#50545C]">{item.createdBy}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#50545C]">{formatDate(item.createdAt)}</td>
                    <td className="px-4 py-3 text-[#1D1F25]">{item.planetName}</td>
                    <td className="px-4 py-3 text-[#50545C]">{item.galaxyName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={item.exportUrl ?? `/api/bridges/${item.bridgeId}/shared/svg?download=1`}
                          download="wireframe.svg"
                          aria-label={`Baixar SVG do Wireframe de ${item.planetName}`}
                          title="Baixar SVG"
                          className={ICON_BTN}
                        >
                          <DownloadIcon className="h-4 w-4" />
                        </a>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => handleCopy(item)}
                            aria-label={`Copiar link de compartilhamento de ${item.planetName}`}
                            title="Copiar link"
                            className={ICON_BTN}
                          >
                            <ShareIcon className="h-4 w-4" />
                          </button>
                          {copiedId === item.bridgeId && (
                            <span className="absolute -top-9 left-1/2 -translate-x-1/2 animate-[fadeIn_0.15s_ease-out] whitespace-nowrap rounded-md bg-[#1D1F25] px-2.5 py-1 text-[11px] font-medium text-white shadow-lg">
                              Link copiado!
                            </span>
                          )}
                        </div>
                        <a
                          href={`mailto:?subject=${encodeURIComponent(`UX Bridge — Wireframe ${item.planetName}`)}&body=${encodeURIComponent(shareUrlFor(item.bridgeId))}`}
                          aria-label={`Enviar Wireframe de ${item.planetName} por e-mail`}
                          title="Enviar por e-mail"
                          className={ICON_BTN}
                        >
                          <MailIcon className="h-4 w-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E8EC] bg-[#FAFBFC] px-4 py-3">
            <p className="text-xs text-[#50545C]">
              Mostrando {first}–{last} de {data.total} Wireframe(s)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={data.page <= 1}
                onClick={() => setPage(data.page - 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[#D7DAE0] bg-white text-[#50545C] transition hover:border-[#C9CDD4] hover:bg-[#F4F5F7] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </button>
              <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-[#8B40F5] px-2 text-xs font-semibold text-white">
                {data.page} / {data.totalPages}
              </span>
              <button
                type="button"
                aria-label="Próxima página"
                disabled={data.page >= data.totalPages}
                onClick={() => setPage(data.page + 1)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-[#D7DAE0] bg-white text-[#50545C] transition hover:border-[#C9CDD4] hover:bg-[#F4F5F7] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
