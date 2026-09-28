"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiUserGalaxy } from "@/app/nova/types";
import { ChevronDownIcon, GalaxiaIcon, UniversoIcon } from "@/components/icons";

// Seletor de duas etapas (Universo -> Galáxia) no header — substitui o
// antigo breadcrumb estático "Redesign Core / Squad Alpha". Fase N7:
// popula com GET /api/nova/users/me/galaxies (ADMIN vê todas; usuário comum
// só as que tem UserGalaxyAccess) e persiste a escolha via
// PATCH /api/settings/current-galaxy (User.currentGalaxyId).
export default function GalaxySelector() {
  const [galaxies, setGalaxies] = useState<ApiUserGalaxy[] | null>(null);
  const [currentGalaxyId, setCurrentGalaxyId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"universo" | "galaxia">("universo");
  const [pendingUniversoId, setPendingUniversoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/nova/users/me/galaxies")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { galaxies: ApiUserGalaxy[]; currentGalaxyId: string | null }) => {
        setGalaxies(data.galaxies);
        setCurrentGalaxyId(data.currentGalaxyId);
      })
      .catch(() => setGalaxies([]));
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const current = galaxies?.find((g) => g.id === currentGalaxyId) ?? null;

  // Universos distintos, na ordem em que aparecem (a API já ordena por nome).
  const universos = (galaxies ?? []).reduce<{ id: string; name: string }[]>((acc, g) => {
    if (!acc.some((u) => u.id === g.universoId)) acc.push({ id: g.universoId, name: g.universoName });
    return acc;
  }, []);

  function openSelector() {
    // Reabre já no passo/Universo da seleção atual, se houver uma.
    setStep(current ? "galaxia" : "universo");
    setPendingUniversoId(current?.universoId ?? null);
    setOpen(true);
  }

  async function selectGalaxy(galaxyId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/current-galaxy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ galaxyId }),
      });
      if (!res.ok) throw new Error();
      setCurrentGalaxyId(galaxyId);
      setOpen(false);
    } catch {
      // Silencioso — a UI simplesmente mantém a seleção anterior; não há
      // onde mostrar um erro sem poluir o header.
    } finally {
      setSaving(false);
    }
  }

  if (galaxies === null) {
    return <div className="hidden h-9 w-40 animate-pulse rounded-full bg-white/5 sm:block" />;
  }

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openSelector())}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-luminous-on-surface-variant hover:bg-white/10"
      >
        {galaxies.length === 0 ? (
          <span>Nenhuma Galáxia vinculada</span>
        ) : current ? (
          <>
            <span className="max-w-[10rem] truncate">{current.universoName}</span>
            <span>/</span>
            <span className="max-w-[10rem] truncate text-luminous-on-surface">{current.name}</span>
          </>
        ) : (
          <span>Selecionar Galáxia</span>
        )}
        <ChevronDownIcon className="h-4 w-4 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-white/10 bg-luminous-surface-container shadow-2xl">
          {galaxies.length === 0 ? (
            <p className="p-4 text-xs text-luminous-on-surface-variant">
              Você ainda não tem acesso a nenhuma Galáxia. Peça a um administrador para vincular seu usuário em Gestão de
              Usuários.
            </p>
          ) : step === "universo" ? (
            <div className="max-h-80 overflow-y-auto p-2">
              <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[.08em] text-luminous-on-surface-variant">
                Escolha o Universo
              </p>
              {universos.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setPendingUniversoId(u.id);
                    setStep("galaxia");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/5"
                >
                  <UniversoIcon className="h-4 w-4 shrink-0 text-luminous-on-surface-variant" />
                  <span className="truncate text-luminous-on-surface">{u.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto p-2">
              <button
                type="button"
                onClick={() => setStep("universo")}
                className="mb-1 flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-xs text-luminous-on-surface-variant hover:bg-white/5"
              >
                <ChevronDownIcon className="h-3.5 w-3.5 rotate-90" />
                Trocar Universo
              </button>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[.08em] text-luminous-on-surface-variant">
                Escolha a Galáxia
              </p>
              {galaxies
                .filter((g) => g.universoId === pendingUniversoId)
                .map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    disabled={saving}
                    onClick={() => selectGalaxy(g.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/5 disabled:opacity-50 ${
                      g.id === currentGalaxyId ? "bg-luminous-primary/10 text-luminous-on-surface" : "text-luminous-on-surface"
                    }`}
                  >
                    <GalaxiaIcon className="h-4 w-4 shrink-0 text-luminous-on-surface-variant" />
                    <span className="truncate">{g.name}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
