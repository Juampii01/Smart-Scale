import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    <section className={cn("space-y-6", className)}>
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {tools.length === 0 && showPlaceholder ? (
        <p className="text-sm text-white/50">No hay herramientas cargadas.</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <Card
            key={t.href}
            className="relative overflow-hidden border-border bg-gradient-to-br from-neutral-900 via-neutral-950 to-black transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,255,255,0.15)] hover:border-cyan-400/30"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,255,0.12),transparent_55%)]" />

            <CardHeader className="relative pb-4">
              <CardTitle className="flex items-center gap-4">
                <div className="relative h-12 w-12 rounded-xl bg-black/60 ring-1 ring-white/10 flex items-center justify-center">
                  {variant === "gpt" ? (
                    <Sparkles className="h-6 w-6 text-cyan-400" />
                  ) : (
                    <FileText className="h-6 w-6 text-cyan-400" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="text-lg font-semibold text-foreground tracking-tight">
                    {t.name}
                  </div>
                  <div className="mt-0.5 text-xs uppercase tracking-wider text-cyan-400/80">
                    {variant === "gpt" ? "AI TOOL" : "FORM"}
                  </div>
                </div>

                <ExternalLink className="h-4 w-4 text-white/30" />
              </CardTitle>
            </CardHeader>

            <CardContent className="relative space-y-5">
              <p className="text-sm leading-relaxed text-white/70 max-w-prose">
                {t.description}
              </p>

              {variant === "gpt" ? (
                <div className="flex items-center gap-3">
                  <Image
                    src="/avatar-Ann.png"
                    alt="Ann"
                    width={36}
                    height={36}
                    className="rounded-full ring-1 ring-white/20"
                  />
                  <div className="text-xs">
                    <div className="text-white/80">Creado por Ann</div>
                    <div className="text-white/40">Custom GPT</div>
                  </div>
                </div>
              ) : null}

              <Button
                asChild
                size="sm"
                className="w-full bg-cyan-400 text-black hover:bg-cyan-300"
              >
                <Link href={t.href} target="_blank" rel="noreferrer">
                  {variant === "gpt" ? "Abrir en ChatGPT" : "Abrir formulario"}
                </Link>
              </Button>
            </CardContent>
          </Card>
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