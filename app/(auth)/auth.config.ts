import { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost:
    process.env.AUTH_TRUST_HOST === "true" ||
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV !== "production",
  pages: {
    signIn: "/login",
    newUser: "/",
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
} satisfies NextAuthConfig;
