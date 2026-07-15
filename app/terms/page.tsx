import Link from "next/link"

export const metadata = {
  title: "Términos de Servicio — Smart Scale",
}

const LAST_UPDATED = "3 de julio de 2026"

export default function TermsPage() {
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
          <span className="text-[11px] font-bold text-foreground/25 uppercase tracking-[0.18em]">Terms of Service</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 sm:px-5 pb-24 pt-10 space-y-8 text-foreground/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Términos de Servicio</h1>
          <p className="mt-1.5 text-[13px] text-foreground/40">Última actualización: {LAST_UPDATED}</p>
        </div>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">1. Aceptación de los términos</h2>
          <p className="text-[14px] leading-relaxed">
            Al crear una cuenta o usar Smart Scale ("el Servicio"), aceptás estos Términos de Servicio. Si no
            estás de acuerdo, no uses el Servicio.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">2. Descripción del servicio</h2>
          <p className="text-[14px] leading-relaxed">
            Smart Scale es una plataforma de analytics y CRM para coaches e infoproductores: portal de métricas para
            clientes, y herramientas de gestión interna (leads, pagos, aplicaciones) para el equipo operador.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">3. Cuentas</h2>
          <p className="text-[14px] leading-relaxed">
            Sos responsable de mantener la confidencialidad de tus credenciales de acceso y de toda actividad que
            ocurra bajo tu cuenta. Notificanos de inmediato ante cualquier uso no autorizado.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">4. Uso aceptable</h2>
          <p className="text-[14px] leading-relaxed">No podés usar el Servicio para:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed">
            <li>Acceder a cuentas o datos de terceros sin autorización.</li>
            <li>Enviar spam, contenido malicioso, o violar leyes aplicables.</li>
            <li>Intentar vulnerar la seguridad de la plataforma o de sus integraciones.</li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">5. Integraciones de terceros</h2>
          <p className="text-[14px] leading-relaxed">
            El Servicio permite conectar cuentas de Instagram, YouTube y Slack, entre otras. El uso de esas
            integraciones también está sujeto a los términos de servicio de cada plataforma respectiva. Sos
            responsable de tener los derechos necesarios sobre cualquier cuenta que conectes.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">6. Propiedad intelectual</h2>
          <p className="text-[14px] leading-relaxed">
            El software, diseño y marca de Smart Scale nos pertenecen. Los datos de negocio que cargás vos siguen
            siendo tuyos — nosotros solo los procesamos para prestarte el servicio.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">7. Limitación de responsabilidad</h2>
          <p className="text-[14px] leading-relaxed">
            El Servicio se ofrece "tal cual". En la medida permitida por ley, no somos responsables por daños
            indirectos derivados del uso del Servicio o de la interrupción de integraciones de terceros que están
            fuera de nuestro control.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">8. Terminación</h2>
          <p className="text-[14px] leading-relaxed">
            Podés dejar de usar el Servicio en cualquier momento. Nos reservamos el derecho de suspender cuentas que
            violen estos términos.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">9. Cambios a estos términos</h2>
          <p className="text-[14px] leading-relaxed">
            Podemos actualizar estos términos. Los cambios materiales se notifican antes de entrar en vigencia.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">10. Contacto</h2>
          <p className="text-[14px] leading-relaxed">
            <a href="mailto:support@smartscale.space" className="text-[#dafc69] hover:underline">support@smartscale.space</a>
          </p>
        </section>
      </div>
    </div>
  )
}
