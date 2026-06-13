import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Youtube } from "lucide-react"

export const dynamic = "force-dynamic"

export default function MiYoutubePage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: "color-mix(in srgb, #FF0000 12%, transparent)" }}>
          <Youtube className="h-7 w-7" style={{ color: "#FF0000" }} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Mi YouTube</h1>
        <p className="text-sm text-foreground/50 mt-2 max-w-md mx-auto">
          Muy pronto vas a poder conectar tu canal de YouTube para ver tus métricas y videos acá, y que se sincronicen con tu reporte.
        </p>
      </div>
    </DashboardLayout>
  )
}
