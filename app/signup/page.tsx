"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

function isAlreadyRegisteredError(error: any) {
  const msg = String(error?.message ?? "");
  const code = String(error?.code ?? "");
  if (["user_already_exists", "email_exists", "email_already_exists"].includes(code)) return true;
  return /already\s*(registered|been\s*registered)|user\s*already\s*registered|email\s*already\s*(registered|in\s*use)|duplicate/i.test(
    msg
  );
}

function safeProjectRefFromUrl(url?: string) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function errInfo(e: any) {
  if (!e) return null;
  return {
    message: String(e.message ?? e),
    name: e?.name,
    status: e?.status,
    code: e?.code,
  };
}

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [debug, setDebug] = useState<any>(null);

  const [pendingConfirmEmail, setPendingConfirmEmail] = useState<string | null>(null);
  const [pendingRedirectTo, setPendingRedirectTo] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const projectRef = useMemo(() => safeProjectRefFromUrl(supabaseUrl), [supabaseUrl]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setErr(null);
    setMsg(null);
    setDebug(null);

    setPendingConfirmEmail(null);
    setPendingRedirectTo(null);
    setResendLoading(false);

    const supabase = createClient();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail.includes("@")) {
      setLoading(false);
      setErr("Ingresá un email válido.");
      return;
    }
    if (password.length < 6) {
      setLoading(false);
      setErr("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    const emailRedirectTo = `${window.location.origin}/login`;

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo,
      },
    });

    const identities = (data?.user as any)?.identities;

    const debugPayload = {
      supabaseUrl,
      projectRef,
      emailRedirectTo,
      returnedUserId: data?.user?.id ?? null,
      returnedSession: Boolean(data?.session),
      identitiesLen: Array.isArray(identities) ? identities.length : null,
      error: errInfo(error),
    };

    console.log("SIGNUP RESULT", { data, error, debug: debugPayload });
    setDebug(debugPayload);

    if (error) {
      if (isAlreadyRegisteredError(error)) {
        const { error: resendErr } = await supabase.auth.resend({
          type: "signup",
          email: cleanEmail,
          options: {
            emailRedirectTo,
          },
        });

        setLoading(false);

        if (!resendErr) {
          setMsg(
            "Ese email ya tiene una cuenta, pero puede que no esté confirmado. Te reenviamos el email de verificación (revisá spam/promociones). Si ya confirmaste, iniciá sesión."
          );
          return;
        }

        setErr(
          `No pude crear la cuenta. Supabase devolvió un error de duplicado, pero no pude reenviar el mail de confirmación. Detalle: ${String(
            resendErr.message ?? resendErr
          )}`
        );
        return;
      }

      setLoading(false);
      setErr(String(error.message ?? error));
      return;
    }

    if (!data?.user?.id) {
      setLoading(false);
      setErr("No pude confirmar la creación del usuario. Conectate con soporte (envia captura).");
      return;
    }

    if (!data?.session) {
      setLoading(false);
      setPendingConfirmEmail(cleanEmail);
      setPendingRedirectTo(emailRedirectTo);
      setMsg(
        "Cuenta creada, pero falta confirmar el email. Revisá spam/promociones. Si no te llegó, podés reenviarlo desde acá."
      );
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      setLoading(false);
      setErr("La cuenta parece creada, pero no pude leer la sesión. Conectate con soporte (envia captura).");
      return;
    }

    setLoading(false);
    setMsg("Cuenta creada y sesión iniciada. Redirigiendo...");
    setTimeout(() => router.push("/"), 600);
  }

  async function onResendConfirmation() {
    if (!pendingConfirmEmail) return;

    setResendLoading(true);
    setErr(null);
    setMsg(null);

    const supabase = createClient();
    const emailRedirectTo = pendingRedirectTo || `${window.location.origin}/login`;

    const { error: resendErr } = await supabase.auth.resend({
      type: "signup",
      email: pendingConfirmEmail,
      options: { emailRedirectTo },
    });

    setResendLoading(false);

    if (resendErr) {
      setErr(`No pude reenviar el email de confirmación. Detalle: ${String(resendErr.message ?? resendErr)}`);
      return;
    }

    setMsg("Listo: reenvié el email de confirmación. Revisá spam/promociones y abrí el link desde la misma pestaña/host.");
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
              <span className="text-sm font-semibold tracking-widest text-white/90">SS</span>
            </div>
            <div className="text-xs font-semibold tracking-[0.35em] text-white/70">SMART SCALE</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Crear cuenta</h1>
            <p className="mt-1 text-sm text-white/60">Creá tu acceso al portal y confirmá el email para continuar.</p>
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
                  placeholder="Mínimo 6 caracteres"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>

              {err ? (
                <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white/80">
                  {err}
                </div>
              ) : null}

              {msg ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/75">
                  {msg}
                </div>
              ) : null}

              {pendingConfirmEmail ? (
                <button
                  type="button"
                  onClick={onResendConfirmation}
                  disabled={resendLoading}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white/90 transition hover:bg-white/10 disabled:opacity-60"
                >
                  {resendLoading ? "Reenviando…" : "Reenviar email de confirmación"}
                </button>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
              >
                {loading ? "Creando…" : "Crear cuenta"}
              </button>

              <div className="flex items-center justify-between pt-1">
                <a href="/login" className="text-sm text-white/65 underline-offset-4 hover:text-white hover:underline">
                  Ya tengo cuenta → Login
                </a>
                <a
                  href="/forgot-password"
                  className="text-sm text-white/65 underline-offset-4 hover:text-white hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              {/* Debug panel (dev only) */}
              {debug ? (
                <details className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                  <summary className="cursor-pointer select-none text-white/70">Debug</summary>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(debug, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-white/35">© {new Date().getFullYear()} SMART SCALE</p>
        </div>
      </div>
    </div>
  );
}