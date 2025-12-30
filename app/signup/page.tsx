"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

function isAlreadyRegisteredError(error: any) {
  const msg = String(error?.message ?? "");
  const code = String(error?.code ?? "");
  // Supabase commonly uses these codes/messages for duplicate signups
  if (["user_already_exists", "email_exists", "email_already_exists"].includes(code)) return true;
  return /already\s*(registered|been\s*registered)|user\s*already\s*registered|email\s*already\s*(registered|in\s*use)|duplicate/i.test(msg);
}

function safeProjectRefFromUrl(url?: string) {
  if (!url) return "";
  try {
    const u = new URL(url);
    // https://<ref>.supabase.co
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

    // Minimal client-side checks (Supabase also validates)
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

    // IMPORTANT: If you rely on Auth emails (confirmation / recovery), make sure this host
    // is included in Supabase Auth > URL Configuration > Redirect URLs.
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

    // 1) Hard error cases
    if (error) {
      // Only treat as duplicate when it's truly a duplicate
      if (isAlreadyRegisteredError(error)) {
        // Common case: user exists but is unconfirmed -> resend confirmation email
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

        // If resend fails, show a more truthful message instead of claiming the account exists.
        setErr(
          `No pude crear la cuenta. Supabase devolvió un error de duplicado, pero no pude reenviar el mail de confirmación. Detalle: ${String(resendErr.message ?? resendErr)}`
        );
        return;
      }

      setLoading(false);
      setErr(String(error.message ?? error));
      return;
    }

    // 2) Do not infer duplicates from `identities` here.
    // In some configurations (email confirmation, provider states), `identities` can be empty or unexpected.

    // 3) Defensive: if we got here without error but also without a user, something is off
    if (!data?.user?.id) {
      setLoading(false);
      setErr(
        "No pude confirmar la creación del usuario. Conectate con soporte (envia captura)."
      );
      return;
    }

    // 4) If confirmations are enabled, session will be null
    // The user WILL still be created in Auth, but must confirm email to sign in.
    if (!data?.session) {
      setLoading(false);
      setPendingConfirmEmail(cleanEmail);
      setPendingRedirectTo(emailRedirectTo);
      setMsg(
        "Cuenta creada, pero falta confirmar el email. Revisá spam/promociones. Si no te llegó, podés reenviarlo desde acá."
      );
      return;
    }

    // 5) Session exists => user is signed in right away
    // Quick sanity check: ensure the session is readable (helps catch 'wrong project' confusion)
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.user?.id) {
      setLoading(false);
      setErr(
        "La cuenta parece creada, pero no pude leer la sesión. Conectate con soporte (envia captura)."
      );
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
      setErr(
        `No pude reenviar el email de confirmación. Detalle: ${String(resendErr.message ?? resendErr)}`
      );
      return;
    }

    setMsg(
      "Listo: reenvié el email de confirmación. Revisá spam/promociones y abrí el link desde la misma pestaña/host."
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 p-6 border border-white/10 rounded-xl"
      >
        <div className="space-y-1">
          <h1 className="text-white text-xl font-semibold">Crear cuenta</h1>
          <p className="text-xs text-white/50">
            Supabase project: <span className="font-mono">{projectRef || "(sin URL en env)"}</span>
          </p>
        </div>

        <input
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <input
          className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none"
          placeholder="Contraseña (mín. 6)"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />

        {err ? <p className="text-sm text-red-400">{err}</p> : null}
        {msg ? <p className="text-sm text-white/70">{msg}</p> : null}

        {pendingConfirmEmail ? (
          <button
            type="button"
            onClick={onResendConfirmation}
            disabled={resendLoading}
            className="w-full rounded-md border border-white/10 py-2 text-white/90 hover:bg-white/5 disabled:opacity-60"
          >
            {resendLoading ? "Reenviando..." : "Reenviar email de confirmación"}
          </button>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md border border-white/10 py-2 text-white hover:bg-white/5 disabled:opacity-60"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </button>

        <div className="flex items-center justify-between">
          <a href="/login" className="text-sm text-white/60 hover:text-white">
            Ya tengo cuenta → Login
          </a>
          <a href="/forgot-password" className="text-sm text-white/60 hover:text-white">
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        {/* Debug panel (dev only). Useful to confirm you're hitting the right Supabase project. */}
        {debug ? (
          <details className="rounded-md border border-white/10 bg-black/20 p-3 text-xs text-white/70">
            <summary className="cursor-pointer select-none">Debug</summary>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words">
              {JSON.stringify(debug, null, 2)}
            </pre>
          </details>
        ) : null}
      </form>
    </div>
  );
}