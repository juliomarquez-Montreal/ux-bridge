"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// Barra fina azul de carregamento (estilo YouTube/Gmail), global — montada UMA
// vez no layout raiz, logo abaixo do header. Avança sozinha (rápido no começo,
// devagar perto do fim, nunca chega a 100% sozinha) e completa quando:
// - a rota muda (navegação client-side do Next.js);
// - as chamadas de dados (fetch) da página terminam.
//
// O App Router não tem eventos de navegação, então a barra é disparada por:
// 1) clique em link interno (<a>, inclusive navegação completa com recarga: a
//    barra anda até a nova página chegar e o documento novo a substitui);
// 2) fetch: toda requisição que muda dados (POST/PATCH/DELETE — ex: gerar um
//    Bridge com IA) e os GETs de dados feitos nos primeiros segundos de uma
//    página (carga inicial). Polling em segundo plano não dispara a barra.
const COLOR = "#0077ff";
const HEIGHT_PX = 3;
const INITIAL_LOAD_WINDOW_MS = 4000;
const SAFETY_TIMEOUT_MS = 12000;
const IGNORED_FETCH = ["/api/auth/", "/api/notifications"];

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(false);
  const [top, setTop] = useState(0);

  const activeRef = useRef(false);
  const inflightRef = useRef(0);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowEndsAtRef = useRef(Date.now() + INITIAL_LOAD_WINDOW_MS);
  const lastRouteRef = useRef(routeKey);

  const stopTrickle = () => {
    if (trickleRef.current) clearInterval(trickleRef.current);
    trickleRef.current = null;
  };

  const start = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current);
    if (activeRef.current) return;
    activeRef.current = true;
    setVisible(true);
    setValue(8);
    stopTrickle();
    trickleRef.current = setInterval(() => {
      // Avanço assintótico: 10% do que falta, até no máximo 92%.
      setValue((v) => Math.min(92, v + Math.max(0.5, (92 - v) * 0.1)));
    }, 250);
  }, []);

  const done = useCallback(() => {
    if (safetyRef.current) clearTimeout(safetyRef.current);
    if (!activeRef.current) return;
    activeRef.current = false;
    stopTrickle();
    setValue(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setValue(0);
    }, 300);
  }, []);

  // Rota mudou -> completa e abre uma nova janela de "carga inicial" pros fetches.
  useEffect(() => {
    if (lastRouteRef.current !== routeKey) {
      lastRouteRef.current = routeKey;
      windowEndsAtRef.current = Date.now() + INITIAL_LOAD_WINDOW_MS;
      if (inflightRef.current === 0) done();
    }
  }, [routeKey, done]);

  // Cliques em links internos.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
      // Rede de segurança: link tratado por JavaScript que acabou não navegando
      // não pode deixar a barra presa pra sempre.
      if (safetyRef.current) clearTimeout(safetyRef.current);
      safetyRef.current = setTimeout(() => {
        if (inflightRef.current === 0) done();
      }, SAFETY_TIMEOUT_MS);
    }
    // Fase de borbulhamento (depois dos handlers do React), pra o clique já ter
    // passado por qualquer preventDefault/router.push antes de a barra começar.
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [start, done]);

  // Fetch: conta requisições em andamento e liga/desliga a barra.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const request = args[0];
      const url = typeof request === "string" ? request : request instanceof URL ? request.href : request.url;
      const method = (args[1]?.method ?? (typeof request === "object" && "method" in request ? request.method : "GET")).toUpperCase();
      const sameOriginApi = url.startsWith("/api/") || url.startsWith(`${window.location.origin}/api/`);
      const tracked =
        sameOriginApi &&
        !IGNORED_FETCH.some((prefix) => url.includes(prefix)) &&
        (method !== "GET" || Date.now() < windowEndsAtRef.current);
      if (!tracked) return originalFetch(...args);

      inflightRef.current += 1;
      start();
      try {
        return await originalFetch(...args);
      } finally {
        inflightRef.current -= 1;
        if (inflightRef.current === 0) done();
      }
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [start, done]);

  // Fica logo abaixo do header (sticky); sem header (ex: /login), no topo.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      const header = document.querySelector("header");
      setTop(header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0);
      frame = requestAnimationFrame(update);
    };
    if (visible) frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  useEffect(
    () => () => {
      stopTrickle();
      if (hideRef.current) clearTimeout(hideRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
    },
    []
  );

  return (
    <div
      role="progressbar"
      aria-label="Carregando"
      aria-hidden={!visible}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className="pointer-events-none fixed inset-x-0 z-[60]"
      style={{ top, height: HEIGHT_PX, opacity: visible ? 1 : 0, transition: "opacity 200ms ease-out" }}
    >
      <div
        className="h-full rounded-r-full"
        style={{
          width: `${value}%`,
          background: COLOR,
          boxShadow: `0 0 8px ${COLOR}, 0 0 3px ${COLOR}`,
          transition: value === 0 ? "none" : "width 250ms ease-out",
        }}
      />
    </div>
  );
}
