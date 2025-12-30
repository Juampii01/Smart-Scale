"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

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

    router.replace("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-white/10 bg-black/40 p-6"
      >
        <h1 className="text-xl font-semibold text-white">Login</h1>

        <div className="space-y-2">
          <label className="block text-sm text-white/70">Email</label>
          <input
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none"
            placeholder="you@domain.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-white/70">Password</label>
          <input
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none"
            placeholder="••••••••"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {errorMsg ? (
          <p className="text-sm text-red-400">{errorMsg}</p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border border-white/10 py-2 text-white hover:bg-white/5 disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <div className="flex items-center justify-between">
          <a
            href="/forgot-password"
            className="text-sm text-white/70 hover:text-white"
          >
            ¿Olvidaste tu contraseña?
          </a>

          <a href="/signup" className="text-sm text-white/70 hover:text-white">
            Crear cuenta
          </a>
        </div>

        <p className="text-xs text-white/50">
          Si tu cuenta requiere verificación por email, revisá tu inbox/spam antes de iniciar sesión.
        </p>
      </form>
    </div>
  );
}
