"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthMark } from "@/components/theme/brand-logo";
import { createClient } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    setErr(null);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const redirectTo = `${window.location.origin}/reset-password`

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      })

      if (error) {
        setErr(error.message || "No pudimos enviar el email. Intentá de nuevo en unos minutos.")
        setLoading(false)
        return
      }

      setMsg(
        "Listo. Te envié un email con el link para resetear tu contraseña. Abrilo directamente desde el email."
      );
      setLoading(false);
    } catch (e: any) {
      setErr(e?.message || "Error sending recovery email");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 p-6 border border-foreground/10 rounded-xl"
      >
        <div className="mb-2 flex flex-col items-center gap-3 text-center">
          <AuthMark size={48} />
          <h1 className="text-foreground text-[24px] font-semibold">Recuperar contraseña</h1>
        </div>

        <input
          className="w-full rounded-md border border-foreground/10 bg-black/30 px-3 py-2 text-foreground outline-none"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {err ? <p className="text-[13px] text-red-700 dark:text-red-400 whitespace-pre-wrap">{err}</p> : null}
        {msg ? <p className="text-[13px] text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">{msg}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border border-foreground/10 py-2 text-foreground hover:bg-foreground/5 disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar email"}
        </button>

        <Link href="/login" className="block text-[13px] text-text-2 hover:text-foreground">
          Volver al login
        </Link>
      </form>
    </div>
  );
}