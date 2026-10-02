"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIcon, FolderIcon, FrameIcon, LinkIcon, NovaIcon, PlusIcon, SearchIcon } from "@/components/icons";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string | null;
  type?: string;
}

interface SearchResponse {
  bridges: SearchResult[];
  projects: SearchResult[];
  nodes: SearchResult[];
}

const NODE_TYPE_LABEL: Record<string, string> = { UNIVERSO: "Universo", GALAXIA: "Galáxia", ESTRELA: "Estrela", PLANETA: "Planeta" };

const MIN_CHARS = 2;
const DEBOUNCE_MS = 300;

function Row({ href, icon, title, subtitle, onClick }: { href?: string; icon: ReactNode; title: string; subtitle?: string | null; onClick: () => void }) {
  const className = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/5";
  const body = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-luminous-primary/15 text-luminous-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-luminous-on-surface">{title}</span>
        {subtitle && <span className="block truncate text-xs text-luminous-on-surface-variant">{subtitle}</span>}
      </span>
    </>
  );
  return href ? (
    <a href={href} onClick={onClick} className={className}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="px-5 pt-3 text-xs font-semibold uppercase tracking-[.1em] text-luminous-on-surface-variant">{label}</p>
      <ul className="p-2 pt-1">{children}</ul>
    </div>
  );
}

// Dropdown da busca do header (Ctrl+K). Campo vazio: "Acesso rápido" com ações
// reais. Com 2+ caracteres: busca em tempo real (debounce 300ms) em Bridges,
// Projetos e NOVA, agrupada por tipo — ver app/api/search.
//
// No mobile o gatilho é só um ícone (sem barra pra ancorar embaixo), então aqui
// vira `fixed` com margens fixas nas laterais e ganha o próprio campo de busca;
// a partir de `sm` volta a ser ancorado logo abaixo da barra (o pai precisa ter
// `position: relative`). O backdrop com blur é renderizado à parte, no
// AppHeader — como irmão do <header> (ver nota de stacking context lá).
export default function SearchPalette({
  query,
  onQueryChange,
  onClose,
  onCreateBridge,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onCreateBridge: () => void;
}) {
  const term = query.trim();
  const searching = term.length >= MIN_CHARS;
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!searching) {
      setResults(null);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((json: SearchResponse) => {
          if (cancelled) return;
          setResults(json);
          setError(false);
        })
        .catch(() => !cancelled && setError(true))
        .finally(() => !cancelled && setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term, searching]);

  const total = results ? results.bridges.length + results.projects.length + results.nodes.length : 0;

  return (
    <div className="fixed inset-x-4 top-16 z-30 max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-luminous-surface-container shadow-2xl sm:absolute sm:inset-x-0 sm:top-full sm:mt-2">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 sm:hidden">
        <SearchIcon className="h-4 w-4 shrink-0 text-luminous-on-surface-variant" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="O que você precisa encontrar?"
          aria-label="Buscar"
          className="w-full bg-transparent text-sm text-luminous-on-surface outline-none placeholder:text-luminous-on-surface-variant"
        />
      </div>

      {!searching ? (
        <Group label="Acesso rápido">
          <li>
            <Row
              icon={<PlusIcon className="h-[18px] w-[18px]" />}
              title="Criar novo Bridge"
              subtitle="Enviar um material e gerar o Bridge Spec (BS)"
              onClick={() => {
                onClose();
                onCreateBridge();
              }}
            />
          </li>
          <li>
            <Row href="/atividades" icon={<ActivityIcon className="h-[18px] w-[18px]" />} title="Ver Atividades recentes" subtitle="Histórico das últimas ações" onClick={onClose} />
          </li>
          <li>
            <Row href="/projetos" icon={<FolderIcon className="h-[18px] w-[18px]" />} title="Ver Projetos" subtitle="Bridges agrupados por entrega" onClick={onClose} />
          </li>
          <li>
            <Row href="/wireframes" icon={<FrameIcon className="h-[18px] w-[18px]" />} title="Ver Wireframes" subtitle="Biblioteca de Wireframes gerados" onClick={onClose} />
          </li>
        </Group>
      ) : error ? (
        <p className="px-5 py-6 text-sm text-luminous-error">Não foi possível buscar agora. Tente de novo.</p>
      ) : results === null || (loading && total === 0) ? (
        <p className="px-5 py-6 text-sm text-luminous-on-surface-variant">Buscando...</p>
      ) : total === 0 ? (
        <p className="px-5 py-6 text-sm text-luminous-on-surface-variant">Nenhum resultado para &quot;{term}&quot;.</p>
      ) : (
        <div className={`pb-1 transition-opacity duration-150 ${loading ? "opacity-60" : "opacity-100"}`}>
          {results.bridges.length > 0 && (
            <Group label="Bridges">
              {results.bridges.map((b) => (
                <li key={b.id}>
                  <Row href={`/bridges/${b.id}`} icon={<LinkIcon className="h-[18px] w-[18px]" />} title={b.title} subtitle={b.subtitle} onClick={onClose} />
                </li>
              ))}
            </Group>
          )}
          {results.projects.length > 0 && (
            <Group label="Projetos">
              {results.projects.map((p) => (
                <li key={p.id}>
                  <Row href={`/projetos/${p.id}`} icon={<FolderIcon className="h-[18px] w-[18px]" />} title={p.title} subtitle={p.subtitle} onClick={onClose} />
                </li>
              ))}
            </Group>
          )}
          {results.nodes.length > 0 && (
            <Group label="NOVA">
              {results.nodes.map((n) => (
                <li key={n.id}>
                  <Row
                    href={`/nova?q=${encodeURIComponent(n.title)}`}
                    icon={<NovaIcon className="h-[18px] w-[18px]" />}
                    title={n.title}
                    subtitle={[NODE_TYPE_LABEL[n.type ?? ""] ?? n.type, n.subtitle].filter(Boolean).join(" · ")}
                    onClick={onClose}
                  />
                </li>
              ))}
            </Group>
          )}
        </div>
      )}
    </div>
  );
}
