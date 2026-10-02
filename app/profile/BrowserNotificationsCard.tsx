"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "@/components/GlassCard";
import PillButton from "@/components/PillButton";
import {
  BROWSER_PREF_EVENT,
  browserNotificationsSupported,
  getBrowserPref,
  requestBrowserPermission,
  setBrowserPref,
  showBrowserNotification,
} from "@/lib/notifications/browserPref";

// Configuração do usuário: avisos nativos do navegador (Web Notification API).
// Valem só neste navegador e só com o sistema aberto numa aba.
export default function BrowserNotificationsCard() {
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabled] = useState(false);

  const refresh = useCallback(() => {
    const isSupported = browserNotificationsSupported();
    setSupported(isSupported);
    if (!isSupported) return;
    setPermission(Notification.permission);
    setEnabled(getBrowserPref() === "on" && Notification.permission === "granted");
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(BROWSER_PREF_EVENT, refresh);
    return () => window.removeEventListener(BROWSER_PREF_EVENT, refresh);
  }, [refresh]);

  async function toggle() {
    if (enabled) {
      setBrowserPref("off");
      return;
    }
    if (Notification.permission === "granted") {
      setBrowserPref("on");
    } else {
      await requestBrowserPermission();
    }
    refresh();
    if (Notification.permission === "granted") {
      showBrowserNotification("Avisos ativados", "Você receberá avisos do UX Bridge enquanto o sistema estiver aberto numa aba.", null, "ux-bridge-test");
    }
  }

  return (
    <GlassCard className="space-y-3">
      <h3 className="font-sora text-lg font-semibold">Notificações do navegador</h3>
      <p className="text-sm text-luminous-on-surface-variant">
        Mostra um aviso do navegador quando chega uma notificação nova (por exemplo, uma aprovação que você estava esperando). Funciona só com o sistema aberto
        numa aba e vale apenas para este navegador.
      </p>
      {!supported ? (
        <p className="text-sm text-luminous-on-surface-variant">Este navegador não suporta avisos.</p>
      ) : permission === "denied" ? (
        <p className="text-sm text-[#ffb688]">Os avisos estão bloqueados nas configurações do navegador para este site. Libere lá para poder ativar aqui.</p>
      ) : (
        <div className="flex items-center gap-3">
          <PillButton type="button" variant={enabled ? "inactive" : "primary"} onClick={toggle}>
            {enabled ? "Desativar avisos" : "Ativar avisos"}
          </PillButton>
          <span className="text-sm text-luminous-on-surface-variant">{enabled ? "Ativados neste navegador." : "Desativados."}</span>
        </div>
      )}
    </GlassCard>
  );
}
