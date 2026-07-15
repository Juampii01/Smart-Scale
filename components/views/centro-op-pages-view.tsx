"use client"

/**
 * Centro Operativo — vista tipo Notion.
 *
 * Sidebar izquierda: tree de páginas anidables.
 * Main derecha: editor BlockNote con auto-save debounced.
 *
 * Permisos:
 *  - admin: ve todo (global + prospección)
 *  - team:  solo scope = 'global'
 *  - setter: solo scope = 'prospeccion'
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase"
import {
  ChevronRight, ChevronDown, Plus, Trash2, FileText, Loader2,
  Search, Lock, Target,
} from "lucide-react"
import { isAdmin as isAdminRole } from "@/lib/auth/permissions"
import { useCreateBlockNote } from "@blocknote/react"
import { BlockNoteView } from "@blocknote/mantine"
import "@blocknote/core/fonts/inter.css"
import "@blocknote/mantine/style.css"
import "./centro-op-pages-view.css"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Page {
  id:         string
  parent_id:  string | null
  title:      string
  icon:       string | null
  content:    any[]                                            // BlockNote document
  sort_order: number
  scope:      "global" | "prospeccion"
  created_at: string
  updated_at: string
}

interface TreeNode {
  page:     Page
  children: TreeNode[]
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
    byParent[key].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
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
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
  })
}

// ─── Tree node component ──────────────────────────────────────────────────────

function TreeRow({
  node, depth, selectedId, expanded, onToggle, onSelect, onAddChild, onDelete,
}: {
  node:       TreeNode
  depth:      number
  selectedId: string | null
  expanded:   Set<string>
  onToggle:   (id: string) => void
  onSelect:   (id: string) => void
  onAddChild: (parentId: string) => void
  onDelete:   (id: string) => void
}) {
  const hasChildren = node.children.length > 0
  const isExpanded  = expanded.has(node.page.id)
  const isSelected  = selectedId === node.page.id
  const [hovered, setHovered] = useState(false)

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(node.page.id)}
        className={`group flex items-center gap-1 rounded-md px-1 py-1 text-[13px] cursor-pointer transition-colors ${
          isSelected
            ? "bg-foreground/[0.08] text-foreground"
            : "text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground"
        }`}
        style={{ paddingLeft: `${4 + depth * 14}px` }}
      >
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
        <button
          onClick={(e) => { e.stopPropagation(); onAddChild(node.page.id) }}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-foreground/40 hover:bg-foreground/10 hover:text-foreground transition-all ${hovered ? "opacity-100" : "opacity-0"}`}
          aria-label="Nueva subpágina"
          title="Nueva subpágina"
        >
          <Plus className="h-3 w-3" />
        </button>
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
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <TreeRow
              key={child.page.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
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

// ─── Editor pane (BlockNote + auto-save) ──────────────────────────────────────

function PageEditor({
  page, isAdmin, isRoot, parentScope, onPatch,
}: {
  page:        Page
  isAdmin:     boolean
  isRoot:      boolean        // true si parent_id es null
  parentScope: Page["scope"] | null
  onPatch:     (id: string, patch: Partial<Page>) => Promise<void>
}) {
  const [title, setTitle] = useState(page.title)
  const [icon,  setIcon]  = useState(page.icon ?? "")
  const [savingState, setSavingState] = useState<"idle" | "saving" | "saved">("idle")
  const titleSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const contentSaveTimer = useRef<NodeJS.Timeout | null>(null)

  // Cuando cambia la page seleccionada, actualizamos los inputs
  useEffect(() => {
    setTitle(page.title)
    setIcon(page.icon ?? "")
  }, [page.id])  // eslint-disable-line react-hooks/exhaustive-deps

  // BlockNote editor — se recrea cuando cambia page.id
  const editor = useCreateBlockNote({
    initialContent: Array.isArray(page.content) && page.content.length > 0
      ? page.content
      : undefined,
  }, [page.id])

  // Auto-save de título + icono (debounce 600ms)
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
    if (title === page.title && (icon || null) === page.icon) return
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
    titleSaveTimer.current = setTimeout(saveMeta, 600)
    return () => {
      if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
    }
  }, [title, icon])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save de contenido (debounce 800ms)
  useEffect(() => {
    if (!editor) return
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
  }, [editor, page.id, onPatch])

  // Toggle de scope (solo admin, solo en root pages)
  const toggleScope = async () => {
    const next: Page["scope"] = page.scope === "global" ? "prospeccion" : "global"
    if (!confirm(
      next === "prospeccion"
        ? "¿Hacer esta página visible para el setter? Sus subpáginas también van a quedar accesibles para el setter."
        : "¿Sacarle el acceso al setter? Solo admin/team la van a ver. Las subpáginas también."
    )) return
    setSavingState("saving")
    try {
      await onPatch(page.id, { scope: next, _cascade: true } as any)
      setSavingState("saved")
      setTimeout(() => setSavingState("idle"), 1500)
    } catch (e: any) {
      alert(e?.message ?? "Error cambiando visibilidad")
      setSavingState("idle")
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header: icon + title + visibility + save indicator */}
      <div className="flex items-center justify-between gap-3 border-b border-foreground/[0.06] px-8 py-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <input
            type="text"
            value={icon}
            onChange={e => setIcon(e.target.value)}
            placeholder="📄"
            maxLength={4}
            className="h-9 w-9 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] text-center text-base focus:border-foreground/20 focus:outline-none"
            aria-label="Icono"
          />
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Sin título"
            className="flex-1 bg-transparent text-2xl font-bold text-foreground placeholder:text-foreground/25 focus:outline-none"
            aria-label="Título"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">

          {/* Visibility pill */}
          {isAdmin && isRoot ? (
            <button
              onClick={toggleScope}
              className={`inline-flex items-center gap-1.5 h-8 rounded-lg border px-3 text-[11.5px] font-semibold transition-all ${
                page.scope === "prospeccion"
                  ? "border-cyan-400 bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:border-cyan-400/40 dark:bg-cyan-500/15 dark:text-cyan-300 dark:hover:bg-cyan-500/25"
                  : "border-foreground/[0.12] bg-foreground/[0.04] text-foreground/70 hover:bg-foreground/[0.08]"
              }`}
              title="Click para cambiar quién ve esta página y todas sus subpáginas"
            >
              {page.scope === "prospeccion"
                ? <><Target className="h-3 w-3" /> Setter también</>
                : <><Lock className="h-3 w-3" /> Solo admin/team</>}
            </button>
          ) : !isRoot && parentScope ? (
            <span className="inline-flex items-center gap-1.5 h-8 rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] px-3 text-[11.5px] font-medium text-foreground/45" title="La visibilidad se hereda de la página raíz">
              {parentScope === "prospeccion"
                ? <><Target className="h-3 w-3" /> Heredado · Setter también</>
                : <><Lock className="h-3 w-3" /> Heredado · Solo admin/team</>}
            </span>
          ) : null}

          {/* Save indicator */}
          <div className="flex items-center gap-1.5 text-[11px] text-foreground/40 min-w-[78px] justify-end">
            {savingState === "saving" && <><Loader2 className="h-3 w-3 animate-spin" />Guardando…</>}
            {savingState === "saved"  && <span className="text-emerald-700 dark:text-emerald-400">✓ Guardado</span>}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto bg-card">
        <div className="mx-auto max-w-3xl px-8 py-6 centro-op-bn">
          <BlockNoteView
            editor={editor}
            theme="light"
            className="centro-op-blocknote"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function CentroOpPagesView({ userRole }: { userRole: string | null }) {
  const [pages,    setPages]    = useState<Page[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [search,   setSearch]   = useState("")
  const [creating, setCreating] = useState(false)

  // Cargar pages
  const loadPages = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authedFetch("/api/admin/centro-op-pages")
      const json = await res.json()
      const list: Page[] = res.ok ? (json.pages ?? []) : []
      setPages(list)
      // Auto-expandir la rama del seleccionado
      if (selectedId) {
        const ancestors = flattenAncestors(list, selectedId)
        setExpanded(prev => {
          const next = new Set(prev)
          for (const a of ancestors) next.add(a.id)
          return next
        })
      } else if (list.length > 0 && !selectedId) {
        // Seleccionar la primera page por default
        setSelectedId(list[0].id)
      }
    } finally { setLoading(false) }
  }, [selectedId])

  useEffect(() => { loadPages() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Tree filtrado por search
  const filteredPages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pages
    // Mostrar pages que matcheen + sus ancestros
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

  // ── Actions ─────────────────────────────────────────────────────────────────

  const onToggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const onSelect = (id: string) => setSelectedId(id)

  const createPage = async (parentId: string | null) => {
    setCreating(true)
    try {
      const res  = await authedFetch("/api/admin/centro-op-pages", {
        method: "POST",
        body: JSON.stringify({ parent_id: parentId, title: "Sin título", content: [] }),
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

  const patchPage = async (id: string, patch: Partial<Page> & { _cascade?: boolean }) => {
    const res = await authedFetch("/api/admin/centro-op-pages", {
      method: "PATCH",
      body: JSON.stringify({ id, ...patch }),
    })
    const json = await res.json()
    if (!res.ok || !json.page) throw new Error(json?.error ?? "Error guardando")

    if (patch._cascade) {
      // Cascade afecta descendientes — refetch para sincronizar estado local
      await loadPages()
    } else {
      setPages(prev => prev.map(p => p.id === id ? json.page : p))
    }
  }

  const deletePage = async (id: string) => {
    const res = await authedFetch("/api/admin/centro-op-pages", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json?.error ?? "Error borrando")
      return
    }
    // Borrar el page Y todos sus descendientes localmente
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

  // Breadcrumb
  const breadcrumb = selectedPage ? flattenAncestors(pages, selectedPage.id) : []

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[520px] gap-3 rounded-[14px] border border-foreground/[0.07] bg-card overflow-hidden">

      {/* Sidebar */}
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-foreground/[0.06] bg-foreground/[0.015]">
        <div className="border-b border-foreground/[0.06] px-3 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/40">Páginas</h3>
            <button
              onClick={() => createPage(null)}
              disabled={creating}
              className="flex h-6 w-6 items-center justify-center rounded text-foreground/50 hover:bg-foreground/[0.06] hover:text-foreground transition-all disabled:opacity-50"
              title="Nueva página"
            >
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
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
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-foreground/30" />
            </div>
          ) : tree.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[12px] text-foreground/40 mb-2">
                {search ? "Sin resultados" : "No hay páginas todavía"}
              </p>
              {!search && (
                <button
                  onClick={() => createPage(null)}
                  className="inline-flex items-center gap-1 rounded-md border border-foreground/[0.08] bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground/60 hover:border-foreground/20 hover:text-foreground transition-all"
                >
                  <Plus className="h-3 w-3" /> Crear primera
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
                onToggle={onToggle}
                onSelect={onSelect}
                onAddChild={createPage}
                onDelete={deletePage}
              />
            ))
          )}
        </div>
      </aside>

      {/* Main editor area */}
      <main className="flex-1 min-w-0 flex flex-col">
        {selectedPage ? (
          <>
            {/* Breadcrumb */}
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
              isAdmin={isAdminRole(userRole)}
              isRoot={selectedPage.parent_id === null}
              parentScope={
                selectedPage.parent_id
                  ? (pages.find(p => p.id === selectedPage.parent_id)?.scope ?? null)
                  : null
              }
              onPatch={patchPage}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <FileText className="h-10 w-10 text-foreground/15" />
            <p className="text-[14px] text-foreground/50">
              {pages.length === 0
                ? "Empezá creando tu primera página."
                : "Seleccioná una página del sidebar."}
            </p>
            {pages.length === 0 && (
              <button
                onClick={() => createPage(null)}
                disabled={creating}
                className="inline-flex items-center gap-2 h-9 rounded-xl bg-[#dafc69] px-4 text-[13px] font-bold text-black hover:bg-[#f2ffc0] transition-all disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Nueva página
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
