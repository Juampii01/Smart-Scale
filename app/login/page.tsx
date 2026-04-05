"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/reflection");
    });
  }, [router, supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErrorMsg(error.message); return; }
    const { data } = await supabase.auth.getSession();
    if (data.session) router.replace("/reflection");
    else setErrorMsg("No se pudo obtener la sesión. Intenta nuevamente.");
  }

  return (
    <div className="min-h-screen bg-[#0c0c0d] flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden border-r border-white/[0.05]">

        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-0 h-[500px] w-[500px] rounded-full bg-[#ffde21]/[0.06] blur-[140px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[#ffde21]/[0.03] blur-[120px]" />
        </div>

        {/* Grid overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        {/* Top: Logo */}
        <div className="relative flex items-center gap-3">
          <span className="text-white text-sm font-bold tracking-[0.22em]">SMART</span>
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-black">
            SCALE
          </span>
        </div>

        {/* Center: Hero text */}
        <div className="relative space-y-6">
          <div className="flex items-center gap-2.5">
            <span className="h-[3px] w-8 rounded-full bg-[#ffde21]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#ffde21]/70">Portal 2.0</span>
          </div>

          <h2 className="text-4xl font-bold leading-[1.15] tracking-tight text-white">
            Tu negocio,<br />
            bajo control.<br />
            <span className="text-[#ffde21]">En tiempo real.</span>
          </h2>

          <p className="max-w-sm text-sm leading-relaxed text-white/35">
            Performance, auditoría, inteligencia de mercado y análisis de contenido — todo en un solo lugar.
          </p>

          {/* Stat pills */}
          <div className="flex flex-wrap gap-3 pt-2">
            {[
              { label: "Métricas conectadas", value: "12+" },
              { label: "Análisis con IA", value: "Live" },
              { label: "Clientes activos", value: "100%" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5"
              >
                <p className="text-[10px] text-white/30 uppercase tracking-widest">{s.label}</p>
                <p className="mt-0.5 text-sm font-bold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Version */}
        <div className="relative">
          <p className="text-[10px] uppercase tracking-widest text-white/15">
            © {new Date().getFullYear()} Smart Scale · v2.0
          </p>
        </div>
      </div>

      {/* ── Right panel: Form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 relative">

        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <span className="text-white text-sm font-bold tracking-[0.22em]">SMART</span>
          <span className="rounded-md bg-white px-2.5 py-1 text-xs font-bold tracking-wide text-black">
            SCALE
          </span>
        </div>

        <div className="w-full max-w-[360px]">

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">Iniciar sesión</h1>
            <p className="mt-1.5 text-sm text-white/35">
              Ingresá con tus credenciales para acceder.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30">
                Email
              </label>
              <input
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/20 transition-all focus:border-[#ffde21]/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#ffde21]/10"
                placeholder="tu@email.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/30">
                  Contraseña
                </label>
                <a
                  href="/forgot-password"
                  className="text-[11px] text-white/30 transition hover:text-[#ffde21]"
                >
                  ¿La olvidaste?
                </a>
              </div>
              <input
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-white/20 transition-all focus:border-[#ffde21]/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-[#ffde21]/10"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs leading-relaxed text-red-300">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-xl bg-[#ffde21] text-sm font-bold text-black transition-all hover:bg-[#ffe84d] hover:shadow-lg hover:shadow-[#ffde21]/20 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
                  Entrando…
                </span>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] leading-relaxed text-white/20">
            Si tu cuenta requiere verificación, revisá tu inbox antes de entrar.
          </p>
        </div>
      </div>
    </div>
  );
}
