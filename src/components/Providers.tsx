"use client";

import { SessionProvider } from "next-auth/react";
import InvalidSessionGuard from "@/components/InvalidSessionGuard";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <InvalidSessionGuard />
      {children}
    </SessionProvider>
  );
}
