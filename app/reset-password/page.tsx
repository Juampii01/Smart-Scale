"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

function parseHashParams(hash: string) {
  const out: Record<string, string> = {};
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function friendlyAuthError(hashParams: Record<string, string>) {
  const code = hashParams["error_code"];
  const desc = hashParams["error_description"]
    ? decodeURIComponent(hashParams["error_description"])
    : "";

  if (code === "otp_expired") {
    return "El link expiró o ya fue usado. Pedí uno nuevo desde Forgot password.";
  }
  if (code === "access_denied") {
    return "Acceso denegado. Pedí un nuevo link desde Forgot password y abrilo apenas llegue.";
  }
  return desc || "Link inválido o rechazado.";
}

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [linkValidated, setLinkValidated] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  // Avoid contradictory UI (info + error) during link validation.
  const validatedByLinkRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    async function init() {
      setErr(null);
      setInfo(null);
      setReady(false);
      setLinkValidated(false);
      validatedByLinkRef.current = false;

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");

      const hashParams = window.location.hash ? parseHashParams(window.location.hash) : {};
      const hashHasAccessToken = Boolean(hashParams["access_token"]);

      // Explicit error returned by Supabase in the hash.
      if (hashParams["error"] || hashParams["error_code"]) {
        const message = friendlyAuthError(hashParams);
        if (!mounted) return;
        setErr(message);
        setHasSession(false);
        setReady(true);
        return;
      }

      try {
        // 0) Recovery link flow: ?token_hash=...&type=recovery (most common for reset password emails)
        if (tokenHash && type === "recovery") {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) throw error;

          // Explicitly persist session when provided (prevents getSession() = null race).
          if (data?.session?.access_token && data?.session?.refresh_token) {
            await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
          }

          validatedByLinkRef.current = true;
          if (!mounted) return;
          setLinkValidated(true);
          setHasSession(Boolean(data?.session));

          // Clean URL so the token can't be reused.
          url.searchParams.delete("token_hash");
          url.searchParams.delete("type");
          window.history.replaceState({}, document.title, url.toString());

          if (!mounted) return;
          setInfo("Link validado. Ahora podés elegir tu nueva contraseña.");
        }

        // 1) PKCE flow: exchange ?code= for a session.
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          // Explicitly persist session when provided.
          if (data?.session?.access_token && data?.session?.refresh_token) {
            await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            });
          }

          validatedByLinkRef.current = true;
          if (!mounted) return;
          setLinkValidated(true);
          setHasSession(Boolean(data?.session));

          // Remove the code from the URL so it can't be reused.
          url.searchParams.delete("code");
          url.searchParams.delete("type");
          window.history.replaceState({}, document.title, url.toString());

          if (!mounted) return;
          setInfo("Link validado. Ahora podés elegir tu nueva contraseña.");
        }

        // 2) Hash flow: access_token in hash.
        if (!code && hashHasAccessToken) {
          // If present, explicitly set session from hash tokens.
          const access_token = hashParams["access_token"];
          const refresh_token = hashParams["refresh_token"];
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }

          validatedByLinkRef.current = true;
          if (!mounted) return;
          setLinkValidated(true);

          // Clear hash ASAP.
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );

          // Best-effort: read session once.
          const { data } = await supabase.auth.getSession();
          setHasSession(Boolean(data.session));

          if (!mounted) return;
          setInfo("Link validado. Ahora podés elegir tu nueva contraseña.");
        }

        // 3) Subscribe to auth changes to avoid race conditions.
        const sub = supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          const ok = Boolean(session);
          setHasSession(ok);
          if (ok) setErr(null);
        });
        unsubscribe = () => sub.data.subscription.unsubscribe();

        // 4) Small delay + retry session read (session can take a moment to persist after exchange).
        await new Promise((r) => setTimeout(r, 250));

        let ok = false;
        for (let i = 0; i < 10; i++) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          ok = Boolean(data.session);
          if (ok) break;
          await new Promise((r) => setTimeout(r, 250));
        }

        if (!mounted) return;
        setHasSession(ok);

        // If the link was validated but the session still isn't available, show a clearer message.
        if (!ok && validatedByLinkRef.current) {
          setErr(
            "Validé el link pero no pude obtener una sesión. Esto suele pasar si abriste el link en una pestaña distinta, " +
              "mezclaste localhost con 127.0.0.1, o el redirect URL no coincide exactamente con el configurado en Supabase. " +
              "Pedí un nuevo link y abrilo directo desde el email en esta misma pestaña (mismo host)."
          );
        }

        // Only show "no session" if we did NOT validate a link.
        if (!ok && !validatedByLinkRef.current) {
          setErr(
            "El link de recuperación no contiene una sesión válida (no encontré ?code= o #access_token). " +
              "Pedí un nuevo link desde Forgot password y abrilo apenas llegue."
          );
        }
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || "No pude validar el link de recuperación.");
        setHasSession(false);
      } finally {
        if (!mounted) return;
        setReady(true);
      }
    }

    init();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);

    // If the link was validated, give Supabase one last chance to surface the session.
    if (!hasSession && linkValidated) {
      const { data } = await supabase.auth.getSession();
      if (data.session) setHasSession(true);
    }

    if (!hasSession) {
      setErr(
        "No hay sesión válida para cambiar la contraseña. Pedí un nuevo link desde Forgot password y abrilo apenas llegue."
      );
      return;
    }

    if (password.length < 6) {
      setErr("La contraseña debe tener mínimo 6 caracteres.");
      return;
    }

    if (password !== password2) {
      setErr("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErr(error.message);
      return;
    }

    setInfo("Contraseña actualizada. Redirigiendo al login...");
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!ready) {
    return <div className="min-h-screen bg-black text-white p-6">Cargando…</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 p-6 border border-white/10 rounded-xl"
      >
        <h1 className="text-white text-xl font-semibold">Reseteá tu contraseña</h1>

        {err ? <p className="text-sm text-red-400 whitespace-pre-wrap">{err}</p> : null}
        {info ? <p className="text-sm text-green-400 whitespace-pre-wrap">{info}</p> : null}

        <div className="space-y-2">
          <input
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none disabled:opacity-60"
            placeholder="Nueva contraseña (mín. 6)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={!hasSession && !linkValidated}
          />
          <input
            className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-white outline-none disabled:opacity-60"
            placeholder="Repetir contraseña"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            required
            disabled={!hasSession && !linkValidated}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !hasSession}
          className="w-full rounded-md border border-white/10 py-2 text-white hover:bg-white/5 disabled:opacity-60"
        >
          {loading ? "Actualizando..." : "Actualizar contraseña"}
        </button>

        <div className="flex items-center justify-between">
          <Link href="/login" className="text-sm text-white/60 hover:text-white">
            Volver al login
          </Link>
          <Link href="/forgot-password" className="text-sm text-white/60 hover:text-white">
            Pedir nuevo link
          </Link>
        </div>

        <p className="text-xs text-white/50">
          Tip: usá siempre el mismo host (ej: <b>localhost</b>) y no mezcles con <b>127.0.0.1</b>. Asegurate de
          que <code className="text-white/70"> /reset-password</code> esté whitelisteado en Supabase → Auth → URL
          Configuration.
        </p>
      </form>
    </div>
  );
}