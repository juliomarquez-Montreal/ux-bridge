import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Protege /settings: exige login e role ADMIN. PO/UX autenticados recebem 403;
// quem não está logado é mandado para /login.
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso restrito a administradores." }, { status: 403 });
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/settings/:path*", "/api/admin/:path*"],
};
