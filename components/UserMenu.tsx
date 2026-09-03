"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

interface Profile {
  name: string;
  avatarUrl: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

// Avatar do usuário no header: mostra a foto (ou iniciais) e abre um menu com
// atalho pro perfil e logout. Refaz o fetch quando a foto/nome muda em /settings.
export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function loadProfile() {
      fetch("/api/settings/profile")
        .then((res) => res.json())
        .then((data) => {
          if (data.user) setProfile({ name: data.user.name, avatarUrl: data.user.avatarUrl });
        })
        .catch(() => {});
    }
    loadProfile();
    window.addEventListener("profile-updated", loadProfile);
    return () => window.removeEventListener("profile-updated", loadProfile);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-label="Menu do usuário"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-luminous-primary/50 bg-luminous-primary-container font-mono text-xs"
      >
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto vem do Supabase Storage
          <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
        ) : (
          profile && getInitials(profile.name)
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-10 w-40 overflow-hidden rounded-lg border border-white/10 bg-luminous-surface-container shadow-lg">
          <a
            href="/settings"
            className="block w-full px-4 py-3 text-left text-sm text-luminous-on-surface hover:bg-white/5"
          >
            Meu perfil
          </a>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="block w-full px-4 py-3 text-left text-sm text-luminous-on-surface hover:bg-white/5"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
