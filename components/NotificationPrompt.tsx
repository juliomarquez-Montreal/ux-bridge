"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BROWSER_PREF_EVENT,
  browserNotificationsSupported,
  dismissPrompt,
  getBrowserPref,
  isPromptDismissed,
  requestBrowserPermission,
  setBrowserPref,
} from "@/lib/notifications/browserPref";

const PROMPT_DELAY_MS = 4_000;

// Convite (com explicação) pra ativar os avisos do navegador, mostrado ANTES do
// prompt nativo pra não parecer spam. É uma faixa dentro do próprio <header>,
// numa linha abaixo da barra principal: empurra o conteúdo da página pra baixo
// em vez de flutuar por cima de qualquer coisa.
export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false);

  const shouldShow = useCallback(
    () => browserNotificationsSupported() && Notification.permission === "default" && getBrowserPref() === null && !isPromptDismissed(),
    []
  );

  useEffect(() => {
    if (!browserNotificationsSupported()) return;
    const timer = setTimeout(() => setVisible(shouldShow()), PROMPT_DELAY_MS);
    // Se a preferência mudar (ex: ativada em Meu perfil ou pelo sino), some.
    const onChange = () => setVisible((current) => current && shouldShow());
    window.addEventListener(BROWSER_PREF_EVENT, onChange);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(BROWSER_PREF_EVENT, onChange);
    };
  }, [shouldShow]);

  if (!visible) return null;

  async function enable() {
    const result = await requestBrowserPermission();
    if (result !== "granted") {
      setBrowserPref("off");
      dismissPrompt();
    }
    setVisible(false);
  }

  return (
    <div role="region" aria-label="Convite para ativar avisos do navegador" className="animate-[fadeIn_0.25s_ease-out] border-t border-white/10 bg-luminous-surface-container/80">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
        <p className="min-w-0 flex-1 text-sm text-luminous-on-surface-variant">
          <strong className="font-semibold text-luminous-on-surface">Quer receber avisos do navegador?</strong> Mostramos um aviso quando algo importante acontece, como uma aprovação
          que você esperava. Só funciona com o sistema aberto numa aba, e dá para desligar em Meu perfil.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              dismissPrompt();
              setVisible(false);
            }}
            className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-luminous-on-surface-variant transition hover:bg-white/10"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={enable}
            className="rounded-full bg-luminous-primary px-3.5 py-1.5 text-xs font-semibold text-luminous-on-primary transition hover:bg-luminous-primary-fixed"
          >
            Ativar avisos
          </button>
        </div>
      </div>
    </div>
  );
}
