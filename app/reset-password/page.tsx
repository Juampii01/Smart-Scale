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
        // 0) Recovery link flow: ?token_hash=...&type=recovery
        if (tokenHash && type === "recovery") {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });
          if (error) throw error;

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

          url.searchParams.delete("code");
          url.searchParams.delete("type");
          window.history.replaceState({}, document.title, url.toString());

          if (!mounted) return;
          setInfo("Link validado. Ahora podés elegir tu nueva contraseña.");
        }

        // 2) Hash flow: access_token in hash.
        if (!code && hashHasAccessToken) {
          const access_token = hashParams["access_token"];
          const refresh_token = hashParams["refresh_token"];
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }

          validatedByLinkRef.current = true;
          if (!mounted) return;
          setLinkValidated(true);

          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );

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

        // 4) Small delay + retry session read.
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

        if (!ok && validatedByLinkRef.current) {
          setErr(
            "Validé el link pero no pude obtener una sesión. Esto suele pasar si abriste el link en una pestaña distinta, " +
              "mezclaste localhost con 127.0.0.1, o el redirect URL no coincide exactamente con el configurado en Supabase. " +
              "Pedí un nuevo link y abrilo directo desde el email en esta misma pestaña (mismo host)."
          );
        }

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

    // Last chance to surface session
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
    return (
      <div className="relative min-h-screen bg-black text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_20%_15%,rgba(255,255,255,0.10),transparent_55%),radial-gradient(700px_circle_at_80%_20%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(900px_circle_at_50%_90%,rgba(255,255,255,0.06),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/70 to-black" />
        </div>
        <div className="relative flex min-h-screen items-center justify-center px-6 py-12">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70 backdrop-blur-xl">
            Cargando…
          </div>
        </div>
      </div>
    );
  }

  const inputsEnabled = hasSession || linkValidated;

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
            <div className="text-xs font-semibold tracking-[0.35em] text-white/70">
              SMART SCALE
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Reseteá tu contraseña</h1>
            <p className="mt-1 text-sm text-white/60">
              Validá el link y elegí una nueva contraseña.
            </p>
          </div>

          {/* Card */}
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl"
          >
            <div className="space-y-4">
              {err ? (
                <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white/80 whitespace-pre-wrap">
                  {err}
                </div>
              ) : null}

              {info ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/75 whitespace-pre-wrap">
                  {info}
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="block text-sm text-white/70">Nueva contraseña</label>
                <input
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none placeholder:text-white/30 focus:border-white/20 focus:ring-2 focus:ring-white/10 disabled:opacity-60"
                  placeholder="Mínimo 6 caracteres"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={!inputsEnabled}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-white/70">Repetir contraseña</label>
                <input
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none placeholder:text-white/30 focus:border-white/20 focus:ring-2 focus:ring-white/10 disabled:opacity-60"
                  placeholder="Repetí la contraseña"
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  disabled={!inputsEnabled}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !hasSession}
                className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
              >
                {loading ? "Actualizando…" : "Actualizar contraseña"}
              </button>

              <div className="flex items-center justify-between pt-1">
                <Link
                  href="/login"
                  className="text-sm text-white/65 underline-offset-4 hover:text-white hover:underline"
                >
                  Volver al login
                </Link>
                <Link
                  href="/forgot-password"
                  className="text-sm text-white/65 underline-offset-4 hover:text-white hover:underline"
                >
                  Pedir nuevo link
                </Link>
              </div>
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