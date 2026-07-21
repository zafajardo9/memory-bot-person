import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "MEMBER" | "ADMIN";
    };
  }

  interface User {
    role?: "MEMBER" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "MEMBER" | "ADMIN";
  }
}
