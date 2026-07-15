"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { Plus, X, Instagram, Youtube, Lightbulb, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Channel = "instagram" | "youtube"
type IgFormat = "Reel" | "Carousel" | "Image"
type YtFormat = "Short" | "Video largo"

interface Idea {
  id: string
  title: string
  format: string
  hook: string
  notes: string
  created_at: string
}

const IG_FORMATS: IgFormat[] = ["Reel", "Carousel", "Image"]
const YT_FORMATS: YtFormat[] = ["Short", "Video largo"]

const supabase = createClient()

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

export function ContentIdeasView({ channel }: { channel: Channel }) {
  const clientId = useActiveClient()
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [format, setFormat] = useState<IgFormat | YtFormat>(
    channel === "instagram" ? "Reel" : "Short"
  )
  const [hook, setHook] = useState("")
  const [notes, setNotes] = useState("")

  const isIG = channel === "instagram"
  const formats = isIG ? IG_FORMATS : YT_FORMATS
  const Icon = isIG ? Instagram : Youtube
  const iconColor = isIG ? "#818cf8" : "#f87171"
  const channelLabel = isIG ? "Instagram" : "YouTube"

  // Cargar ideas del cliente para este canal
  useEffect(() => {
    let alive = true
    if (!clientId) { setLoading(false); setIdeas([]); return () => { alive = false } }
    setLoading(true)
    supabase
      .from("content_ideas")
      .select("id, title, format, hook, notes, created_at")
      .eq("client_id", clientId)
      .eq("channel", channel)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (alive) { setIdeas((data as Idea[]) ?? []); setLoading(false) } })
    return () => { alive = false }
  }, [clientId, channel])

  async function handleAdd() {
    if (!title.trim() || !clientId || saving) return
    setSaving(true)
    const { data, error } = await supabase
      .from("content_ideas")
      .insert({ client_id: clientId, channel, title: title.trim(), format, hook: hook.trim(), notes: notes.trim() })
      .select("id, title, format, hook, notes, created_at")
      .single()
    setSaving(false)
    if (error || !data) return
    setIdeas(prev => [data as Idea, ...prev])
    setTitle(""); setHook(""); setNotes("")
    setFormat(isIG ? "Reel" : "Short")
    setOpen(false)
  }

  async function handleRemove(id: string) {
    setIdeas(prev => prev.filter(i => i.id !== id))
    await supabase.from("content_ideas").delete().eq("id", id)
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-foreground leading-tight">{channelLabel} — Ideas</h1>
          <p className="text-[13px] text-foreground/50 mt-0.5">{ideas.length} idea{ideas.length !== 1 ? "s" : ""} guardada{ideas.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-[8px] bg-[#dafc69] px-4 py-2 text-[13px] font-semibold text-black hover:bg-[#f2ffc0] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Idea
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24 text-foreground/40">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && ideas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-[14px]"
            style={{ backgroundColor: `${iconColor}15`, boxShadow: `0 0 0 1px ${iconColor}25` }}
          >
            <Lightbulb className="h-7 w-7" style={{ color: iconColor }} />
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-foreground/70">0 total ideas</p>
            <p className="text-[13px] text-foreground/40 mt-1">
              Anotá ideas de contenido y no pierdas ninguna. Podés agregar las tuyas.
            </p>
          </div>
        </div>
      )}

      {/* Ideas list */}
      {ideas.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map(idea => (
            <div
              key={idea.id}
              className="group relative rounded-[14px] border border-foreground/[0.07] bg-card p-4 hover:border-foreground/[0.12] transition-colors"
            >
              <button
                onClick={() => handleRemove(idea.id)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md text-foreground/30 hover:text-foreground hover:bg-foreground/[0.06]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{ backgroundColor: `${iconColor}18`, color: iconColor }}
                >
                  {idea.format}
                </span>
                <span className="text-[11px] text-foreground/30">{fmtDate(idea.created_at)}</span>
              </div>
              <p className="text-[14px] font-semibold text-foreground leading-snug mb-2">{idea.title}</p>
              {idea.hook && (
                <p className="text-[12px] text-foreground/50 line-clamp-2">{idea.hook}</p>
              )}
              {idea.notes && (
                <p className="text-[11px] text-foreground/35 mt-1.5 line-clamp-1">{idea.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-[460px] rounded-[14px] border border-foreground/[0.10] bg-card shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-foreground/[0.07]">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${iconColor}18` }}
                >
                  <Icon className="h-4 w-4" style={{ color: iconColor }} />
                </div>
                <h2 className="text-[15px] font-bold text-foreground">Add Content Idea</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 flex items-center justify-center rounded-md text-foreground/40 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-5">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/60">
                  Title <span className="text-danger">*</span>
                </label>
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Your content idea"
                  className="w-full rounded-[8px] border border-foreground/[0.10] bg-foreground/[0.04] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/[0.25] transition-colors"
                />
              </div>

              {/* Format chips */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/60">Format</label>
                <div className="flex gap-2 flex-wrap">
                  {formats.map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[12px] font-semibold border transition-all",
                        format === f
                          ? "border-transparent text-black"
                          : "border-foreground/[0.10] text-foreground/60 hover:border-foreground/[0.20] hover:text-foreground bg-transparent"
                      )}
                      style={format === f ? { backgroundColor: iconColor } : {}}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hook Idea */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/60">Hook Idea</label>
                <textarea
                  value={hook}
                  onChange={e => setHook(e.target.value)}
                  placeholder="Describe the opening hook"
                  rows={3}
                  className="w-full rounded-[8px] border border-foreground/[0.10] bg-foreground/[0.04] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/[0.25] transition-colors resize-none"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-foreground/60">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional notes"
                  rows={2}
                  className="w-full rounded-[8px] border border-foreground/[0.10] bg-foreground/[0.04] px-3 py-2 text-[13px] text-foreground placeholder:text-foreground/25 outline-none focus:border-foreground/[0.25] transition-colors resize-none"
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 pb-5">
              <button
                onClick={() => setOpen(false)}
                className="rounded-[8px] border border-foreground/[0.10] px-4 py-2 text-[13px] font-semibold text-foreground/70 hover:text-foreground hover:border-foreground/[0.20] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!title.trim() || saving}
                className="flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[13px] font-semibold text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: iconColor }}
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add Idea
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
