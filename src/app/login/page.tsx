"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", { redirect: false, email, password });
    setLoading(false);

    if (res?.error) {
      setError("Email atau password salah.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {/* T-013 batch 18: kartu kaca di atas latar gradasi (body). */}
      <div className="glass w-full max-w-sm p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-pill text-white">
            <Icon name="store" size={20} strokeWidth={2} />
          </span>
          <div className="leading-tight">
            <div className="text-base font-bold text-ink">Shopee Multi-Toko</div>
            <div className="text-xs text-muted">Sistem Input & Laporan Penjualan</div>
          </div>
        </div>

        <p className="mb-5 text-sm text-muted">Masuk untuk mengelola input &amp; laporan penjualan.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-xs font-semibold text-muted">Email</label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-11 w-full rounded-full border border-ink/10 bg-white px-4 text-sm text-ink placeholder:text-muted"
              placeholder="owner@company.com"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="mb-1 block text-xs font-semibold text-muted">Password</label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-11 w-full rounded-full border border-ink/10 bg-white px-4 text-sm text-ink placeholder:text-muted"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-danger-text">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Memproses…" : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
