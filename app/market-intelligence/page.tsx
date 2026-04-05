"use client"
import { DashboardLayout, useActiveClient } from "@/components/layout/dashboard-layout";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getLatestResearchRequest, getResearchResult, getResearchHistory } from "@/lib/marketIntelligence";
import { createClient } from "@/lib/supabase";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AiLoading } from "@/components/ui/ai-loading";
import { Trash2, ChevronDown, ChevronUp, ExternalLink, Clock, Youtube } from "lucide-react";

export default function MarketIntelligencePage() {
  return (
    <DashboardLayout>
      <MarketIntelligenceContent />
    </DashboardLayout>
  )
}

function MarketIntelligenceContent() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // Estado del formulario
  const [platform, setPlatform] = useState<string>("");
  const [timeframe, setTimeframe] = useState<string>("");
  const [competitors, setCompetitors] = useState<string[]>(["", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Historial de requests
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [hasSession, setHasSession] = useState<boolean>(true);
  const [targetUserId, setTargetUserId] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const activeClientId = useActiveClient();

  // Protección de sesión y carga de perfil
  useEffect(() => {
    const loadUser = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setHasSession(false);
        router.replace("/login");
        return;
      }

      setHasSession(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      setUserId(userData.user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();

      setUserRole(profile?.role || "");
    };

    loadUser();
  }, [router, supabase]);

  // Resolver el user_id del cliente activo seleccionado en el header
  useEffect(() => {
    if (!userId) return;

    const resolveTarget = async () => {
      if (!activeClientId) {
        setTargetUserId(userId);
        return;
      }
      // Buscar el user_id del perfil que corresponde al client_id seleccionado
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("client_id", activeClientId)
        .maybeSingle();

      setTargetUserId(profile?.id ?? userId);
    };

    resolveTarget();
  }, [userId, activeClientId, supabase]);

  // Cargar historial según el cliente activo
  useEffect(() => {
    if (!targetUserId) return;

    const fetchRequests = async () => {
      const data = await getResearchHistory({ userId: targetUserId });
      setRequests(data || []);
      setSelectedRequest(data && data.length ? data[0] : null);
    };

    fetchRequests();
  }, [targetUserId]);

  // Cargar resultado del request seleccionado
  useEffect(() => {
    if (!selectedRequest) {
      setResult(null);
      return;
    }
    if (selectedRequest.status === "completed") {
      getResearchResult(selectedRequest.id).then(setResult).catch(() => setResult(null));
    } else {
      setResult(null);
    }
  }, [selectedRequest]);

  // Handlers
  const handleCompetitorChange = (i: number, value: string) => {
    setCompetitors((prev) => prev.map((v, idx) => (idx === i ? value : v)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const filtered = competitors.filter((url) => url.trim() !== "");
      // Obtener el id del usuario autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("No hay sesión activa. Por favor, inicia sesión nuevamente.");
        setLoading(false);
        setHasSession(false);
        router.replace("/login");
        return;
      }
      // Usar siempre el propio usuario
      const clientId = user.id;
      // Obtener access_token de la sesión actual
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("No hay sesión activa. Por favor, inicia sesión nuevamente.");
        setLoading(false);
        setHasSession(false);
        router.replace("/login");
        return;
      }
      const res = await fetch("/api/market-intelligence/create-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform.toLowerCase(),
          timeframe_days: Number(timeframe),
          competitors: filtered,
          access_token: session.access_token,
          client_id: clientId // Enviar el id del usuario autenticado
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear request");
      setLoading(false);
      setPlatform("");
      setTimeframe("");
      setCompetitors(["", "", "", "", ""]);
      // Recargar la página después de crear el request
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleDelete = async (requestId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setDeletingId(requestId);
    try {
      await fetch("/api/market-intelligence/delete-request", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ request_id: requestId }),
      });
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (selectedRequest?.id === requestId) {
        setSelectedRequest(null);
        setResult(null);
      }
      if (expandedId === requestId) setExpandedId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="px-4 py-12 max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Smart Scale · IA 1.0</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Market Intelligence</h1>
          <p className="text-sm text-white/40">Investigación competitiva automatizada con inteligencia artificial.</p>
        </div>

        {/* Sección 1 – Laboratorio de Inteligencia */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
          <div className="flex items-center gap-2.5 mb-6">
            <span className="h-3 w-[2px] rounded-full bg-[#ffde21]/60" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50">Laboratorio de Inteligencia de Mercado</h2>
          </div>
          {!hasSession ? (
            <div className="text-red-500 font-sans text-lg mb-4">No hay sesión activa. Por favor, inicia sesión para continuar.</div>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10" aria-disabled={!hasSession}>
              <div>
                  <Label className="mb-2 block text-white/40 text-xs font-semibold uppercase tracking-wider">Entorno de Análisis</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl text-white/80 text-sm">
                    <SelectValue placeholder="Selecciona entorno competitivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                  <Label className="mb-2 block text-white/40 text-xs font-semibold uppercase tracking-wider">Horizonte Temporal</Label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl text-white/80 text-sm">
                    <SelectValue placeholder="Selecciona horizonte de análisis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Últimos 30 días</SelectItem>
                    <SelectItem value="60">Últimos 60 días</SelectItem>
                    <SelectItem value="90">Últimos 90 días</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
              {[1,2,3,4,5].map(i => (
                <div key={i}>
                    <Label htmlFor={`competitor-url-${i}`} className="mb-2 block text-white/40 text-[10px] font-semibold uppercase tracking-wider">Referencia {i}</Label>
                  <Input
                    id={`competitor-url-${i}`}
                    placeholder="URL competidor"
                    value={competitors[i-1]}
                    onChange={e => handleCompetitorChange(i-1, e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl text-white/80 text-sm placeholder:text-white/20"
                  />
                </div>
              ))}
            </div>
            {error && <div className="text-red-500 mt-2 font-sans text-lg">{error}</div>}
            <div className="pt-6">
                <Button type="submit" disabled={loading} className="w-full md:w-auto px-8 py-2.5 rounded-xl text-sm font-bold bg-[#ffde21] text-black hover:bg-[#ffe46b] disabled:opacity-50">
                  {loading ? "Enviando…" : "Iniciar Investigación"}
                </Button>
                {!hasSession && (
                  <div className="text-red-500 mt-2 font-sans text-lg">Debes iniciar sesión para enviar una investigación.</div>
                )}
            </div>
          </form>
          {loading && (
            <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
              <AiLoading
                title="Iniciando investigación"
                steps={[
                  "Validando competidores…",
                  "Conectando con la plataforma…",
                  "Procesando solicitud…",
                  "Esto puede tardar unos minutos…",
                ]}
              />
            </div>
          )}
        </div>

        {/* Sección 2 – Historial de Investigaciones */}
        <div className="mb-8 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-[2px] rounded-full bg-[#ffde21]/60" />
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50">Investigaciones anteriores</h2>
            </div>
            {requests.length > 0 && (
              <span className="text-[10px] text-white/25 tabular-nums">{requests.length} registros</span>
            )}
          </div>

          {requests && requests.length > 0 ? (
            <div className="divide-y divide-white/[0.04]">
              {requests.map((req: any) => {
                const isExpanded = expandedId === req.id;
                const isSelected = selectedRequest?.id === req.id;
                const competitorCount = Array.isArray(req.competitors) ? req.competitors.length : 0;
                const competitorNames = Array.isArray(req.competitors)
                  ? req.competitors.map((c: any) => typeof c === "string" ? c : (c?.name || c?.channel_url || "Canal")).slice(0, 3)
                  : [];

                return (
                  <div key={req.id} className="group transition-colors hover:bg-white/[0.015]">
                    {/* Row */}
                    <div className="flex items-center gap-3 px-6 py-4">
                      {/* Platform icon */}
                      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07]">
                        <Youtube className="w-3.5 h-3.5 text-white/40" />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-sm font-medium text-white/80 truncate">
                            {competitorCount} {competitorCount === 1 ? "competidor" : "competidores"} · {req.timeframe_days ?? "—"} días
                          </span>
                          {/* Status badge */}
                          {req.status === "completed" ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Completado</span>
                          ) : req.status === "processing" ? (
                            <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">Procesando</span>
                          ) : req.status === "failed" ? (
                            <span className="inline-flex items-center rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">Fallido</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-white/40">Pendiente</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-white/30">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          <span className="tabular-nums">{new Date(req.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {req.status === "completed" && (
                          <button
                            onClick={() => {
                              if (isSelected) {
                                setSelectedRequest(null);
                              } else {
                                setSelectedRequest(req);
                                setTimeout(() => {
                                  resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                }, 80);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-[#ffde21]/30 hover:bg-[#ffde21]/[0.06] hover:text-[#ffde21]"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {isSelected ? "Ocultar" : "Ver análisis"}
                          </button>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : req.id)}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/35 transition-colors hover:border-white/[0.12] hover:bg-white/[0.06] hover:text-white/60"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDelete(req.id)}
                          disabled={deletingId === req.id}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/25 transition-colors hover:border-red-500/30 hover:bg-red-500/[0.08] hover:text-red-400 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded competitors */}
                    {isExpanded && (
                      <div className="px-6 pb-4 pt-0">
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">Referencias analizadas</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.isArray(req.competitors)
                              ? req.competitors.map((c: any, idx: number) => {
                                  const name = typeof c === "string" ? c : (c?.name || c?.channel_url || `Competidor ${idx + 1}`);
                                  const url = typeof c === "string" ? c : (c?.channel_url || null);
                                  return (
                                    <div key={idx} className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
                                      <span className="text-xs text-white/60 truncate max-w-[200px]">{name}</span>
                                      {url && (
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-white/25 hover:text-[#ffde21] transition-colors">
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                    </div>
                                  );
                                })
                              : <span className="text-xs text-white/30">Sin referencias</span>
                            }
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl border border-white/[0.07] bg-white/[0.03] mb-3">
                <Youtube className="w-5 h-5 text-white/20" />
              </div>
              <p className="text-sm text-white/35">No hay investigaciones registradas.</p>
              <p className="text-xs text-white/20 mt-1">Iniciá una nueva investigación arriba.</p>
            </div>
          )}
        </div>

        {/* Sección 3 – Estado del Análisis */}
        <div ref={resultsRef} className="mb-8 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] p-6">
          <div className="flex items-center gap-2.5 mb-5">
            <span className="h-3 w-[2px] rounded-full bg-[#ffde21]/60" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-white/50">Estado del Análisis</h2>
          </div>
          {selectedRequest ? (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/35 uppercase tracking-wider">Estado</span>
                {selectedRequest.status === "completed" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">Completado</span>
                ) : selectedRequest.status === "processing" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">Procesando</span>
                ) : selectedRequest.status === "failed" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">Fallido</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/40">Pendiente</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-white/35">Inicio:</span>
                <span className="text-white/60 tabular-nums">{new Date(selectedRequest.created_at).toLocaleString()}</span>
              </div>
              <div className="w-full md:w-1/3">
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${selectedRequest.status === "completed" ? "bg-emerald-500 w-full" : selectedRequest.status === "processing" ? "bg-blue-500 w-1/2" : "bg-white/20 w-1/4"}`} />
                </div>
                <span className="text-[10px] text-white/30">
                  {selectedRequest.status === "completed" ? "100% completado" : selectedRequest.status === "processing" ? "50% completado" : "25% completado"}
                </span>
                {selectedRequest.status === "failed" && selectedRequest.error_message && (
                  <div className="text-xs text-red-400 mt-1">{selectedRequest.error_message}</div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-white/35 text-sm">No hay investigación seleccionada.</p>
          )}
        </div>

        {/* Sección 4 – Resultados */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Resultados</h2>
          {result ? (
            selectedRequest?.platform === "youtube" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* LEGACY FIELDS */}
              {result.summary && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Executive Summary</span>
                  </div>
                  <div className="text-gray-200 text-base font-sans whitespace-pre-line">{result.summary}</div>
                </div>
              )}
              {result.patterns && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Patrones</span>
                  </div>
                  <ul className="text-gray-200 text-base font-sans list-disc pl-6 space-y-2">
                    {Array.isArray(result.patterns)
                      ? result.patterns.map((item: any, idx: number) => (
                          <li key={idx}>
                            {typeof item === "object"
                              ? (item.pattern || item.description
                                  ? <>
                                      {item.pattern && <div className="font-semibold">{item.pattern}</div>}
                                      {item.description && <div className="text-gray-400">{item.description}</div>}
                                    </>
                                  : <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2">{JSON.stringify(item, null, 2)}</pre>)
                              : item}
                          </li>
                        ))
                      : typeof result.patterns === "string"
                        ? result.patterns.split("\n").map((line: string, idx: number) => <li key={idx}>{line}</li>)
                        : null}
                  </ul>
                </div>
              )}
              {result.top_hooks && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Top Hooks</span>
                  </div>
                  <ul className="text-gray-200 text-base font-sans list-disc pl-6 space-y-2">
                    {Array.isArray(result.top_hooks)
                      ? result.top_hooks.map((item: any, idx: number) => (
                          <li key={idx}>
                            {typeof item === "object"
                              ? (item.framework || item.description
                                  ? <>
                                      {item.framework && <div className="font-semibold">{item.framework}</div>}
                                      {item.description && <div className="text-gray-400">{item.description}</div>}
                                    </>
                                  : <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2">{JSON.stringify(item, null, 2)}</pre>)
                              : item}
                          </li>
                        ))
                      : typeof result.top_hooks === "string"
                        ? result.top_hooks.split("\n").map((line: string, idx: number) => <li key={idx}>{line}</li>)
                        : null}
                  </ul>
                </div>
              )}
              {result.opportunities && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Oportunidades</span>
                  </div>
                  <ul className="text-gray-200 text-base font-sans list-disc pl-6 space-y-2">
                    {Array.isArray(result.opportunities)
                      ? result.opportunities.map((item: any, idx: number) => (
                          <li key={idx}>
                            {typeof item === "object"
                              ? (item.opportunity || item.description
                                  ? <>
                                      {item.opportunity && <div className="font-semibold">{item.opportunity}</div>}
                                      {item.description && <div className="text-gray-400">{item.description}</div>}
                                    </>
                                  : <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2">{JSON.stringify(item, null, 2)}</pre>)
                              : item}
                          </li>
                        ))
                      : typeof result.opportunities === "string"
                        ? result.opportunities
                            .split("\n")
                            .map((line: string, idx: number) => <li key={idx}>{line}</li>)
                        : null}
                  </ul>
                </div>
              )}
              {result.recommended_ideas && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Ideas Recomendadas</span>
                  </div>
                  <ul className="text-gray-200 text-base font-sans list-disc pl-6 space-y-2">
                    {Array.isArray(result.recommended_ideas)
                      ? result.recommended_ideas.map((item: any, idx: number) => (
                          <li key={idx}>
                            {typeof item === "object"
                              ? (item.idea || item.description
                                  ? <>
                                      {item.idea && <div className="font-semibold">{item.idea}</div>}
                                      {item.description && <div className="text-gray-400">{item.description}</div>}
                                    </>
                                  : <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2">{JSON.stringify(item, null, 2)}</pre>)
                              : item}
                          </li>
                        ))
                      : typeof result.recommended_ideas === "string"
                        ? result.recommended_ideas
                            .split("\n")
                            .map((line: string, idx: number) => <li key={idx}>{line}</li>)
                        : null}
                  </ul>
                </div>
              )}

              {/* NUEVOS CAMPOS ESPAÑOL */}
              {result.resumen_ejecutivo && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Resumen Ejecutivo</span>
                  </div>
                  <div className="text-gray-200 text-base font-sans whitespace-pre-line">{result.resumen_ejecutivo}</div>
                </div>
              )}
              {result.patrones_dominantes && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Patrones Dominantes</span>
                  </div>
                  <ul className="text-gray-200 text-base font-sans list-disc pl-6 space-y-3">
                    {Array.isArray(result.patrones_dominantes)
                      ? result.patrones_dominantes.map((item: any, idx: number) => (
                          <li key={idx}>
                            {typeof item === "object"
                              ? (item.pattern || item.description
                                  ? <>
                                      {item.pattern && <div className="font-semibold">{item.pattern}</div>}
                                      {item.description && <div className="text-gray-400">{item.description}</div>}
                                    </>
                                  : <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2">{JSON.stringify(item, null, 2)}</pre>)
                              : item}
                          </li>
                        ))
                      : typeof result.patrones_dominantes === "string"
                        ? result.patrones_dominantes.split("\n").map((line: string, idx: number) => <li key={idx}>{line}</li>)
                        : null}
                  </ul>
                </div>
              )}
              {result.frameworks_de_ganchos && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Frameworks de Ganchos</span>
                  </div>
                  <ul className="text-gray-200 text-base font-sans list-disc pl-6 space-y-3">
                    {Array.isArray(result.frameworks_de_ganchos)
                      ? result.frameworks_de_ganchos.map((item: any, idx: number) => (
                          <li key={idx}>
                            {typeof item === "object"
                              ? (item.framework || item.description
                                  ? <>
                                      {item.framework && <div className="font-semibold">{item.framework}</div>}
                                      {item.description && <div className="text-gray-400">{item.description}</div>}
                                    </>
                                  : <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2">{JSON.stringify(item, null, 2)}</pre>)
                              : item}
                          </li>
                        ))
                      : typeof result.frameworks_de_ganchos === "string"
                        ? result.frameworks_de_ganchos.split("\n").map((line: string, idx: number) => <li key={idx}>{line}</li>)
                        : null}
                  </ul>
                </div>
              )}
              {result.analisis_de_posicionamiento && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Análisis de Posicionamiento</span>
                  </div>
                  <div className="text-gray-200 text-base font-sans whitespace-pre-line">{result.analisis_de_posicionamiento}</div>
                </div>
              )}
              {result.nivel_de_sofisticacion_del_mercado && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Nivel de Sofisticación del Mercado</span>
                  </div>
                  <div className="text-gray-200 text-base font-sans whitespace-pre-line">{result.nivel_de_sofisticacion_del_mercado}</div>
                </div>
              )}
              {result.nivel_de_saturacion && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Nivel de Saturación</span>
                  </div>
                  <div className="text-gray-200 text-base font-sans whitespace-pre-line">{result.nivel_de_saturacion}</div>
                </div>
              )}
              {result.brechas_de_mercado && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Brechas de Mercado</span>
                  </div>
                  <ul className="text-gray-200 text-base font-sans list-disc pl-6 space-y-3">
                    {Array.isArray(result.brechas_de_mercado)
                      ? result.brechas_de_mercado.map((item: any, idx: number) => (
                          <li key={idx}>
                            {typeof item === "object"
                              ? (item.gap || item.description
                                  ? <>
                                      {item.gap && <div className="font-semibold">{item.gap}</div>}
                                      {item.description && <div className="text-gray-400">{item.description}</div>}
                                    </>
                                  : <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2">{JSON.stringify(item, null, 2)}</pre>)
                              : item}
                          </li>
                        ))
                      : typeof result.brechas_de_mercado === "string"
                        ? result.brechas_de_mercado
                            .split("\n")
                            .map((line: string, idx: number) => <li key={idx}>{line}</li>)
                        : null}
                  </ul>
                </div>
              )}
              {result.oportunidades_estrategicas && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Oportunidades Estratégicas</span>
                  </div>
                  <ul className="text-gray-200 text-base font-sans list-disc pl-6 space-y-3">
                    {Array.isArray(result.oportunidades_estrategicas)
                      ? result.oportunidades_estrategicas.map((item: any, idx: number) => (
                          <li key={idx}>
                            {typeof item === "object"
                              ? (item.opportunity || item.description
                                  ? <>
                                      {item.opportunity && <div className="font-semibold">{item.opportunity}</div>}
                                      {item.description && <div className="text-gray-400">{item.description}</div>}
                                    </>
                                  : <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2">{JSON.stringify(item, null, 2)}</pre>)
                              : item}
                          </li>
                        ))
                      : typeof result.oportunidades_estrategicas === "string"
                        ? result.oportunidades_estrategicas
                            .split("\n")
                            .map((line: string, idx: number) => <li key={idx}>{line}</li>)
                        : null}
                  </ul>
                </div>
              )}
              {result.angulos_de_contenido_recomendados && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Ángulos de Contenido Recomendados</span>
                  </div>
                  <ul className="text-gray-200 text-base font-sans list-disc pl-6 space-y-2">
                    {Array.isArray(result.angulos_de_contenido_recomendados)
                      ? result.angulos_de_contenido_recomendados.map((item: any, idx: number) => (
                          <li key={idx}>
                            {typeof item === "object"
                              ? (item.angle || item.description
                                  ? <>
                                      {item.angle && <div className="font-semibold">{item.angle}</div>}
                                      {item.description && <div className="text-gray-400">{item.description}</div>}
                                    </>
                                  : <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2">{JSON.stringify(item, null, 2)}</pre>)
                              : item}
                          </li>
                        ))
                      : typeof result.angulos_de_contenido_recomendados === "string"
                        ? result.angulos_de_contenido_recomendados.split("\n").map((line: string, idx: number) => <li key={idx}>{line}</li>)
                        : null}
                  </ul>
                </div>
              )}
              {result.estructuras_de_storytelling && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Estructuras de Storytelling</span>
                  </div>
                  <ul className="text-gray-200 text-base font-sans list-disc pl-6 space-y-3">
                    {Array.isArray(result.estructuras_de_storytelling)
                      ? result.estructuras_de_storytelling.map((item: any, idx: number) => (
                          <li key={idx}>
                            {typeof item === "object"
                              ? (item.structure || item.description
                                  ? <>
                                      {item.structure && <div className="font-semibold">{item.structure}</div>}
                                      {item.description && <div className="text-gray-400">{item.description}</div>}
                                    </>
                                  : <pre className="text-xs text-gray-400 bg-gray-900 rounded p-2">{JSON.stringify(item, null, 2)}</pre>)
                              : item}
                          </li>
                        ))
                      : typeof result.estructuras_de_storytelling === "string"
                        ? result.estructuras_de_storytelling.split("\n").map((line: string, idx: number) => <li key={idx}>{line}</li>)
                        : null}
                  </ul>
                </div>
              )}
              {result.datos_brutos_de_la_competencia && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Datos Brutos de la Competencia</span>
                  </div>
                  <pre className="text-gray-200 text-base font-sans whitespace-pre-wrap">{JSON.stringify(result.datos_brutos_de_la_competencia, null, 2)}</pre>
                </div>
              )}
              {result.analisis_completo && (
                <div className="bg-black rounded-xl p-8 min-h-[120px] border border-gray-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-lg text-gray-100">Análisis Completo</span>
                  </div>
                  <pre className="text-gray-200 text-base font-sans whitespace-pre-wrap">{JSON.stringify(result.analisis_completo, null, 2)}</pre>
                </div>
              )}
              {result.analisis_de_videos && Array.isArray(result.analisis_de_videos) && (
                <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-gray-900 via-black to-gray-950 rounded-2xl p-10 border border-gray-800 shadow-xl flex flex-col gap-12">
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-extrabold text-2xl text-white tracking-tight">
                      Análisis Individual de Videos
                    </span>
                  </div>
                  <div className="space-y-12">
                    {result.analisis_de_videos.map((video: any, idx: number) => (
                      <div
                        key={idx}
                        className="border border-gray-800 rounded-2xl p-8 bg-black/80 flex flex-col gap-8 shadow-lg transition-all hover:shadow-2xl"
                      >
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
                          <div className="flex gap-7">
                            {video.thumbnail_url ? (
                              <div className="shrink-0 flex flex-col items-center gap-2">
                                <a
                                  href={video.video_url || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <img
                                    src={video.thumbnail_url}
                                    alt={video.video_title || "Thumbnail"}
                                    className="w-48 h-auto rounded-xl border border-gray-800 object-cover hover:scale-105 transition-transform"
                                    loading="lazy"
                                  />
                                </a>
                                {video.hook_type && (
                                  <HookBadge hook={video.hook_type} />
                                )}
                              </div>
                            ) : null}
                            <div className="space-y-3">
                              {video.creator ? (
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                                  <span className="text-gray-200 font-semibold">{video.creator}</span>
                                </div>
                              ) : null}
                              {video.video_title ? (
                                <div className="text-xl font-bold text-gray-100 leading-snug">
                                  {video.video_title}
                                </div>
                              ) : null}
                              {video.video_url ? (
                                <a
                                  href={video.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 underline text-sm break-all hover:text-blue-300 transition-colors"
                                >
                                  <svg className="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 3v2a1 1 0 0 1-1 1H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V3"/></svg>
                                  {video.video_url}
                                </a>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-2">
                                {typeof video.views === "number" ? (
                                  <span className="px-3 py-1 rounded bg-gray-900 border border-gray-800 flex items-center gap-1">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    Vistas: <span className="text-gray-200 font-semibold">{video.views.toLocaleString()}</span>
                                  </span>
                                ) : null}
                                {video.video_duration ? (
                                  <span className="px-3 py-1 rounded bg-gray-900 border border-gray-800 flex items-center gap-1">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
                                    Duración: <span className="text-gray-200 font-semibold">{video.video_duration}</span>
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          {/* El badge ahora está sobre la miniatura, no aquí */}
                        </div>
                        <hr className="my-6 border-gray-800" />
                        {/* Video analysis */}
                        {video.video_analysis ? (
                          <div className="bg-gray-900/60 rounded-xl p-6">
                            <div className="font-bold text-lg text-green-200 mb-2">
                              Análisis del Video
                            </div>
                            <div className="text-gray-300 text-base whitespace-pre-line">
                              {video.video_analysis}
                            </div>
                          </div>
                        ) : null}
                        {/* Transcript (collapsible) */}
                        {video.video_transcript && typeof video.video_transcript === "string" && video.video_transcript.trim().length > 0 ? (
                          <details className="rounded-xl border border-gray-800 bg-black/30 p-4 mt-4">
                            <summary className="cursor-pointer font-semibold text-gray-100">
                              Ver transcripción
                            </summary>
                            <div className="mt-3 text-gray-300 text-base whitespace-pre-line">
                              {video.video_transcript.trim()}
                            </div>
                          </details>
                        ) : null}
                        {/* Breakdown */}
                        {video.structural_breakdown && (
                          <div className="bg-gray-900/60 rounded-xl p-6 mt-6">
                            <div className="font-bold text-lg text-blue-200 mb-2">
                              Desglose Estructural
                            </div>
                            <div className="text-gray-300 text-base whitespace-pre-line">
                              {video.structural_breakdown}
                            </div>
                          </div>
                        )}
                        {/* Why it performed */}
                        {video.why_it_performed && (
                          <div className="bg-gray-900/60 rounded-xl p-6 mt-6">
                            <div className="font-bold text-lg text-yellow-200 mb-2">
                              ¿Por qué funcionó?
                            </div>
                            <div className="text-gray-300 text-base whitespace-pre-line">
                              {video.why_it_performed}
                            </div>
                          </div>
                        )}
                        {/* Replicable elements */}
                        {video.replicable_elements && (
                          <div className="bg-gray-900/60 rounded-xl p-6 mt-6">
                            <div className="font-bold text-lg text-pink-200 mb-2">
                              Elementos Replicables
                            </div>
                            <div className="text-gray-300 text-base whitespace-pre-line">
                              {video.replicable_elements}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            ) : selectedRequest?.platform === "instagram" ? (
              <div className="grid grid-cols-1 gap-8">
                <div className="bg-black rounded-xl p-8 border border-gray-800">
                  <span className="font-bold text-lg text-gray-100">
                    Devolución Instagram
                  </span>
                </div>

                {result.patrones_dominantes && (
                  <div className="bg-black rounded-xl p-8 border border-gray-800">
                    <span className="font-bold text-lg text-gray-100">
                      Patrones Dominantes
                    </span>
                    <pre className="text-gray-300 whitespace-pre-wrap mt-4">
                      {JSON.stringify(result.patrones_dominantes, null, 2)}
                    </pre>
                  </div>
                )}

                {result.analisis_de_posicionamiento && (
                  <div className="bg-black rounded-xl p-8 border border-gray-800">
                    <span className="font-bold text-lg text-gray-100">
                      Análisis de Posicionamiento
                    </span>
                    <div className="text-gray-300 whitespace-pre-line mt-4">
                      {result.analisis_de_posicionamiento}
                    </div>
                  </div>
                )}

                {result.nivel_de_sofisticacion_del_mercado && (
                  <div className="bg-black rounded-xl p-8 border border-gray-800">
                    <span className="font-bold text-lg text-gray-100">
                      Nivel de Sofisticación del Mercado
                    </span>
                    <div className="text-gray-300 whitespace-pre-line mt-4">
                      {result.nivel_de_sofisticacion_del_mercado}Eve
                    </div>
                  </div>
                )}

                {result.angulos_de_contenido_recomendados && (
                  <div className="bg-black rounded-xl p-8 border border-gray-800">
                    <span className="font-bold text-lg text-gray-100">
                      Ángulos de Contenido Recomendados
                    </span>
                    <pre className="text-gray-300 whitespace-pre-wrap mt-4">
                      {JSON.stringify(result.angulos_de_contenido_recomendados, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : null
          ) : (
            <div className="text-gray-400 font-bold text-lg">
              No hay hallazgos estratégicos disponibles.
            </div>
          )}
        </Card>
      </div>
  );
}

function HookBadge({ hook }: { hook: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2 w-44 max-w-xs select-none">
      <div
        className={
          "bg-gradient-to-r from-green-700 via-green-500 to-green-300 bg-opacity-80 text-white text-xs font-bold rounded-xl px-3 py-2 border border-green-700 shadow-md backdrop-blur-sm cursor-pointer text-sm p-2 z-20 transition-all " +
          (expanded ? "whitespace-normal overflow-visible" : "truncate whitespace-nowrap overflow-hidden")
        }
        title={expanded ? undefined : hook}
        onClick={() => setExpanded((v) => !v)}
      >
        <svg className="inline w-4 h-4 mr-2 align-middle" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 17c0 1.1.9 2 2 2s2-.9 2-2c0-2-4-2-4-6 0-2.21 1.79-4 4-4s4 1.79 4 4c0 4-4 4-4 6z"/></svg>
        <span className="align-middle font-bold">Hook:</span> <span className="align-middle">{hook}</span>
        <span className="ml-2 text-green-100/70 text-xs font-normal">{expanded ? "(ver menos)" : "(ver más)"}</span>
      </div>
    </div>
  );
}
