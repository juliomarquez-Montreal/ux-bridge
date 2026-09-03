import Image from "next/image";
import PillButton from "@/components/PillButton";
import UserMenu from "@/components/UserMenu";

// Header/navegação compartilhado entre as páginas autenticadas (dashboard,
// ajustes, etc.) — antes só existia embutido no dashboard, por isso não
// aparecia em /settings.
export default function AppHeader() {
  return (
    <header className="relative z-20 border-b border-luminous-outline-variant/70 bg-luminous-surface/55 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-4 lg:px-8">
        <a href="/">
          <Image src="/Montreal-logo.png" alt="Montreal" width={108} height={24} priority />
        </a>
        <div className="order-3 flex w-full items-center gap-2 rounded-full border border-white/10 bg-luminous-surface-container/70 px-4 py-2 text-sm sm:order-none sm:w-auto sm:min-w-[360px]">
          <span className="text-luminous-on-surface-variant">⌕</span>
          <span className="flex-1 text-luminous-on-surface-variant">Projeto: Redesign Core</span>
          <span className="h-5 w-px bg-luminous-outline-variant" />
          <span className="text-luminous-on-surface-variant">Squad Alpha⌄</span>
          <PillButton className="px-4 py-1.5" variant="primary">Filtrar</PillButton>
        </div>
        <div className="flex gap-2">
          <button aria-label="Suporte" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10">?</button>
          <a href="/settings" aria-label="Configurações" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10">⚙</a>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
