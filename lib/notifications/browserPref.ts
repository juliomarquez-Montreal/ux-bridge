// Preferência de "notificações do navegador" (Web Notification API) deste
// navegador. Fica no localStorage porque a permissão do navegador também é por
// navegador/dispositivo. Valores: "on" (usar), "off" (desligado pelo usuário).
// Sem valor = ainda não decidiu.

const KEY = "ux-bridge:browser-notifications";
const PROMPT_DISMISSED_KEY = "ux-bridge:browser-notifications-prompt-dismissed";
export const BROWSER_PREF_EVENT = "ux-bridge:browser-notifications-changed";

export type BrowserPref = "on" | "off" | null;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // modo privado / storage bloqueado: segue sem persistir
  }
}

export function browserNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserPref(): BrowserPref {
  const value = safeGet(KEY);
  return value === "on" || value === "off" ? value : null;
}

export function setBrowserPref(value: "on" | "off") {
  safeSet(KEY, value);
  window.dispatchEvent(new Event(BROWSER_PREF_EVENT));
}

export function isPromptDismissed(): boolean {
  return safeGet(PROMPT_DISMISSED_KEY) === "1";
}

export function dismissPrompt() {
  safeSet(PROMPT_DISMISSED_KEY, "1");
  window.dispatchEvent(new Event(BROWSER_PREF_EVENT));
}

// Pede a permissão nativa e, se concedida, liga a preferência. Devolve o
// resultado do navegador ("granted" | "denied" | "default").
export async function requestBrowserPermission(): Promise<NotificationPermission> {
  if (!browserNotificationsSupported()) return "denied";
  const result = await Notification.requestPermission();
  if (result === "granted") setBrowserPref("on");
  return result;
}

// Notificação nativa, só com a aba aberta (sem Service Worker).
export function showBrowserNotification(title: string, body: string, linkUrl: string | null, tag: string) {
  if (!browserNotificationsSupported() || Notification.permission !== "granted" || getBrowserPref() !== "on") return;
  try {
    const notification = new Notification(title, { body, tag, icon: "/logo-ux-bridge.png" });
    notification.onclick = () => {
      window.focus();
      if (linkUrl) window.location.href = linkUrl;
      notification.close();
    };
  } catch {
    // alguns navegadores bloqueiam a construção direta; ignora
  }
}
