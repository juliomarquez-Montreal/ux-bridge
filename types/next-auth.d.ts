import type { DefaultSession } from "next-auth";
import type { Funcao, PermissionLevel } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

// Acesso a Galáxia (Fase N7: UserGalaxyAccess/currentGalaxyId) NÃO vive
// aqui — é consultado direto no banco quando preciso (permissões em
// lib/nova/permissions.ts, seletor do header via GET /api/nova/users/me/
// galaxies), pra nunca ficar desatualizado na sessão/JWT entre logins.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      permissionLevel: PermissionLevel;
      funcao: Funcao;
    } & DefaultSession["user"];
  }

  interface User {
    permissionLevel: PermissionLevel;
    funcao: Funcao;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    permissionLevel: PermissionLevel;
    funcao: Funcao;
  }
}
