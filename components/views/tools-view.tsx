import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ExternalLink, FileText, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToolItem = {
  name: string
  description: string
  href: string
}

export function ToolsSection({
  title,
  subtitle,
  tools = [],
  showPlaceholder,
  className,
  variant = "gpt",
}: {
  title: string
  subtitle?: string
  tools?: ToolItem[]
  showPlaceholder?: boolean
  className?: string
  variant?: "gpt" | "form"
}) {
  return (
    <section className={cn("space-y-5", className)}>
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/70">{title}</h2>
        </div>
        {subtitle && (
          <p className="text-xs text-white/30 ml-[18px]">{subtitle}</p>
        )}
      </div>

      {tools.length === 0 && showPlaceholder ? (
        <p className="text-sm text-white/50">No hay herramientas cargadas.</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <div
            key={t.href}
            className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111113] transition-all duration-200 hover:border-[#ffde21]/25 hover:shadow-[0_0_40px_rgba(255,222,33,0.07)]"
          >
            <div className="h-[2px] w-full bg-gradient-to-r from-[#ffde21]/40 via-[#ffde21]/20 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,222,33,0.05),transparent_55%)]" />

            <div className="relative p-5 space-y-4">
              {/* Header row */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#ffde21]/10 ring-1 ring-[#ffde21]/15">
                  {variant === "gpt" ? (
                    <Sparkles className="h-5 w-5 text-[#ffde21]" />
                  ) : (
                    <FileText className="h-5 w-5 text-[#ffde21]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white tracking-tight leading-tight">{t.name}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-[#ffde21]/60">
                    {variant === "gpt" ? "AI Tool" : "Form"}
                  </p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-white/20 flex-shrink-0 mt-0.5" />
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed text-white/50">
                {t.description}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                {variant === "gpt" ? (
                  <div className="flex items-center gap-2">
                    <Image
                      src="/avatar-Ann.png"
                      alt="Ann"
                      width={24}
                      height={24}
                      className="rounded-full ring-1 ring-white/15"
                    />
                    <span className="text-xs text-white/35">por Ann</span>
                  </div>
                ) : <div />}

                <Button
                  asChild
                  size="sm"
                  className="h-7 rounded-lg bg-[#ffde21] px-3 text-xs font-bold text-black hover:bg-[#ffe46b]"
                >
                  <Link href={t.href} target="_blank" rel="noreferrer">
                    {variant === "gpt" ? "Abrir →" : "Abrir →"}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function ToolsView() {
  return (
    <>
      <ToolsSection
        title="Smart Scale Tools"
        subtitle="Herramientas internas para ejecutar, operar y escalar"
        variant="gpt"
        tools={[
          {
            name: "Ann IA 1.0",
            description:
              "IA estratégica para ganar claridad y foco al implementar el Ecosistema Circular y escalar tu negocio de forma simple y alineada.",
            href:
              "https://chatgpt.com/g/g-695abe5acb4c8191a4092a38da71c883",
          },
          {
            name: "Coach de Autoridad de Contenido",
            description:
              "GPT para auditar el contenido y reforzar autoridad, claridad y posicionamiento.",
            href:
              "https://chatgpt.com/g/g-6954b071cfe88191ad231a5959498ae7-coach-de-autoridad-de-contenido",
          },
          {
            name: "Smart Scale Email Engine",
            description:
              "GPT para convertir videos de YouTube y scripts en emails listos para enviar.",
            href:
              "https://chatgpt.com/g/g-6954a6883b6c8191abb16fee1fe44200-smart-scale-email-engine",
          },
          {
            name: "Simple Offer Builder",
            description:
              "GPT para crear la oferta simple: estructura, promesa, entregables y posicionamiento.",
            href:
              "https://chatgpt.com/g/g-695470be71ec8191b89266dbd1948663-simple-offer-builder",
          },
          {
            name: "DM Close Coach — Setting Flow",
            description:
              "GPT para armar el setting flow de DMs y mejorar el cierre por conversación.",
            href:
              "https://chatgpt.com/g/g-69541576dd98819189c7b14b046cc897-dm-close-coach-by-smart-scale",
          },
          {
            name: "Offer Doc Builder",
            description:
              "GPT para crear y estructurar tu Offer Doc de ventas de forma rápida y profesional.",
            href:
              "https://chatgpt.com/g/g-69aef7270b348191b697c282ca70772b-offer-doc-builder",
          },
          {
            name: "Copywriter de Video a Carrusel",
            description:
              "GPT para convertir videos en carruseles listos para publicar, con copy optimizado para Instagram.",
            href:
              "https://chatgpt.com/g/g-69cde322c25c819182cb9207bce35a92-video-a-carrousel-copywriter-smart-scaletm",
          },
        ]}
      />
      <ToolsSection
        title="Formularios"
        subtitle="Formularios internos para seguimiento y reporting"
        variant="form"
        tools={[
          {
            name: "Monday Wins",
            description:
              "Formulario semanal para completar todos los lunes con wins, avances y foco de la semana.",
            href: "https://airtable.com/appRJNO1KYgg2A5NZ/pagj4KV5jDXvwA0jx/form",
          },
          {
            name: "Monthly Report",
            description:
              "Formulario mensual para completar una vez al mes con el reporte del mes anterior.",
            href: "https://airtable.com/appRJNO1KYgg2A5NZ/pagcUJ9vMsfMNBZBh/form",
          },
        ]}
      />
    </>
  )
}