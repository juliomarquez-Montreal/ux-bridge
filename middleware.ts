import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Allowlist: só isso é acessível sem sessão. Tudo o mais exige login por padrão.
const PUBLIC_PATHS = ["/login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/auth/");
}

function isAdminOnlyPath(pathname: string): boolean {
  // /settings agora é só configuração do sistema (engine de IA) — exige ADMIN.
  // /profile (dados pessoais) fica de fora daqui: qualquer logado acessa.
  return pathname.startsWith("/settings") || pathname.startsWith("/api/admin/");
}

export default withAuth(
  function middleware(req) {
    if (isAdminOnlyPath(req.nextUrl.pathname) && req.nextauth.token?.permissionLevel !== "ADMIN") {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      // Só libera sem token as rotas da allowlist; qualquer outra rota exige sessão.
      authorized: ({ token, req }) => isPublicPath(req.nextUrl.pathname) || !!token,
    },
    pages: { signIn: "/login" },
  }
);

// Roda em (quase) tudo — a exclusão aqui é só de assets estáticos (Next.js e os
// arquivos soltos em /public, como logos), não de rotas da aplicação. A
// proteção de verdade é a allowlist acima.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf)$).*)",
  ],
};
