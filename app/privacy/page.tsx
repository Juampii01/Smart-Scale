import Link from "next/link"

export const metadata = {
  title: "Política de Privacidad — Smart Scale",
}

const LAST_UPDATED = "3 de julio de 2026"

export default function PrivacyPage() {
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
          <span className="text-[11px] font-bold text-foreground/25 uppercase tracking-[0.18em]">Privacy Policy</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 sm:px-5 pb-24 pt-10 space-y-8 text-foreground/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Política de Privacidad</h1>
          <p className="mt-1.5 text-[13px] text-foreground/40">Última actualización: {LAST_UPDATED}</p>
        </div>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">1. Quiénes somos</h2>
          <p className="text-[14px] leading-relaxed">
            Smart Scale ("Smart Scale", "nosotros") es una plataforma de analytics y CRM para coaches y creadores de
            infoproductos. Al día de esta política, Smart Scale opera sin una entidad legal constituida separada — el
            responsable del tratamiento de los datos descriptos acá es su equipo operador, contactable en{" "}
            <a href="mailto:support@smartscale.space" className="text-[#ffde21] hover:underline">support@smartscale.space</a>.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">2. Qué datos recolectamos</h2>
          <p className="text-[14px] leading-relaxed">Según el tipo de cuenta, recolectamos:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed">
            <li>Datos de cuenta: nombre, email, rol dentro de la plataforma.</li>
            <li>Datos de negocio que el usuario carga voluntariamente: métricas, pagos, contenido, notas operativas.</li>
            <li>
              Datos de integraciones que el usuario conecta explícitamente (Instagram, YouTube, Slack), únicamente
              sobre la cuenta que el propio usuario autoriza — nunca accedemos a cuentas de terceros sin su
              consentimiento directo vía OAuth.
            </li>
            <li>Datos técnicos básicos (logs de errores del servidor) para mantener el servicio funcionando.</li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">3. Datos de la plataforma de Instagram (Meta)</h2>
          <p className="text-[14px] leading-relaxed">
            Cuando un usuario conecta su cuenta de Instagram, según los permisos otorgados podemos acceder a:
            información básica de la cuenta, métricas de contenido, y — solo si el usuario autoriza explícitamente el
            permiso correspondiente — los mensajes directos (DMs) de esa misma cuenta.
          </p>
          <p className="text-[14px] leading-relaxed">
            Este acceso a mensajes directos se usa exclusivamente para asistir al propio dueño de la cuenta conectada
            a entender patrones en sus conversaciones (por ejemplo, qué leads responden mejor) mediante análisis
            asistido por inteligencia artificial. No enviamos mensajes automáticos, no usamos estos datos para
            publicidad, no los compartimos con terceros no mencionados en esta política, y no entrenamos modelos de
            IA de terceros con ellos.
          </p>
          <p className="text-[14px] leading-relaxed">
            El usuario puede revocar este acceso en cualquier momento desde la plataforma o desde la configuración de
            su cuenta de Instagram. Ver la sección "Eliminación de datos" más abajo.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">4. Cómo usamos los datos</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed">
            <li>Para operar el servicio: mostrar métricas, gestionar pagos, coordinar al equipo del usuario.</li>
            <li>Para análisis asistido por IA, cuando el usuario activa esa funcionalidad explícitamente.</li>
            <li>Para soporte técnico y resolución de errores.</li>
            <li>Nunca vendemos datos de usuarios a terceros.</li>
          </ul>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">5. Con quién compartimos datos</h2>
          <p className="text-[14px] leading-relaxed">
            Usamos proveedores externos estrictamente para operar el servicio, bajo sus propios acuerdos de
            confidencialidad:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-[14px] leading-relaxed">
            <li><strong className="text-foreground/90">Supabase</strong> — almacenamiento de base de datos y autenticación.</li>
            <li><strong className="text-foreground/90">Anthropic (Claude)</strong> — procesamiento de análisis con IA, cuando esa funcionalidad está activa.</li>
            <li><strong className="text-foreground/90">Vercel</strong> — hosting de la aplicación.</li>
          </ul>
          <p className="text-[14px] leading-relaxed">
            Ninguno de estos proveedores usa los datos para sus propios fines comerciales ajenos a prestarnos el
            servicio contratado.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">6. Seguridad</h2>
          <p className="text-[14px] leading-relaxed">
            Los tokens de acceso a integraciones externas (Instagram, YouTube, Slack) se almacenan cifrados en
            reposo. El acceso a los datos está restringido por reglas de seguridad a nivel de fila (RLS) según el rol
            y la cuenta del usuario.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">7. Retención de datos</h2>
          <p className="text-[14px] leading-relaxed">
            Conservamos los datos mientras la cuenta esté activa. Si un usuario desconecta una integración, los datos
            sincronizados de esa integración dejan de actualizarse y pueden eliminarse a pedido (ver sección
            siguiente).
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">8. Eliminación de datos</h2>
          <p className="text-[14px] leading-relaxed">
            Los detalles del proceso de eliminación están en nuestra{" "}
            <Link href="/data-deletion" className="text-[#ffde21] hover:underline">página de instrucciones de eliminación de datos</Link>.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">9. Tus derechos</h2>
          <p className="text-[14px] leading-relaxed">
            Podés solicitar acceso, corrección o eliminación de tus datos en cualquier momento escribiendo a{" "}
            <a href="mailto:support@smartscale.space" className="text-[#ffde21] hover:underline">support@smartscale.space</a>.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">10. Cambios a esta política</h2>
          <p className="text-[14px] leading-relaxed">
            Podemos actualizar esta política. Los cambios materiales se van a notificar por email o dentro de la
            plataforma antes de entrar en vigencia.
          </p>
        </section>

        <section className="space-y-2.5">
          <h2 className="text-[15px] font-bold text-foreground">11. Contacto</h2>
          <p className="text-[14px] leading-relaxed">
            <a href="mailto:support@smartscale.space" className="text-[#ffde21] hover:underline">support@smartscale.space</a>
          </p>
        </section>
      </div>
    </div>
  )
}
