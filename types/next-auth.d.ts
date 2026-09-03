import type { DefaultSession } from "next-auth";
import type { Funcao, PermissionLevel } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      permissionLevel: PermissionLevel;
      funcao: Funcao;
      contextNodeId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    permissionLevel: PermissionLevel;
    funcao: Funcao;
    contextNodeId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    permissionLevel: PermissionLevel;
    funcao: Funcao;
    contextNodeId: string | null;
  }
}
