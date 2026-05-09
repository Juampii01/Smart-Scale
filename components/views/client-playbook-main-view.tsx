"use client"

/**
 * Playbook único del cliente — un solo documento BlockNote por cliente.
 *
 *  - admin/team: editan todo el contenido sin restricciones.
 *  - client: el editor es interactivo (editable=true) para que pueda tildar
 *    checkboxes — pero apenas detecta un cambio que NO sea solo `props.checked`
 *    en checkListItems existentes, revierte el editor al último estado guardado
 *    y muestra "No se puede editar el texto" en rojo. El servidor también
 *    rechaza con 403 esos cambios como segunda capa de defensa.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Sparkles, FileText } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/core/fonts/inter.css"
import "@blocknote/mantine/style.css"
import "./centro-op-pages-view.css"
import { isOnlyCheckboxToggleChange } from "@/lib/playbook-diff"

interface PlaybookRow {
  client_id:  string
  content:    any[]
  updated_by: string | null
  created_at: string
  updated_at: string
}

async function authedFetch(path: string, init?: RequestInit) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error("No autenticado")
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })
}

export function ClientPlaybookMainView({ userRole }: { userRole: string | null }) {
  const activeClientId = useActiveClient()
  const role = String(userRole ?? "").toLowerCase()
  const canManage = role === "admin" || role === "team"

  const [playbook, setPlaybook] = useState<PlaybookRow | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  // Última versión confirmada (lo que está en DB). Para revertir cuando el
  // cliente intenta editar texto y para el diff client-side.
  const lastSavedRef = useRef<any[]>([])
  // Bandera para ignorar el onChange disparado por nuestro propio replaceBlocks
  const ignoreNextChangeRef = useRef(false)

  const load = useCallback(async () => {
    if (!activeClientId) { setPlaybook(null); setLoading(false); return }
    setLoading(true)
    try {
      const res = await authedFetch(`/api/client-playbook-main?client_id=${encodeURIComponent(activeClientId)}`)
      const json = await res.json()
      const pb: PlaybookRow | null = res.ok ? (json.playbook ?? null) : null
      setPlaybook(pb)
      lastSavedRef.current = pb?.content ?? []
    } finally { setLoading(false) }
  }, [activeClientId])

  useEffect(() => { load() }, [load])

  const createPlaybook = async () => {
    if (!activeClientId || !canManage) return
    setCreating(true)
    try {
      const res = await authedFetch("/api/client-playbook-main", {
        method: "PUT",
        body:   JSON.stringify({ client_id: activeClientId, content: [] }),
      })
      const json = await res.json()
      if (!res.ok || !json.playbook) {
        alert(json?.error ?? "Error creando playbook")
        return
      }
      setPlaybook(json.playbook)
      lastSavedRef.current = json.playbook.content ?? []
    } finally { setCreating(false) }
  }

  // ── Editor ──────────────────────────────────────────────────────────────────
  // Recreamos cuando cambia activeClientId o cuando aparece/desaparece playbook.
  // Mientras se edita NO recreamos (el ref de last-saved se actualiza, pero
  // el editor mantiene su estado interno).
  const editor = useCreateBlockNote(
    {
      initialContent: playbook?.content && playbook.content.length > 0
        ? playbook.content
        : undefined,
    },
    [activeClientId, playbook ? "loaded" : "empty"],
  )

  useEffect(() => {
    if (!editor || !playbook) return

    const handler = () => {
      if (ignoreNextChangeRef.current) {
        ignoreNextChangeRef.current = false
        return
      }
      const newContent = editor.document
      const prev = lastSavedRef.current

      // Cliente: validar diff localmente antes de mandar al server
      if (!canManage) {
        if (!isOnlyCheckboxToggleChange(prev, newContent)) {
          // Revertir
          ignoreNextChangeRef.current = true
          try {
            editor.replaceBlocks(editor.document, prev as any)
          } catch {
            // Si replaceBlocks falla por alguna razón, refetch todo
            load()
          }
          setSavingState("error")
          setErrorMsg("No se puede editar el texto. Solo podés tildar checkboxes.")
          return
        }
      }

      // Save (común a admin/team y a checkboxes válidos del cliente)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        if (!activeClientId) return
        setSavingState("saving")
        setErrorMsg(null)
        try {
          const res = await authedFetch("/api/client-playbook-main", {
            method: "PUT",
            body:   JSON.stringify({ client_id: activeClientId, content: newContent }),
          })
          const json = await res.json()
          if (!res.ok) {
            setSavingState("error")
            setErrorMsg(json?.error ?? "Error guardando")
            return
          }
          lastSavedRef.current = newContent
          setSavingState("saved")
          setTimeout(() => setSavingState(prev => prev === "saved" ? "idle" : prev), 1500)
        } catch {
          setSavingState("error")
          setErrorMsg("Error de red")
        }
      }, 800)
    }

    editor.onChange(handler)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [editor, playbook, activeClientId, canManage, load])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!activeClientId) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-5 py-10 text-center text-sm text-foreground/40">
        No hay un cliente activo seleccionado.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-2xl border border-foreground/[0.07] bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-foreground/40" />
      </div>
    )
  }

  // Sin playbook
  if (!playbook) {
    if (canManage) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-foreground/[0.07] bg-card px-6 py-16 text-center">
          <Sparkles className="h-10 w-10 text-foreground/20" />
          <div>
            <h3 className="text-base font-bold text-foreground">Playbook aún no creado</h3>
            <p className="mt-1 text-[13px] text-foreground/50 max-w-md">
              Creá el documento del playbook para este cliente. Acá vas a poder armar checklists y notas; el cliente solo va a poder tildar/destildar los checkboxes.
            </p>
          </div>
          <button
            onClick={createPlaybook}
            disabled={creating}
            className="inline-flex items-center gap-2 h-9 rounded-xl bg-[#ffde21] px-4 text-[13px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Crear playbook
          </button>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-6 py-16 text-center">
        <FileText className="h-10 w-10 text-foreground/15" />
        <div>
          <h3 className="text-base font-bold text-foreground/70">Tu playbook aún no fue creado</h3>
          <p className="mt-1 text-[13px] text-foreground/45 max-w-md">
            Apenas Ann lo arme, vas a verlo acá.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-foreground/[0.07] bg-card overflow-hidden">
      {/* Save indicator bar */}
      <div className="flex items-center justify-between gap-3 border-b border-foreground/[0.06] px-6 py-2.5">
        <div className="flex items-center gap-2 text-[12px]">
          {!canManage && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/[0.1] bg-foreground/[0.04] px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-foreground/55">
              Solo checkboxes editables
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] min-w-[140px] justify-end">
          {savingState === "saving" && <span className="text-foreground/40 inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Guardando…</span>}
          {savingState === "saved"  && <span className="text-emerald-700 dark:text-emerald-400">✓ Guardado</span>}
          {savingState === "error"  && (
            <span className="text-red-700 dark:text-red-400 font-medium" title={errorMsg ?? ""}>
              {errorMsg ?? "Error"}
            </span>
          )}
        </div>
      </div>

      <div className="bg-card">
        <div className="mx-auto max-w-3xl px-8 py-6 centro-op-bn">
          <BlockNoteView
            editor={editor}
            theme="light"
            editable={true}
            className="centro-op-blocknote"
          />
        </div>
      </div>
    </div>
  )
}
