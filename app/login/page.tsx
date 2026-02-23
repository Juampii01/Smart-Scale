"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // Refrescar sesión y redirigir
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      router.replace("/reflection");
    } else {
      setErrorMsg("No se pudo obtener la sesión. Intenta nuevamente.");
    }
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_20%_15%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(700px_circle_at_80%_20%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(900px_circle_at_50%_90%,rgba(255,255,255,0.06),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/70 to-black" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Brand */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
              <span className="text-sm font-semibold tracking-widest text-white/90">
                SS
              </span>
            </div>
            <div className="text-xs font-semibold tracking-[0.35em] text-white/70">
              SMART SCALE
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Iniciar sesión
            </h1>
            <p className="mt-1 text-sm text-white/60">
              Accedé a tu portal de métricas de forma segura.
            </p>
          </div>

          {/* Card */}
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm text-white/70">Email</label>
                <input
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none placeholder:text-white/30 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                  placeholder="you@domain.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-white/70">Contraseña</label>
                <input
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none placeholder:text-white/30 focus:border-white/20 focus:ring-2 focus:ring-white/10"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {errorMsg ? (
                <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white/80">
                  {errorMsg}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
              >
                {loading ? "Entrando…" : "Entrar"}
              </button>

              <div className="flex items-center justify-between pt-1">
                <a
                  href="/forgot-password"
                  className="text-sm text-white/65 underline-offset-4 hover:text-white hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </a>

                <a
                  href="/signup"
                  className="text-sm text-white/65 underline-offset-4 hover:text-white hover:underline"
                >
                  Crear cuenta
                </a>
              </div>

              <p className="pt-2 text-xs text-white/45">
                Si tu cuenta requiere verificación por email, revisá tu inbox/spam
                antes de iniciar sesión.
              </p>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-white/35">
            © {new Date().getFullYear()} SMART SCALE
          </p>
        </div>
      </div>
    </div>
  );
}