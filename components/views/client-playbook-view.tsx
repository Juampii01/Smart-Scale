"use client"

import { isAdmin as isAdminRole } from "@/lib/auth/permissions"

/**
 * Documentos del cliente — vista tipo Notion con multi-página por cliente.
 *
 *  - admin/team: ve y edita los documentos del cliente activo. Puede crear
 *    sub-páginas, eliminar, reordenar (drag-and-drop dentro del mismo padre).
 *    Cuando entran a un cliente sin páginas, se autosiembran 4 docs vacíos
 *    (Investigación, Avatar, Oferta, IP).
 *  - client: ve y edita SUS documentos. NO puede crear/eliminar/reordenar.
 *
 * Auto-save: 800ms debounce en contenido, 600ms en título/icon.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ChevronRight, ChevronDown, Plus, Trash2, FileText, Loader2,
  Search, GripVertical,
} from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/core/fonts/inter.css"
import "@blocknote/mantine/style.css"
import "./centro-op-pages-view.css"
import { PLAYBOOK_SEED } from "@/lib/playbook-template"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Page {
  id:         string
  client_id:  string
  parent_id:  string | null
  title:      string
  icon:       string | null
  content:    any[]
  sort_order: number
  is_seed:    boolean
  created_at: string
  updated_at: string
}

interface TreeNode {
  page:     Page
  children: TreeNode[]
}

interface DragState {
  draggedId: string
  parentId:  string | null
  overId:    string | null
  position:  "above" | "below" | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTree(pages: Page[]): TreeNode[] {
  const byParent: Record<string, Page[]> = {}
  for (const p of pages) {
    const key = p.parent_id ?? "__root__"
    if (!byParent[key]) byParent[key] = []
    byParent[key].push(p)
  }
  for (const key in byParent) {
    byParent[key].sort((a, b) =>
      a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
    )
  }
  const buildNode = (p: Page): TreeNode => ({
    page:     p,
    children: (byParent[p.id] ?? []).map(buildNode),
  })
  return (byParent["__root__"] ?? []).map(buildNode)
}

function flattenAncestors(pages: Page[], pageId: string): Page[] {
  const byId: Record<string, Page> = {}
  for (const p of pages) byId[p.id] = p
  const chain: Page[] = []
  let curr: Page | undefined = byId[pageId]
  while (curr) {
    chain.unshift(curr)
    curr = curr.parent_id ? byId[curr.parent_id] : undefined
  }
  return chain
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

// ─── Tree row ─────────────────────────────────────────────────────────────────

function TreeRow({
  node, depth, selectedId, expanded, canManage, canCreate,
  dragState, onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  onToggle, onSelect, onAddChild, onDelete,
}: {
  node:        TreeNode
  depth:       number
  selectedId:  string | null
  expanded:    Set<string>
  canManage:   boolean   // admin/team — controla delete
  canCreate:   boolean   // admin/team/client — controla crear subpágina y drag
  dragState:   DragState | null
  onDragStart: (id: string, parentId: string | null) => void
  onDragOver:  (e: React.DragEvent, id: string, parentId: string | null) => void
  onDragLeave: (id: string) => void
  onDrop:      (id: string, parentId: string | null) => void
  onDragEnd:   () => void
  onToggle:    (id: string) => void
  onSelect:    (id: string) => void
  onAddChild:  (parentId: string) => void
  onDelete:    (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isExpanded  = expanded.has(node.page.id)
  const isSelected  = selectedId === node.page.id
  const [hovered, setHovered] = useState(false)

  const isDragged = dragState?.draggedId === node.page.id
  const showLineAbove = dragState?.overId === node.page.id && dragState.position === "above"
  const showLineBelow = dragState?.overId === node.page.id && dragState.position === "below"

  return (
    <>
      {showLineAbove && <div className="h-0.5 bg-[#ffde21] mx-2 rounded-full" />}

      <div
        draggable={canCreate}
        onDragStart={() => onDragStart(node.page.id, node.page.parent_id)}
        onDragOver={(e) => onDragOver(e, node.page.id, node.page.parent_id)}
        onDragLeave={() => onDragLeave(node.page.id)}
        onDrop={() => onDrop(node.page.id, node.page.parent_id)}
        onDragEnd={onDragEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(node.page.id)}
        className={`group flex items-center gap-1 rounded-md px-1 py-1 text-[13px] cursor-pointer transition-colors ${
          isSelected
            ? "bg-foreground/[0.08] text-foreground"
            : "text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground"
        } ${isDragged ? "opacity-40" : ""}`}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
      >
        {canCreate && (
          <span
            className={`flex h-4 w-3 shrink-0 items-center justify-center text-foreground/30 transition-opacity cursor-grab active:cursor-grabbing ${
              hovered ? "opacity-100" : "opacity-0"
            }`}
            title="Arrastrar para reordenar"
          >
            <GripVertical className="h-3 w-3" />
          </span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onToggle(node.page.id) }}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
            hasChildren ? "text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70" : "opacity-0 pointer-events-none"
          }`}
          aria-label={isExpanded ? "Colapsar" : "Expandir"}
        >
          {hasChildren && (isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
        </button>

        <span className="text-[14px] leading-none w-4 flex items-center justify-center">
          {node.page.icon ?? <FileText className="h-3.5 w-3.5 text-foreground/40" />}
        </span>

        <span className="flex-1 truncate select-none">
          {node.page.title || "Sin título"}
        </span>

        {canCreate && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(node.page.id) }}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-foreground/40 hover:bg-foreground/10 hover:text-foreground transition-all ${hovered ? "opacity-100" : "opacity-0"}`}
            aria-label="Nueva subpágina"
            title="Nueva subpágina"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
        {canManage && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (confirm(`¿Borrar "${node.page.title}" y todas sus subpáginas? La acción no se puede deshacer.`)) {
                onDelete(node.page.id)
              }
            }}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-foreground/30 hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400 transition-all ${hovered ? "opacity-100" : "opacity-0"}`}
            aria-label="Borrar"
            title="Borrar"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {showLineBelow && <div className="h-0.5 bg-[#ffde21] mx-2 rounded-full" />}

      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeRow
              key={child.page.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              canManage={canManage}
              canCreate={canCreate}
              dragState={dragState}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ─── Page editor ──────────────────────────────────────────────────────────────

function PageEditor({
  page, canEdit, onPatch,
}: {
  page:    Page
  canEdit: boolean
  onPatch: (id: string, patch: Partial<Page>) => Promise<void>
}) {
  const [title, setTitle] = useState(page.title)
  const [icon,  setIcon]  = useState(page.icon ?? "")
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle")
  const titleSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const contentSaveTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setTitle(page.title)
    setIcon(page.icon ?? "")
  }, [page.id])  // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useCreateBlockNote({
    initialContent: Array.isArray(page.content) && page.content.length > 0
      ? page.content
      : undefined,
  }, [page.id])

  const saveMeta = useCallback(async () => {
    setSavingState("saving")
    try {
      await onPatch(page.id, { title, icon: icon.trim() || null })
      setSavingState("saved")
      setTimeout(() => setSavingState("idle"), 1500)
    } catch {
      setSavingState("idle")
    }
  }, [page.id, title, icon, onPatch])

  useEffect(() => {
    if (!canEdit) return
    if (title === page.title && (icon || null) === page.icon) return
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
    titleSaveTimer.current = setTimeout(saveMeta, 600)
    return () => {
      if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
    }
  }, [title, icon, canEdit])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editor || !canEdit) return
    const handler = () => {
      if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current)
      contentSaveTimer.current = setTimeout(async () => {
        setSavingState("saving")
        try {
          await onPatch(page.id, { content: editor.document })
          setSavingState("saved")
          setTimeout(() => setSavingState("idle"), 1500)
        } catch {
          setSavingState("idle")
        }
      }, 800)
    }
    editor.onChange(handler)
    return () => {
      if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current)
    }
  }, [editor, page.id, onPatch, canEdit])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-foreground/[0.06] px-8 py-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={icon}
            onChange={e => setIcon(e.target.value)}
            placeholder="📄"
            maxLength={4}
            disabled={!canEdit}
            className="h-9 w-9 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] text-center text-base focus:border-foreground/20 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Icono"
          />
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Sin título"
            disabled={!canEdit}
            className="flex-1 bg-transparent text-2xl font-bold text-foreground placeholder:text-foreground/25 focus:outline-none disabled:cursor-not-allowed"
            aria-label="Título"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] text-foreground/40 min-w-[78px] justify-end">
            {savingState === "saving" && <><Loader2 className="h-3 w-3 animate-spin" />Guardando…</>}
            {savingState === "saved"  && <span className="text-emerald-700 dark:text-emerald-400">✓ Guardado</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-card">
        <div className="mx-auto max-w-3xl px-8 py-6 centro-op-bn">
          <BlockNoteView
            editor={editor}
            theme="light"
            editable={canEdit}
            className="centro-op-blocknote"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function ClientPlaybookView({ userRole }: { userRole: string | null }) {
  const activeClientId = useActiveClient()
  const role = String(userRole ?? "").toLowerCase()
  const canManage = isAdminRole(role) || role === "team"
  // canCreate: el cliente también puede crear nuevas páginas y reordenar.
  // Solo el delete sigue siendo admin/team (controlado por canManage en TreeRow).
  const canCreate = canManage || role === "client"
  // canEdit incluye client (puede editar texto en sus propias páginas de Documentos)
  const canEdit = canManage || role === "client"

  const [pages,    setPages]    = useState<Page[]>([])
  const [loading,  setLoading]  = useState(true)
  const [seeding,  setSeeding]  = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search,   setSearch]   = useState("")
  const [creating, setCreating] = useState(false)
  const [dragState, setDragState] = useState<DragState | null>(null)

  // ── Load + auto-seed ────────────────────────────────────────────────────────

  const loadPages = useCallback(async (): Promise<Page[]> => {
    if (!activeClientId) {
      setPages([]); setLoading(false); return []
    }
    setLoading(true)
    try {
      const res = await authedFetch(`/api/client-playbook?client_id=${encodeURIComponent(activeClientId)}`)
      const json = await res.json()
      const list: Page[] = res.ok ? (json.pages ?? []) : []
      setPages(list)
      return list
    } finally { setLoading(false) }
  }, [activeClientId])

  // Auto-seed cuando entra cualquier usuario (admin/team/client) y no hay páginas.
  // El API enforce que el cliente solo puede seedear su propio client_id.
  const seedIfEmpty = useCallback(async (current: Page[]) => {
    if (current.length > 0) return
    if (!activeClientId)    return
    setSeeding(true)
    try {
      const res = await authedFetch("/api/client-playbook", {
        method: "POST",
        body: JSON.stringify({ client_id: activeClientId, seeds: PLAYBOOK_SEED }),
      })
      const json = await res.json()
      if (res.ok && Array.isArray(json.pages)) {
        setPages(json.pages)
        if (json.pages[0]) setSelectedId(json.pages[0].id)
      }
    } finally { setSeeding(false) }
  }, [activeClientId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const list = await loadPages()
      if (cancelled) return
      if (list.length === 0) await seedIfEmpty(list)
      // Default-seleccionar primera page si no hay nada seleccionado
      else if (!selectedId)  setSelectedId(list[0].id)
    })()
    return () => { cancelled = true }
  }, [loadPages, seedIfEmpty])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search filter ───────────────────────────────────────────────────────────

  const filteredPages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pages
    const matched = new Set<string>()
    for (const p of pages) {
      if (p.title.toLowerCase().includes(q)) matched.add(p.id)
    }
    const byId: Record<string, Page> = {}
    for (const p of pages) byId[p.id] = p
    const visible = new Set(matched)
    for (const id of matched) {
      let cur: Page | undefined = byId[id]
      while (cur?.parent_id) {
        visible.add(cur.parent_id)
        cur = byId[cur.parent_id]
      }
    }
    return pages.filter(p => visible.has(p.id))
  }, [pages, search])

  const tree = useMemo(() => buildTree(filteredPages), [filteredPages])
  const selectedPage = pages.find(p => p.id === selectedId) ?? null

  // ── Tree actions ────────────────────────────────────────────────────────────

  const onToggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const onSelect = (id: string) => setSelectedId(id)

  const createPage = async (parentId: string | null) => {
    if (!activeClientId || !canCreate) return
    setCreating(true)
    try {
      const res = await authedFetch("/api/client-playbook", {
        method: "POST",
        body: JSON.stringify({
          client_id: activeClientId, parent_id: parentId, title: "Sin título", content: [],
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.page) {
        alert(json?.error ?? "Error creando")
        return
      }
      setPages(prev => [...prev, json.page])
      if (parentId) setExpanded(prev => new Set(prev).add(parentId))
      setSelectedId(json.page.id)
    } finally { setCreating(false) }
  }

  const patchPage = async (id: string, patch: Partial<Page>) => {
    const res = await authedFetch("/api/client-playbook", {
      method: "PATCH",
      body: JSON.stringify({ id, ...patch }),
    })
    const json = await res.json()
    if (!res.ok || !json.page) throw new Error(json?.error ?? "Error guardando")
    setPages(prev => prev.map(p => p.id === id ? json.page : p))
  }

  const deletePage = async (id: string) => {
    if (!canManage) return
    const res = await authedFetch("/api/client-playbook", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json?.error ?? "Error borrando")
      return
    }
    const toRemove = new Set<string>([id])
    let changed = true
    while (changed) {
      changed = false
      for (const p of pages) {
        if (p.parent_id && toRemove.has(p.parent_id) && !toRemove.has(p.id)) {
          toRemove.add(p.id); changed = true
        }
      }
    }
    setPages(prev => prev.filter(p => !toRemove.has(p.id)))
    if (selectedId && toRemove.has(selectedId)) setSelectedId(null)
  }

  // ── Drag and drop reorder ──────────────────────────────────────────────────

  const onDragStart = (id: string, parentId: string | null) => {
    setDragState({ draggedId: id, parentId, overId: null, position: null })
  }

  const onDragOver = (e: React.DragEvent, id: string, parentId: string | null) => {
    if (!dragState) return
    if (dragState.parentId !== parentId) return  // solo same-parent en v1
    if (dragState.draggedId === id)        return
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position: "above" | "below" = e.clientY < midY ? "above" : "below"
    setDragState(prev => prev ? { ...prev, overId: id, position } : prev)
  }

  const onDragLeave = (id: string) => {
    setDragState(prev => {
      if (!prev) return prev
      if (prev.overId !== id) return prev
      return { ...prev, overId: null, position: null }
    })
  }

  const onDragEnd = () => setDragState(null)

  const onDrop = async (targetId: string, targetParentId: string | null) => {
    if (!dragState) return
    if (dragState.parentId !== targetParentId) { setDragState(null); return }
    if (dragState.draggedId === targetId)       { setDragState(null); return }

    const position = dragState.position
    const draggedId = dragState.draggedId

    // Reordenar dentro del mismo padre
    const siblings = pages
      .filter(p => p.parent_id === targetParentId)
      .sort((a, b) =>
        a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)
      )

    const draggedIdx = siblings.findIndex(p => p.id === draggedId)
    const targetIdx  = siblings.findIndex(p => p.id === targetId)
    if (draggedIdx < 0 || targetIdx < 0) { setDragState(null); return }

    // Calcular nuevo orden
    const without = siblings.filter(p => p.id !== draggedId)
    const newTargetIdx = without.findIndex(p => p.id === targetId)
    const insertAt = position === "above" ? newTargetIdx : newTargetIdx + 1
    const reordered = [
      ...without.slice(0, insertAt),
      siblings[draggedIdx],
      ...without.slice(insertAt),
    ]

    // Optimistic update local — solo updateamos los siblings tocados
    const newOrders = reordered.map((p, i) => ({ id: p.id, sort_order: i }))
    setPages(prev => prev.map(p => {
      const o = newOrders.find(n => n.id === p.id)
      return o ? { ...p, sort_order: o.sort_order } : p
    }))
    setDragState(null)

    // PATCH solo los que cambiaron
    const changed = newOrders.filter(n => {
      const orig = siblings.find(s => s.id === n.id)
      return orig && orig.sort_order !== n.sort_order
    })
    try {
      await Promise.all(changed.map(c =>
        authedFetch("/api/client-playbook", {
          method: "PATCH",
          body: JSON.stringify({ id: c.id, sort_order: c.sort_order }),
        })
      ))
    } catch {
      // Rollback con refetch si algo falla
      await loadPages()
    }
  }

  const breadcrumb = selectedPage ? flattenAncestors(pages, selectedPage.id) : []

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!activeClientId) {
    return (
      <div className="rounded-2xl border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-5 py-10 text-center text-sm text-foreground/40">
        No hay un cliente activo seleccionado.
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[520px] gap-3 rounded-2xl border border-foreground/[0.07] bg-card overflow-hidden">

      {/* Sidebar */}
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-foreground/[0.06] bg-foreground/[0.015]">
        <div className="border-b border-foreground/[0.06] px-3 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40">Documentos</h3>
            {canCreate && (
              <button
                onClick={() => createPage(null)}
                disabled={creating || seeding}
                className="flex h-6 w-6 items-center justify-center rounded text-foreground/50 hover:bg-foreground/[0.06] hover:text-foreground transition-all disabled:opacity-50"
                title="Nueva página"
              >
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar"
              className="w-full h-7 rounded-md border border-foreground/[0.08] bg-card pl-7 pr-2 text-[12px] text-foreground placeholder:text-foreground/30 focus:border-foreground/20 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-1.5">
          {loading || seeding ? (
            <div className="flex items-center justify-center py-10 gap-2 text-[11px] text-foreground/40">
              <Loader2 className="h-4 w-4 animate-spin" />
              {seeding ? "Creando documentos…" : ""}
            </div>
          ) : tree.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[12px] text-foreground/40 mb-2">
                {search ? "Sin resultados" : "No tenés documentos todavía"}
              </p>
              {!search && canCreate && (
                <button
                  onClick={() => createPage(null)}
                  className="inline-flex items-center gap-1 rounded-md border border-foreground/[0.08] bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground/60 hover:border-foreground/20 hover:text-foreground transition-all"
                >
                  <Plus className="h-3 w-3" /> Crear primero
                </button>
              )}
            </div>
          ) : (
            tree.map(node => (
              <TreeRow
                key={node.page.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                expanded={expanded}
                canManage={canManage}
                canCreate={canCreate}
                dragState={dragState}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onDragEnd={onDragEnd}
                onToggle={onToggle}
                onSelect={onSelect}
                onAddChild={createPage}
                onDelete={deletePage}
              />
            ))
          )}
        </div>
      </aside>

      {/* Editor area */}
      <main className="flex-1 min-w-0 flex flex-col">
        {selectedPage ? (
          <>
            {breadcrumb.length > 1 && (
              <div className="flex items-center gap-1 px-8 py-2 text-[11.5px] text-foreground/40 border-b border-foreground/[0.04]">
                {breadcrumb.map((p, i) => (
                  <span key={p.id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3 w-3 text-foreground/25" />}
                    <button
                      onClick={() => setSelectedId(p.id)}
                      className="hover:text-foreground transition-colors truncate max-w-[180px]"
                    >
                      {p.icon && <span className="mr-0.5">{p.icon}</span>}
                      {p.title || "Sin título"}
                    </button>
                  </span>
                ))}
              </div>
            )}

            <PageEditor
              page={selectedPage}
              canEdit={canEdit}
              onPatch={patchPage}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <FileText className="h-10 w-10 text-foreground/15" />
            <p className="text-[14px] text-foreground/50">
              {pages.length === 0
                ? canCreate ? "Empezá creando tu primer documento." : "No hay documentos todavía."
                : "Seleccioná un documento del sidebar."}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
