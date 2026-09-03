import Image from "next/image";

// Rodapé das páginas autenticadas: borda superior em gradiente roxo (mais
// forte no centro, desvanecendo nas pontas) e o logo da Montreal, que saiu
// do header.
export default function AppFooter() {
  return (
    <footer className="relative mt-auto">
      <div
        aria-hidden="true"
        className="h-px w-full"
        style={{
          background: "linear-gradient(to right, transparent, #9457DF, transparent)",
        }}
      />
      <div className="mx-auto flex max-w-[1440px] justify-center px-6 py-6 lg:px-8">
        <a href="https://www.montreal.com.br" target="_blank" rel="noopener noreferrer">
          <Image src="/Montreal-logo.png" alt="Montreal" width={90} height={20} />
        </a>
      </div>
    </footer>
  );
}
