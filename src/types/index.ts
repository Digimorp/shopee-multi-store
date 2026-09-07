import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "OWNER" | "ADMIN_TOKO";
      storeIds: string[];
    } & DefaultSession["user"];
  }
}

export type StoreOption = { id: string; code: string; name: string };

export type DateRange = { from: string; to: string };
