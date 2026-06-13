import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Instagram } from "lucide-react"

export const dynamic = "force-dynamic"

export default function MiInstagramPage() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: "color-mix(in srgb, #E1306C 14%, transparent)" }}>
          <Instagram className="h-7 w-7" style={{ color: "#E1306C" }} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Mi Instagram</h1>
        <p className="text-sm text-foreground/50 mt-2 max-w-md mx-auto">
          Muy pronto vas a poder conectar tu cuenta de Instagram para ver tus métricas y posts acá, y que se sincronicen con tu reporte.
        </p>
      </div>
    </DashboardLayout>
  )
}
