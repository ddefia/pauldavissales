import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "MANAGER" | "REP";
    } & DefaultSession["user"];
  }

  interface User {
    role: "ADMIN" | "MANAGER" | "REP";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "ADMIN" | "MANAGER" | "REP";
  }
}
