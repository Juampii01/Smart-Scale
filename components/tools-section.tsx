

"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ExternalLink } from "lucide-react"

export type ToolItem = {
  name: string
  description?: string
  href: string
  badge?: string
  icon?: React.ElementType
  category?: string
}

type ToolsSectionProps = {
  title?: string
  subtitle?: string
  tools: ToolItem[]
  /** Show a final placeholder card for future tools */
  showPlaceholder?: boolean
  className?: string
}

export function ToolsSection({
  title = "Smart Scale Tools",
  subtitle = "Accesos rápidos a herramientas clave",
  tools,
  showPlaceholder = true,
  className,
}: ToolsSectionProps) {
  return (
    <section className={cn("space-y-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-white/50">
          <span>
            {tools.length} herramienta{tools.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <Card
            key={t.href}
            className={cn(
              "relative overflow-hidden border-border bg-gradient-to-br from-neutral-900 via-neutral-950 to-black",
              "transition-all duration-300",
              "hover:shadow-[0_0_40px_rgba(0,255,255,0.15)] hover:border-cyan-400/30"
            )}
          >
            {/* Glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,255,0.12),transparent_55%)]" />

            <CardHeader className="relative pb-4">
              <CardTitle className="flex items-center gap-4">
                {/* ChatGPT style icon */}
                <div className="relative h-12 w-12 rounded-xl bg-black/60 ring-1 ring-white/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-cyan-400" />
                </div>

                <div className="flex-1">
                  <div className="text-lg font-semibold text-foreground tracking-tight">
                    {t.name}
                  </div>
                  <div className="mt-0.5 text-xs uppercase tracking-wider text-cyan-400/80">
                    AI TOOL
                  </div>
                </div>

                <ExternalLink className="h-4 w-4 text-white/30" />
              </CardTitle>
            </CardHeader>

            <CardContent className="relative space-y-5">
              {/* Description */}
              <p className="text-sm leading-relaxed text-white/70 max-w-prose">
                {t.description ?? "Herramienta de inteligencia artificial"}
              </p>

              {/* Creator */}
              <div className="flex items-center gap-3">
                <Image
                  src="/avatar-juampi.png"
                  alt="Juampi"
                  width={36}
                  height={36}
                  className="rounded-full ring-1 ring-white/20"
                />
                <div className="text-xs">
                  <div className="text-white/80">Creado por Juampi</div>
                  <div className="text-white/40">Custom GPT</div>
                </div>
              </div>

              {/* CTA */}
              <Button
                asChild
                size="sm"
                className="w-full bg-cyan-400 text-black hover:bg-cyan-300"
              >
                <Link href={t.href} target="_blank" rel="noreferrer">
                  Abrir en ChatGPT
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}

        {showPlaceholder ? (
          <Card className="border-border bg-card/40 transition-all duration-200 hover:border-muted-foreground/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium text-white/80">Próximas herramientas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white/50">
                Agregá links acá (CRM, automations, dashboards, prompts, SOPs, etc.).
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  )
}