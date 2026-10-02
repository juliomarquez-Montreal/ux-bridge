import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";

// Intervalo mínimo entre reconferências de "conta ativa" no banco.
const STATUS_REFRESH_MS = 60_000;

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        // Senha certa, mas conta desativada: erro específico pra tela de login.
        if (!user.active) throw new Error("ACCOUNT_DISABLED");

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          permissionLevel: user.permissionLevel,
          funcao: user.funcao,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.permissionLevel = user.permissionLevel;
        token.funcao = user.funcao;
        token.active = true;
        token.checkedAt = Date.now();
      } else if (token.sub && Date.now() - (token.checkedAt ?? 0) > STATUS_REFRESH_MS) {
        // Reconfere no banco (no máximo 1x por minuto) se a conta continua
        // ativa e atualiza permissão/função — assim desativar um usuário ou
        // mudar a permissão dele vale sem esperar o token expirar. Usuário que
        // nem existe mais no banco mantém o comportamento antigo (não derruba).
        token.checkedAt = Date.now();
        try {
          const fresh = await db.user.findUnique({ where: { id: token.sub }, select: { active: true, permissionLevel: true, funcao: true } });
          if (fresh) {
            token.active = fresh.active;
            token.permissionLevel = fresh.permissionLevel;
            token.funcao = fresh.funcao;
          }
        } catch {
          // banco indisponível: mantém o que o token já diz
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Conta desativada: devolve sessão sem usuário (getCurrentUser -> null).
      if (token.active === false) return { expires: session.expires } as typeof session;
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.permissionLevel = token.permissionLevel;
        session.user.funcao = token.funcao;
      }
      return session;
    },
  },
};
