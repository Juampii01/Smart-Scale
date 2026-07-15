import Link from "next/link"

export const metadata = {
  title: "Instrucciones de Eliminación de Datos — Smart Scale",
}

const LAST_UPDATED = "3 de julio de 2026"

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--background)" }}>
      <div
        className="sticky top-0 z-10 border-b border-foreground/[0.07] backdrop-blur-md"
        style={{ backgroundColor: "color-mix(in srgb, var(--background) 96%, transparent)" }}
      >
        <div className="mx-auto max-w-2xl px-5 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-foreground text-[17px] font-bold tracking-tight">Smart</span>
            <span className="rounded-md bg-foreground px-2 py-0.5 text-[14px] font-bold tracking-tight text-background shadow-sm">
              Scale
            </span>
          </Link>
          <span className="text-[11px] font-bold text-foreground/25 uppercase tracking-[0.18em]">Data Deletion</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 sm:px-5 pb-24 pt-10 space-y-8 text-foreground/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Instrucciones de Eliminación de Datos</h1>
          <p className="mt-1.5 text-[13px] text-foreground/40">Última actualización: {LAST_UPDATED}</p>
        </div>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">1. Desconectar una integración (Instagram, YouTube, Slack)</h2>
          <p className="text-[14px] leading-relaxed">
            Si conectaste tu cuenta de Instagram, YouTube u otra integración a Smart Scale, podés desconectarla en
            cualquier momento desde la sección correspondiente del dashboard. Al desconectar:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed">
            <li>Eliminamos de forma inmediata el token de acceso guardado — dejamos de poder leer esa cuenta.</li>
            <li>Los datos ya sincronizados (métricas, contenido, mensajes según el caso) quedan marcados para
              eliminación y se borran de nuestra base de datos dentro de los 30 días siguientes.</li>
            <li>Podés adicionalmente revocar el acceso desde la configuración de la app conectada
              (ej. Instagram → Configuración → Apps y sitios web → Smart Scale → Quitar).</li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">2. Eliminar tu cuenta completa</h2>
          <p className="text-[14px] leading-relaxed">
            Para eliminar tu cuenta de Smart Scale y todos los datos asociados (perfil, métricas, integraciones
            conectadas), escribinos a{" "}
            <a href="mailto:support@smartscale.space" className="text-[#dafc69] hover:underline">support@smartscale.space</a>{" "}
            desde el email asociado a tu cuenta, con el asunto "Eliminar mi cuenta".
          </p>
          <p className="text-[14px] leading-relaxed">
            Vamos a confirmar tu identidad y procesar la eliminación dentro de los 30 días. Te avisamos por email
            cuando el proceso esté completo.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">3. Qué se elimina</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed">
            <li>Datos de perfil y credenciales de acceso.</li>
            <li>Tokens de integraciones conectadas (Instagram, YouTube, Slack).</li>
            <li>Datos sincronizados de esas integraciones (mensajes, métricas, contenido).</li>
            <li>Historial de conversaciones con asistentes de IA dentro de la plataforma.</li>
          </ul>
          <p className="text-[14px] leading-relaxed">
            Los registros que estemos legalmente obligados a conservar (ej. comprobantes de pago, por motivos
            fiscales) se retienen únicamente por el plazo que exige la ley aplicable.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">4. Contacto</h2>
          <p className="text-[14px] leading-relaxed">
            <a href="mailto:support@smartscale.space" className="text-[#dafc69] hover:underline">support@smartscale.space</a>
          </p>
        </section>
      </div>
    </div>
  )
}
