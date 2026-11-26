"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

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
        {/* T-013 batch 20: logo Penerbit Insan Kamil di tengah atas, nama aplikasi = "Aplikasi Marketplace". */}
        <div className="mb-5 flex flex-col items-center gap-3 text-center">
          <BrandLogo size="lg" priority />
          <div className="leading-tight">
            <h1 className="text-xl font-bold text-ink">Aplikasi Marketplace</h1>
            <div className="mt-1 text-xs text-muted">Sistem Input & Laporan Penjualan</div>
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
