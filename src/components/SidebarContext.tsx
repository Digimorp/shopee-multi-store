"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// State buka/tutup sidebar drawer di layar sempit (< lg). Di desktop (>= lg)
// sidebar selalu tampil, jadi state ini tidak berpengaruh di sana.
type SidebarState = { open: boolean; setOpen: (v: boolean) => void; toggle: () => void };

const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    if (!open) return;
    // Tutup dengan Esc + kunci scroll halaman di belakang drawer.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Kalau layar dilebarkan ke >= lg saat drawer terbuka, reset state-nya.
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => mq.matches && setOpen(false);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [open]);

  return <SidebarContext.Provider value={{ open, setOpen, toggle }}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar harus dipakai di dalam <SidebarProvider>");
  return ctx;
}
