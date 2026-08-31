"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { AuthMark } from "@/components/theme/brand-logo";
import { getDefaultLandingForRole } from "@/lib/auth/permissions";
import { APP_VERSION } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function redirectByRole(userId: string): Promise<string | null> {
    const { data: prof } = await supabase
      .from("profiles")
      .select("role, active")
      .eq("id", userId)
      .maybeSingle();

    if ((prof as any)?.active === false) {
      await supabase.auth.signOut();
      return "Tu cuenta fue desactivada. Contactá a tu equipo de Smart Scale.";
    }

    const role = (prof as any)?.role ?? null;
    router.replace(getDefaultLandingForRole(role));
    return null;
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session?.user) {
        const err = await redirectByRole(data.session.user.id);
        if (err) setErrorMsg(err);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setErrorMsg(error.message); return; }
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      const err = await redirectByRole(data.session.user.id);
      if (err) setErrorMsg(err);
    } else {
      setErrorMsg("No se pudo obtener la sesión. Intenta nuevamente.");
    }
  }

  return (
    <div className="min-h-screen bg-background flex relative">

      {/* Theme toggle floating top-right */}
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden border-r border-border">

        {/* Glow de fondo — neutro, sin lima */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-0 h-[500px] w-[500px] rounded-full bg-foreground/[0.04] blur-[140px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-foreground/[0.02] blur-[120px]" />
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
        <div className="relative flex items-center gap-3.5">
          <AuthMark size={64} />
          <div className="flex flex-col leading-none">
            <span className="text-foreground text-[15px] font-black tracking-[0.18em]">SMART SCALE</span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-text-3">Portal {APP_VERSION}</span>
          </div>
        </div>

        {/* Center: Hero text */}
        <div className="relative space-y-6">
          <span className="inline-block h-1 w-10 rounded-full bg-foreground/25" />

          <h2 className="text-[32px] font-bold leading-[1.15] tracking-tight text-foreground">
            Tu negocio,<br />
            bajo control.<br />
            En tiempo real.
          </h2>

          <p className="max-w-sm text-[13px] leading-relaxed text-text-3">
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
                className="rounded-lg border border-border bg-foreground/[0.03] px-4 py-2.5"
              >
                <p className="text-[11px] text-text-3 uppercase tracking-widest">{s.label}</p>
                <p className="mt-0.5 text-[13px] font-bold text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Version */}
        <div className="relative">
          <p className="text-[11px] uppercase tracking-widest text-text-3">
            © {new Date().getFullYear()} Smart Scale · v{APP_VERSION}
          </p>
        </div>
      </div>

      {/* ── Right panel: Form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 relative">

        {/* Mobile logo */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <AuthMark size={48} />
          <span className="text-foreground text-[14px] font-black tracking-[0.18em]">SMART SCALE</span>
        </div>

        <div className="w-full max-w-[360px]">

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[24px] font-bold tracking-tight text-foreground">Iniciar sesión</h1>
            <p className="mt-1.5 text-[13px] text-text-3">
              Ingresá con tus credenciales para acceder.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="space-y-4">

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-text-3">
                Email
              </label>
              <input
                className="h-12 w-full rounded-lg border border-border bg-foreground/[0.04] px-4 text-[13px] text-foreground outline-none placeholder:text-text-3 transition-all focus:border-border-hover focus:bg-foreground/[0.06] focus:ring-2 focus:ring-border"
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
                <label className="block text-[11px] font-semibold uppercase tracking-widest text-text-3">
                  Contraseña
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[13px] text-text-3 transition hover:text-foreground"
                >
                  ¿La olvidaste?
                </Link>
              </div>
              <div className="relative">
                <input
                  className="h-12 w-full rounded-lg border border-border bg-foreground/[0.04] pl-4 pr-11 text-[13px] text-foreground outline-none placeholder:text-text-3 transition-all focus:border-border-hover focus:bg-foreground/[0.06] focus:ring-2 focus:ring-border"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-0 top-0 flex h-12 w-11 items-center justify-center text-text-3 transition hover:text-foreground"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed text-danger">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-lg bg-foreground text-background text-[13px] font-bold transition-all hover:opacity-90 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-background/25 border-t-background" />
                  Entrando…
                </span>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] leading-relaxed text-text-3">
            Si tu cuenta requiere verificación, revisá tu inbox antes de entrar.
          </p>
        </div>
      </div>
    </div>
  );
}
