"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X, Copy, Check, FileText, User, Hash } from "lucide-react"

interface TranscriptModalProps {
  transcript: string
  title?: string | null
  creator?: string | null
  platform?: "youtube" | "instagram" | null
  onClose: () => void
}

export function TranscriptModal({ transcript, title, creator, platform, onClose }: TranscriptModalProps) {
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  const wordCount = transcript.split(/\s+/).filter(Boolean).length
  const charCount = transcript.length

  function handleCopy() {
    navigator.clipboard.writeText(transcript)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!mounted) return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-white/[0.10] bg-[#111113] shadow-2xl shadow-black/60">

        {/* Header */}
        <div className="flex-shrink-0 border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#ffde21]/10 border border-[#ffde21]/20 mt-0.5">
                <FileText className="h-3.5 w-3.5 text-[#ffde21]" />
              </div>
              <div className="min-w-0">
                {title && (
                  <p className="text-sm font-semibold text-white leading-snug line-clamp-2">{title}</p>
                )}
                {!title && (
                  <p className="text-sm font-semibold text-white">Transcripción</p>
                )}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {creator && (
                    <span className="flex items-center gap-1 text-[11px] text-white/40">
                      <User className="h-2.5 w-2.5" />
                      {creator}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-white/30">
                    <Hash className="h-2.5 w-2.5" />
                    {wordCount.toLocaleString()} palabras · {charCount.toLocaleString()} caracteres
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/50 hover:text-white hover:border-white/20 hover:bg-white/[0.07] transition-all"
              >
                {copied
                  ? <><Check className="h-3 w-3 text-[#ffde21]" /> Copiado</>
                  : <><Copy className="h-3 w-3" /> Copiar</>
                }
              </button>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-white/30 hover:text-white hover:border-white/20 hover:bg-white/[0.07] transition-all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Body — scrollable transcript */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-[15px] text-white/75 leading-[1.9] whitespace-pre-wrap font-light tracking-[0.01em]">
            {transcript}
          </p>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-white/[0.06] px-6 py-3 flex items-center justify-between">
          <span className="text-[10px] text-white/20 uppercase tracking-widest">
            {platform === "instagram" ? "Instagram" : platform === "youtube" ? "YouTube" : "Transcript"}
          </span>
          <button
            onClick={onClose}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Cerrar (Esc)
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
