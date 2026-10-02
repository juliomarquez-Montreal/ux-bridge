"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellIcon, CloseIcon } from "@/components/icons";
import { relativeTime } from "@/lib/relativeTime";
import {
  BROWSER_PREF_EVENT,
  browserNotificationsSupported,
  dismissPrompt,
  getBrowserPref,
  isPromptDismissed,
  requestBrowserPermission,
  setBrowserPref,
  showBrowserNotification,
} from "@/lib/notifications/browserPref";

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_MS = 20_000;
const TOAST_MS = 7_000;
const MAX_TOASTS = 3;
const PROMPT_DELAY_MS = 4_000;

// Sino do header: contador de não lidas, lista, "marcar todas como lidas", e —
// via polling simples (a cada ~20s, sem WebSocket) — Toast na tela e
// notificação nativa do navegador (só com a aba aberta) quando chega algo novo.
export default function NotificationBell() {
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<ApiNotification[]>([]);
  const [promptVisible, setPromptVisible] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [browserOn, setBrowserOn] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const seenRef = useRef<Set<string> | null>(null); // null = primeira carga (não faz Toast do que já existia)

  const refreshPrefState = useCallback(() => {
    if (!browserNotificationsSupported()) return;
    setBrowserOn(getBrowserPref() === "on" && Notification.permission === "granted");
    setPermissionDenied(Notification.permission === "denied");
    setPromptVisible((visible) => (visible && Notification.permission === "default" && getBrowserPref() === null && !isPromptDismissed() ? visible : false));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20");
      if (!res.ok) return;
      const data: { items: ApiNotification[]; unreadCount: number } = await res.json();
      setItems(data.items);
      setUnread(data.unreadCount);

      if (seenRef.current === null) {
        seenRef.current = new Set(data.items.map((n) => n.id));
        return;
      }
      const fresh = data.items.filter((n) => !n.read && !seenRef.current!.has(n.id));
      data.items.forEach((n) => seenRef.current!.add(n.id));
      if (fresh.length > 0) {
        setToasts((current) => [...fresh.slice().reverse(), ...current].slice(0, MAX_TOASTS));
        fresh.forEach((n) => showBrowserNotification(n.title, n.body, n.linkUrl, n.id));
      }
    } catch {
      // rede instável: tenta de novo no próximo ciclo
    }
  }, []);

  // Polling: a cada 20s (pausa com a aba escondida) e ao voltar pra aba.
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Toast some sozinho.
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => setToasts((current) => current.slice(0, -1)), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  // Convite (com explicação) pra ativar os avisos do navegador, antes do prompt nativo.
  useEffect(() => {
    if (!browserNotificationsSupported()) return;
    refreshPrefState();
    const timer = setTimeout(() => {
      if (Notification.permission === "default" && getBrowserPref() === null && !isPromptDismissed()) setPromptVisible(true);
    }, PROMPT_DELAY_MS);
    window.addEventListener(BROWSER_PREF_EVENT, refreshPrefState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(BROWSER_PREF_EVENT, refreshPrefState);
    };
  }, [refreshPrefState]);

  // Fecha o dropdown ao clicar fora / Esc.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function markRead(ids: string[]) {
    if (ids.length === 0) return;
    setItems((current) => current.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((count) => Math.max(0, count - ids.length));
    await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) }).catch(() => {});
  }

  async function markAllRead() {
    setItems((current) => current.map((n) => ({ ...n, read: true })));
    setUnread(0);
    await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) }).catch(() => {});
  }

  function openNotification(n: ApiNotification) {
    if (!n.read) markRead([n.id]);
    setToasts((current) => current.filter((t) => t.id !== n.id));
    if (n.linkUrl) {
      setOpen(false);
      window.location.href = n.linkUrl;
    }
  }

  async function enableBrowser() {
    const result = await requestBrowserPermission();
    setPromptVisible(false);
    if (result !== "granted") {
      setBrowserPref("off");
      dismissPrompt();
    }
    refreshPrefState();
  }

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          aria-label={unread > 0 ? `Notificações (${unread} não lidas)` : "Notificações"}
          aria-expanded={open}
          onClick={() => {
            setOpen((v) => !v);
            if (!open) load();
          }}
          className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10"
        >
          <BellIcon className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-luminous-tertiary px-1 text-[10px] font-bold leading-none text-white ring-2 ring-luminous-surface">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-12 z-40 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-luminous-surface-container text-luminous-on-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold">Notificações</p>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unread === 0}
                className="text-xs font-medium text-luminous-primary-fixed-dim transition hover:underline disabled:cursor-not-allowed disabled:text-luminous-on-surface-variant disabled:no-underline disabled:opacity-60"
              >
                Marcar todas como lidas
              </button>
            </div>

            <ul className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-luminous-on-surface-variant">Nenhuma notificação por enquanto.</li>
              ) : (
                items.map((n) => (
                  <li key={n.id} className="border-b border-white/5 last:border-0">
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/5 ${n.read ? "opacity-70" : ""}`}
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-luminous-tertiary"}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</span>
                        <span className="mt-0.5 block text-xs text-luminous-on-surface-variant">{n.body}</span>
                        <span className="mt-1 block text-[11px] text-luminous-on-surface-variant/70" title={new Date(n.createdAt).toLocaleString("pt-BR")}>
                          {relativeTime(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            {browserNotificationsSupported() && (
              <div className="border-t border-white/10 px-4 py-2.5 text-xs text-luminous-on-surface-variant">
                {browserOn ? (
                  <>Avisos do navegador: <strong className="text-luminous-on-surface">ativados</strong> (desative em Meu perfil).</>
                ) : permissionDenied ? (
                  <>Os avisos do navegador estão bloqueados nas configurações do navegador.</>
                ) : (
                  <button type="button" onClick={enableBrowser} className="font-medium text-luminous-primary-fixed-dim hover:underline">
                    Ativar avisos do navegador
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toasts: canto inferior direito (não cobrem a lista do sino). */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[65] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
        {toasts.map((n) => (
          <div
            key={n.id}
            role="status"
            className="pointer-events-auto animate-[fadeIn_0.25s_ease-out] overflow-hidden rounded-xl border border-white/10 bg-luminous-surface-container text-luminous-on-surface shadow-2xl"
          >
            <div className="flex items-start gap-3 p-3.5">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-luminous-tertiary" aria-hidden="true" />
              <button type="button" onClick={() => openNotification(n)} className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-semibold">{n.title}</span>
                <span className="mt-0.5 block text-xs text-luminous-on-surface-variant">{n.body}</span>
              </button>
              <button
                type="button"
                aria-label="Fechar aviso"
                onClick={() => setToasts((current) => current.filter((t) => t.id !== n.id))}
                className="text-luminous-on-surface-variant transition hover:text-luminous-on-surface"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="h-0.5 bg-luminous-tertiary" style={{ animation: `toast-shrink ${TOAST_MS}ms linear forwards` }} />
          </div>
        ))}
      </div>

      {/* Convite amigável antes do prompt nativo do navegador. */}
      {promptVisible && (
        <div className="fixed bottom-4 left-4 z-[65] w-[min(360px,calc(100vw-2rem))] animate-[fadeIn_0.25s_ease-out] rounded-xl border border-white/10 bg-luminous-surface-container p-4 text-luminous-on-surface shadow-2xl">
          <p className="text-sm font-semibold">Quer receber avisos do navegador?</p>
          <p className="mt-1 text-xs text-luminous-on-surface-variant">
            Mostramos um aviso na tela quando algo importante acontece — como uma aprovação que você estava esperando. Só funciona com o sistema aberto numa aba, e você pode desligar em Meu perfil.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                dismissPrompt();
                setPromptVisible(false);
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-luminous-on-surface-variant transition hover:bg-white/10"
            >
              Agora não
            </button>
            <button
              type="button"
              onClick={enableBrowser}
              className="rounded-full bg-luminous-primary px-3.5 py-1.5 text-xs font-semibold text-luminous-on-primary transition hover:bg-luminous-primary-fixed"
            >
              Ativar avisos
            </button>
          </div>
        </div>
      )}
    </>
  );
}
