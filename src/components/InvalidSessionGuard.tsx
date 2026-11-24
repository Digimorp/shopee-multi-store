"use client";

import { useEffect, useRef } from "react";
import { signOut, useSession } from "next-auth/react";

/** Sesi ditandai tidak valid oleh server (user nonaktif / terhapus) -- lihat refreshTokenAccess. */
export function isInvalidSession(session: unknown): boolean {
  return (session as any)?.user?.invalid === true;
}

/**
 * Pembuat handler yang memanggil signOut PALING BANYAK SEKALI per pemuatan halaman (anti-loop).
 * Setelah signOut cookie sesi dihapus, jadi di /login sesi sudah null dan handler tidak terpicu lagi.
 */
export function makeInvalidSessionHandler(doSignOut: () => void) {
  let called = false;
  return (session: unknown): boolean => {
    if (called || !isInvalidSession(session)) return false;
    called = true;
    doSignOut();
    return true;
  };
}

/** T-013 nomor 10b: keluarkan otomatis akun yang sesinya tidak valid. Tidak merender apa pun. */
export default function InvalidSessionGuard() {
  const { data: session } = useSession();
  const handler = useRef(makeInvalidSessionHandler(() => signOut({ callbackUrl: "/login" })));
  useEffect(() => {
    handler.current(session);
  }, [session]);
  return null;
}
