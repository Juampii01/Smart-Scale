"use client"
import { DashboardLayout } from "../../components/dashboard-layout";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getLatestResearchRequest, getResearchResult, getResearchHistory } from "../../lib/marketIntelligence";
import { createClient } from "../../lib/supabaseClient";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";

export default function MarketIntelligencePage() {
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
  // Eliminado: const activeClientId = useActiveClient();

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

  // Cargar requests según usuario activo (admin puede cambiar de cliente)
  // Eliminado: lógica de cambio de cliente para admin
  const targetUserId = userId;

  useEffect(() => {
    if (!userId) return;

    const fetchRequests = async () => {
      const data = await getResearchHistory({ userId });
      setRequests(data || []);
      setSelectedRequest(data && data.length ? data[0] : null);
    };

    fetchRequests();
  }, [userId]);

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

  return (
    <DashboardLayout key={userId}>
      <div className="px-4 py-12 max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-white mb-2">Smart Scale Market Intelligence IA 1.0</h1>
          <h2 className="text-xl font-semibold text-gray-300 mb-4">Investigación Competitiva Automatizada con Inteligencia Artificial</h2>
          <p className="text-muted-foreground text-lg">Esta plataforma utiliza IA avanzada para analizar y comparar competidores, detectar oportunidades y ayudarte a escalar tu negocio con insights accionables.</p>
        </div>

        {/* Sección 1 – Laboratorio de Inteligencia */}
        <Card className="mb-8 p-6">
          <h2 className="text-3xl font-bold mb-8 text-gray-100 tracking-tight">Laboratorio de Inteligencia de Mercado</h2>
          {!hasSession ? (
            <div className="text-red-500 font-sans text-lg mb-4">No hay sesión activa. Por favor, inicia sesión para continuar.</div>
          ) : null}
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10" aria-disabled={!hasSession}>
              <div>
                  <Label className="mb-2 block text-gray-400 font-sans text-lg">Entorno de Análisis</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="w-full bg-black border border-gray-800 rounded-xl text-gray-200 text-lg font-sans">
                    <SelectValue placeholder="Selecciona entorno competitivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                  <Label className="mb-2 block text-gray-400 font-sans text-lg">Horizonte Temporal</Label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="w-full bg-black border border-gray-800 rounded-xl text-gray-200 text-lg font-sans">
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
                    <Label htmlFor={`competitor-url-${i}`} className="mb-2 block text-gray-400 font-sans text-lg">Referencia Estratégica {i}</Label>
                  <Input
                    id={`competitor-url-${i}`}
                    placeholder="URL de referencia competitiva"
                    value={competitors[i-1]}
                    onChange={e => handleCompetitorChange(i-1, e.target.value)}
                    className="w-full bg-black border border-gray-800 rounded-xl text-gray-200 text-lg font-sans placeholder:text-gray-500"
                  />
                </div>
              ))}
            </div>
            {error && <div className="text-red-500 mt-2 font-sans text-lg">{error}</div>}
            <div className="pt-6">
                <Button type="submit" disabled={loading} className="w-full md:w-auto px-10 py-4 rounded-xl font-sans text-lg bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-800 tracking-tight">
                  {loading ? "Procesando..." : "Iniciar Investigación Ejecutiva"}
                </Button>
                {!hasSession && (
                  <div className="text-red-500 mt-2 font-sans text-lg">Debes iniciar sesión para enviar una investigación.</div>
                )}
            </div>
          </form>
        </Card>

        {/* Sección 2 – Historial de Investigaciones */}
        <Card className="mb-8 p-6">
          <h2 className="text-2xl font-bold font-sans mb-8 text-gray-100 tracking-tight">
            Archivo de Investigaciones Estratégicas
          </h2>

          {requests && requests.length > 0 ? (
            <div className="space-y-6">
              {requests.map((req: any) => (
                <div
                  key={req.id}
                  className="border border-gray-800 rounded-xl p-6 bg-black flex flex-col md:flex-row md:items-center md:justify-between gap-6"
                >
                  <div className="space-y-3">
                    <div className="text-sm text-gray-400">
                      {new Date(req.created_at).toLocaleString()}
                    </div>

                    <div className="flex items-center gap-3">
                      {selectedRequest?.id === req.id ? (
                        <ul className="flex flex-wrap gap-3">
                          {Array.isArray(req.competitors)
                            ? req.competitors.map((c: string, idx: number) => (
                                <li
                                  key={idx}
                                  className="inline-block px-4 py-2 rounded bg-gray-900 text-xs text-gray-100 border border-gray-800 font-sans"
                                >
                                  {c}
                                </li>
                              ))
                            : null}
                        </ul>
                      ) : (
                        <span className="inline-block px-4 py-2 rounded bg-gray-900 text-xs text-gray-300 border border-gray-800 font-sans">
                          {Array.isArray(req.competitors)
                            ? `${req.competitors.length} referencias`
                            : "Referencias"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    {req.status === "completed" ? (
                      <span className="inline-block px-4 py-2 rounded bg-gray-800 text-green-200 text-xs font-semibold border border-gray-800 tracking-tight">
                        Completado
                      </span>
                    ) : req.status === "processing" ? (
                      <span className="inline-block px-4 py-2 rounded bg-gray-800 text-gray-200 text-xs font-semibold border border-gray-800 tracking-tight">
                        Procesando
                      </span>
                    ) : req.status === "failed" ? (
                      <span className="inline-block px-4 py-2 rounded bg-gray-800 text-red-200 text-xs font-semibold border border-gray-800 tracking-tight">
                        Fallido
                      </span>
                    ) : (
                      <span className="inline-block px-4 py-2 rounded bg-gray-800 text-gray-300 text-xs font-semibold border border-gray-800 tracking-tight">
                        Pendiente
                      </span>
                    )}

                    <Button
                      size="sm"
                      variant={selectedRequest?.id === req.id ? "default" : "outline"}
                      className="font-sans bg-black border border-gray-800 text-gray-200 hover:bg-gray-900 hover:border-green-700 px-6 py-2 rounded-xl text-base"
                      onClick={() => {
                        if (selectedRequest?.id === req.id) {
                          setSelectedRequest(null);
                        } else {
                          setSelectedRequest(req);
                        }
                      }}
                    >
                      {selectedRequest?.id === req.id
                        ? "Ocultar Detalle"
                        : "Ver Detalle"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 font-sans text-lg">
              No hay investigaciones estratégicas registradas.
            </div>
          )}
        </Card>

        {/* Sección 3 – Estado del Análisis */}
        <Card className="mb-8 p-6">
          <h2 className="text-xl font-semibold mb-4">Estado del Análisis</h2>
          <h2 className="text-2xl font-sans mb-8 text-gray-100 tracking-tight">Estado de Investigación</h2>
          <h2 className="text-2xl font-bold font-sans mb-8 text-gray-100 tracking-tight">Estado de Investigación</h2>
          {selectedRequest ? (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 py-8">
              <div className="flex items-center gap-4">
                <span className="font-bold text-lg text-gray-300">Estado:</span>
                {selectedRequest.status === "completed" ? (
                  <span className="inline-block px-4 py-2 rounded bg-gray-900 text-green-200 text-xs font-semibold border border-gray-800 tracking-tight">Completado</span>
                ) : selectedRequest.status === "processing" ? (
                  <span className="inline-block px-4 py-2 rounded bg-gray-900 text-blue-200 text-xs font-semibold border border-gray-800 tracking-tight">Procesando</span>
                ) : selectedRequest.status === "failed" ? (
                  <span className="inline-block px-4 py-2 rounded bg-gray-900 text-red-200 text-xs font-semibold border border-gray-800 tracking-tight">Fallido</span>
                ) : (
                  <span className="inline-block px-4 py-2 rounded bg-gray-900 text-gray-300 text-xs font-semibold border border-gray-800 tracking-tight">Pendiente</span>
                )}
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-lg text-gray-300">Fecha de inicio:</span>
                <span className="text-gray-100 font-bold text-lg">{new Date(selectedRequest.created_at).toLocaleString()}</span>
              </div>
              <div className="w-full md:w-1/3">
                {/* Barra de progreso mock */}
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-2 ${selectedRequest.status === "completed" ? "bg-green-700 w-full" : selectedRequest.status === "processing" ? "bg-gray-600 w-2/4" : "bg-gray-700 w-1/4"}`} />
                </div>
                <span className="text-xs text-gray-400 font-bold">
                  {selectedRequest.status === "completed" ? "100% completado" : selectedRequest.status === "processing" ? "50% completado" : "25% completado"}
                </span>
                {selectedRequest.status === "failed" && selectedRequest.error_message && (
                  <div className="text-xs text-red-400 mt-2 font-bold">{selectedRequest.error_message}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-gray-400 font-bold text-lg">No hay investigación seleccionada.</div>
          )}
        </Card>

        {/* Sección 4 – Resultados */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Resultados</h2>
          <h2 className="text-2xl font-sans mb-8 text-gray-100 tracking-tight">Hallazgos Estratégicos</h2>
          <h2 className="text-2xl font-bold font-sans mb-8 text-gray-100 tracking-tight">Hallazgos Estratégicos</h2>
          {result ? (
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
                            {typeof item === "object" ? (
                              <>
                                {item.pattern && <div className="font-semibold">{item.pattern}</div>}
                                {item.description && <div className="text-gray-400">{item.description}</div>}
                              </>
                            ) : (
                              item
                            )}
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
                            {typeof item === "object" ? (
                              <>
                                {item.framework && <div className="font-semibold">{item.framework}</div>}
                                {item.description && <div className="text-gray-400">{item.description}</div>}
                              </>
                            ) : (
                              item
                            )}
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
                            {typeof item === "object" ? (
                              <>
                                {item.opportunity && (
                                  <div className="font-semibold">{item.opportunity}</div>
                                )}
                                {item.description && (
                                  <div className="text-gray-400">{item.description}</div>
                                )}
                              </>
                            ) : (
                              item
                            )}
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
                            {typeof item === "object" ? (
                              <>
                                {item.idea && (
                                  <div className="font-semibold">{item.idea}</div>
                                )}
                                {item.description && (
                                  <div className="text-gray-400">{item.description}</div>
                                )}
                              </>
                            ) : (
                              item
                            )}
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
                            {typeof item === "object" ? (
                              <>
                                {item.pattern && <div className="font-semibold">{item.pattern}</div>}
                                {item.description && <div className="text-gray-400">{item.description}</div>}
                              </>
                            ) : (
                              item
                            )}
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
                            {typeof item === "object" ? (
                              <>
                                {item.framework && <div className="font-semibold">{item.framework}</div>}
                                {item.description && <div className="text-gray-400">{item.description}</div>}
                              </>
                            ) : (
                              item
                            )}
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
                            {typeof item === "object" ? (
                              <>
                                {item.gap && <div className="font-semibold">{item.gap}</div>}
                                {item.description && <div className="text-gray-400">{item.description}</div>}
                              </>
                            ) : (
                              item
                            )}
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
                            {typeof item === "object" ? (
                              <>
                                {item.opportunity && <div className="font-semibold">{item.opportunity}</div>}
                                {item.description && <div className="text-gray-400">{item.description}</div>}
                              </>
                            ) : (
                              item
                            )}
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
                            {typeof item === "object" ? (
                              <>
                                {item.angle && <div className="font-semibold">{item.angle}</div>}
                                {item.description && <div className="text-gray-400">{item.description}</div>}
                              </>
                            ) : (
                              item
                            )}
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
                            {typeof item === "object" ? (
                              <>
                                {item.structure && <div className="font-semibold">{item.structure}</div>}
                                {item.description && <div className="text-gray-400">{item.description}</div>}
                              </>
                            ) : (
                              item
                            )}
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
            </div>
          ) : (
            <div className="text-gray-400 font-bold text-lg">No hay hallazgos estratégicos disponibles.</div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
