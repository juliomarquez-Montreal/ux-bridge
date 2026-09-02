import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      squadId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    squadId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role;
    squadId: string | null;
  }
}
