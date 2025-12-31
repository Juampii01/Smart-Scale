"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";

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
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = origin ? `${origin}/reset-password` : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: "https://smartscalestrategy.netlify.app/reset-password",
    })

      if (error) {
        const anyErr = error as any;
        const status = anyErr?.status;
        const code = anyErr?.code;
        const message = anyErr?.message || "Error sending recovery email";

    // Mostramos TODO para debug (en la UI)
        setErr(
            `Error enviando email.\n` +
            `status: ${status ?? "?"}\n` +
            `code: ${code ?? "?"}\n` +
            `message: ${message}`
        );

        setLoading(false);
        return;
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
        className="w-full max-w-sm space-y-4 p-6 border border-white/10 rounded-xl"
      >
        <h1 className="text-white text-xl font-semibold">Forgot password</h1>

        <input
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        {err ? <p className="text-sm text-red-400 whitespace-pre-wrap">{err}</p> : null}
        {msg ? <p className="text-sm text-green-400 whitespace-pre-wrap">{msg}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border border-white/10 py-2 text-white hover:bg-white/5 disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar email"}
        </button>

        <Link href="/login" className="block text-sm text-white/60 hover:text-white">
          Volver al login
        </Link>
      </form>
    </div>
  );
}