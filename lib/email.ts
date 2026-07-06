// ─── Email via Resend ─────────────────────────────────────────────────────────
// Sends transactional emails using Resend's REST API (no npm package needed).
// Requires: RESEND_API_KEY + RESEND_FROM_EMAIL in env vars.
//
// RESEND_FROM_EMAIL must be a dominio verificado en Resend (resend.com/domains),
// e.g. "Smart Scale <hola@smartscale.space>" — el dominio en sí no alcanza,
// Resend rechaza el envío hasta que verifiques los registros DNS (SPF/DKIM).
// If not configured, all functions return { ok: false, error: "not_configured" }
// so callers can treat email as optional without crashing.

export interface EmailResult {
  ok: boolean
  id?: string
  error?: string
}

async function sendEmail(payload: {
  to:      string
  subject: string
  html:    string
  text?:   string
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from   = process.env.RESEND_FROM_EMAIL ?? "Smart Scale <hola@smartscale.space>"

  if (!apiKey) return { ok: false, error: "RESEND_API_KEY not configured" }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        from,
        to:      payload.to,
        subject: payload.subject,
        html:    payload.html,
        text:    payload.text,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data?.message ?? `HTTP ${res.status}` }
    return { ok: true, id: data?.id }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Unknown email error" }
  }
}

// ─── Template: bienvenida al cliente ─────────────────────────────────────────

export async function sendWelcomeEmail(payload: {
  name:         string
  email:        string
  magic_link:   string   // one-time login link from supabase.auth.admin.generateLink
  program?:     string | null
  setter_name?: string | null
}): Promise<EmailResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.smartscale.co"
  const firstName = payload.name.split(" ")[0]

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenido a Smart Scale</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">

              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                ¡Bienvenido!
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Hola ${firstName}, tu acceso está listo 🎉
              </h1>

              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Tu cuenta de <strong>Smart Scale</strong> fue creada${payload.program ? ` para el programa <strong>${payload.program}</strong>` : ""}.
                Desde el dashboard vas a poder ver todas tus métricas, recursos y el progreso de tu negocio en tiempo real.
                Al tocar el botón de abajo vas a crear tu contraseña y entrar directo.
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${payload.magic_link}"
                       style="display:inline-block;background:#1a1a1a;color:#ffde21;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">
                      Crear mi contraseña →
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background:#f5f5f4;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                  ⚠️ Importante
                </p>
                <p style="margin:0;font-size:13px;color:#525252;line-height:1.5;">
                  Este link es de un solo uso y expira en 24 horas. Si expiró o ya lo usaste, entrá a
                  <strong>smartscale.space/login</strong> con tu email <strong>${payload.email}</strong> y tocá
                  "¿La olvidaste?" para crear tu contraseña de nuevo.
                </p>
              </div>

              <hr style="border:none;border-top:1px solid #e5e5e5;margin:0 0 24px;" />

              <p style="margin:0;font-size:13px;color:#a3a3a3;line-height:1.5;">
                Si tenés alguna duda, respondé este email o escribile a tu coach.
                ${payload.setter_name ? `Tu punto de contacto es <strong>${payload.setter_name}</strong>.` : ""}
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">
                Smart Scale · <a href="${siteUrl}" style="color:#a3a3a3;">${siteUrl.replace("https://", "")}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Hola ${firstName},

Tu acceso a Smart Scale está listo.${payload.program ? ` Programa: ${payload.program}.` : ""}

Creá tu contraseña haciendo click en este link (un solo uso, expira en 24hs):
${payload.magic_link}

Si expiró o ya lo usaste, entrá a smartscale.space/login con tu email (${payload.email}) y tocá "¿La olvidaste?" para crear tu contraseña de nuevo.

Smart Scale · ${siteUrl}
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, tu acceso a Smart Scale está listo 🎉`,
    html,
    text,
  })
}

// ─── Template: acceso a Skool ─────────────────────────────────────────────────

export async function sendSkoolAccessEmail(payload: {
  name:  string
  email: string
}): Promise<EmailResult> {
  const skoolLink = process.env.SKOOL_INVITE_LINK
  if (!skoolLink) return { ok: false, error: "SKOOL_INVITE_LINK not configured" }

  const firstName = payload.name.split(" ")[0]

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu acceso a Skool</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Comunidad
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Hola ${firstName}, unite a Skool 🎓
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Ahí vas a encontrar el contenido del programa, la comunidad y las clases en vivo.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 8px;">
                    <a href="${skoolLink}"
                       style="display:inline-block;background:#1a1a1a;color:#ffde21;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">
                      Unirme a Skool →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">Smart Scale</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Hola ${firstName},

Ya podés unirte a la comunidad de Skool: ${skoolLink}

Smart Scale
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, unite a la comunidad en Skool 🎓`,
    html,
    text,
  })
}

// ─── Template: acceso a Slack ──────────────────────────────────────────────

export async function sendSlackAccessEmail(payload: {
  name:  string
  email: string
}): Promise<EmailResult> {
  const slackLink = process.env.SLACK_INVITE_LINK
  if (!slackLink) return { ok: false, error: "SLACK_INVITE_LINK not configured" }

  const firstName = payload.name.split(" ")[0]

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu acceso a Slack</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Comunidad
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Hola ${firstName}, sumate a Slack 💬
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Ahí vas a estar en contacto directo con el equipo y el resto de la comunidad.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 8px;">
                    <a href="${slackLink}"
                       style="display:inline-block;background:#1a1a1a;color:#ffde21;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">
                      Unirme a Slack →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">Smart Scale</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Hola ${firstName},

Ya podés unirte a Slack: ${slackLink}

Smart Scale
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, sumate a Slack 💬`,
    html,
    text,
  })
}

// ─── Template: credenciales para el admin que creó el cliente ────────────────

export async function sendCredentialsToAdmin(payload: {
  admin_email:   string
  client_name:   string
  client_email:  string
  temp_password: string
  program?:      string | null
}): Promise<EmailResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.smartscale.co"

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Credenciales del cliente</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">

              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Credenciales para compartir
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Cliente creado: ${payload.client_name}
              </h1>

              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                El cliente ${payload.program ? `(<strong>${payload.program}</strong>)` : ""} está listo para acceder al dashboard.
                <br><br>
                Acá están las credenciales para que se las compartas.
              </p>

              <!-- Credenciales -->
              <div style="background:#f5f5f4;border-radius:10px;padding:20px;margin-bottom:28px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding-bottom:16px;">
                      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                        📧 Email
                      </p>
                      <p style="margin:0;font-size:14px;font-family:monospace;color:#1a1a1a;background:#ffffff;border:1px solid #e5e5e5;border-radius:6px;padding:10px;word-break:break-all;">
                        ${payload.client_email}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                        🔑 Contraseña
                      </p>
                      <p style="margin:0;font-size:14px;font-family:monospace;color:#1a1a1a;background:#ffffff;border:1px solid #e5e5e5;border-radius:6px;padding:10px;word-break:break-all;">
                        ${payload.temp_password}
                      </p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background:#d4edda;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
                <p style="margin:0;font-size:13px;color:#155724;line-height:1.5;">
                  ✅ El cliente también recibió un email con un link de acceso directo. Compartí esta contraseña solo si lo preferís.
                </p>
              </div>

              <a href="${siteUrl}/admin/onboarding" style="display:inline-block;background:#1a1a1a;color:#ffde21;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">
                Volver a onboarding →
              </a>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">
                Smart Scale · <a href="${siteUrl}" style="color:#a3a3a3;">${siteUrl.replace("https://", "")}</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Cliente creado: ${payload.client_name}${payload.program ? ` (${payload.program})` : ""}

Email: ${payload.client_email}
Contraseña: ${payload.temp_password}

Compartí estas credenciales con el cliente por WhatsApp, email, o como prefiera.
El cliente también recibirá un email con acceso directo (link de un solo uso).

Smart Scale
`

  return sendEmail({
    to:      payload.admin_email,
    subject: `Credenciales de ${payload.client_name} — Smart Scale`,
    html,
    text,
  })
}

// ─── Template: recordatorio Monday Win ───────────────────────────────────────

export async function sendMondayWinReminderEmail(payload: {
  name:  string
  email: string
}): Promise<EmailResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.smartscale.co"
  const firstName = payload.name.split(" ")[0]

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cargá tu Monday Win</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Arrancá la semana
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Hola ${firstName}, cargá tu Monday Win 🏆
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Todavía no registraste tus logros y tu foco de esta semana. Te toma 2 minutos.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 8px;">
                    <a href="${siteUrl}/monday-win"
                       style="display:inline-block;background:#1a1a1a;color:#ffde21;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">
                      Cargar mi Monday Win →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">Smart Scale</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Hola ${firstName},

Todavía no cargaste tu Monday Win de esta semana. Cargalo acá: ${siteUrl}/monday-win

Smart Scale
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, cargá tu Monday Win 🏆`,
    html,
    text,
  })
}

// ─── Template: recordatorio Reporte Mensual ──────────────────────────────────

export async function sendMonthlyReportReminderEmail(payload: {
  name:  string
  email: string
}): Promise<EmailResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.smartscale.co"
  const firstName = payload.name.split(" ")[0]

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Te falta el Reporte Mensual</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Reporte mensual
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Hola ${firstName}, te falta el reporte 📊
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Todavía no cargaste tu reporte mensual. Cargalo para que Ann AI te dé el diagnóstico de tu negocio.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 8px;">
                    <a href="${siteUrl}/report-input"
                       style="display:inline-block;background:#1a1a1a;color:#ffde21;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">
                      Cargar mi reporte →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">Smart Scale</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Hola ${firstName},

Todavía no cargaste tu reporte mensual. Cargalo acá: ${siteUrl}/report-input

Smart Scale
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, te falta el Reporte Mensual 📊`,
    html,
    text,
  })
}

// ─── Template: recordatorio de inactividad ───────────────────────────────────

export async function sendInactivityReminderEmail(payload: {
  name:           string
  email:          string
  daysSinceLogin: number
}): Promise<EmailResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.smartscale.co"
  const firstName = payload.name.split(" ")[0]

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hace rato que no entrás</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Te extrañamos
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Hola ${firstName}, hace ${payload.daysSinceLogin} días que no entrás
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Tu dashboard te está esperando con tus métricas, recursos y el progreso de tu negocio.
                Entrá un ratito para no perder el hilo.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 8px;">
                    <a href="${siteUrl}/dashboard"
                       style="display:inline-block;background:#1a1a1a;color:#ffde21;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">
                      Entrar al dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">Smart Scale</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Hola ${firstName},

Hace ${payload.daysSinceLogin} días que no entrás al dashboard. Entrá acá: ${siteUrl}/dashboard

Smart Scale
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, hace ${payload.daysSinceLogin} días que no entrás 👋`,
    html,
    text,
  })
}

// ─── Helpers de formato para las plantillas de cobro/pago ────────────────────

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n)
}
function fmtDateAR(iso: string) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })
}

// ─── Template: próximo cobro (recurrente) ────────────────────────────────────

export async function sendUpcomingChargeEmail(payload: {
  name:    string
  email:   string
  amount:  number
  dueDate: string   // YYYY-MM-DD
}): Promise<EmailResult> {
  const firstName = payload.name.split(" ")[0]
  const montoFmt = fmtMoney(payload.amount)
  const venceFmt = fmtDateAR(payload.dueDate)

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Próximo cobro</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Próximo cobro
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Hola ${firstName}, se te acerca el cobro
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Te vamos a cobrar automáticamente <strong>${montoFmt}</strong> el <strong>${venceFmt}</strong>. No necesitás hacer nada — es tu plan mensual de siempre.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">Smart Scale</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Hola ${firstName},

Te vamos a cobrar automáticamente ${montoFmt} el ${venceFmt}. No necesitás hacer nada.

Smart Scale
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, se te acerca el cobro de ${montoFmt}`,
    html,
    text,
  })
}

// ─── Template: próximo pago (no recurrente, link manual) ────────────────────

export async function sendUpcomingPaymentLinkEmail(payload: {
  name:    string
  email:   string
  amount:  number
  dueDate: string
}): Promise<EmailResult> {
  const firstName = payload.name.split(" ")[0]
  const montoFmt = fmtMoney(payload.amount)
  const venceFmt = fmtDateAR(payload.dueDate)

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Próximo pago</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Próximo pago
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Hola ${firstName}, se te acerca tu cuota
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Tu cuota de <strong>${montoFmt}</strong> vence el <strong>${venceFmt}</strong>. En los próximos días te vamos a enviar el link de pago por Slack.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">Smart Scale</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Hola ${firstName},

Tu cuota de ${montoFmt} vence el ${venceFmt}. En los próximos días te vamos a enviar el link de pago por Slack.

Smart Scale
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, se te acerca tu cuota de ${montoFmt}`,
    html,
    text,
  })
}

// ─── Template: pago confirmado ───────────────────────────────────────────────

export async function sendPaymentConfirmedEmail(payload: {
  name:   string
  email:  string
  amount: number
}): Promise<EmailResult> {
  const firstName = payload.name.split(" ")[0]
  const montoFmt = fmtMoney(payload.amount)

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pago confirmado</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Pago confirmado
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Gracias ${firstName}, recibimos tu pago ✅
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Confirmamos tu pago de <strong>${montoFmt}</strong>. Todo en orden, seguimos trabajando en tu crecimiento 🚀
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">Smart Scale</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Gracias ${firstName},

Confirmamos tu pago de ${montoFmt}. Todo en orden.

Smart Scale
`

  return sendEmail({
    to:      payload.email,
    subject: `Gracias ${firstName}, recibimos tu pago ✅`,
    html,
    text,
  })
}

// ─── Template: cuota vencida ──────────────────────────────────────────────────

export async function sendOverdueInstallmentEmail(payload: {
  name:         string
  email:        string
  amount:       number
  daysOverdue:  number
}): Promise<EmailResult> {
  const firstName = payload.name.split(" ")[0]
  const montoFmt = fmtMoney(payload.amount)

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cuota vencida</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Cuota vencida
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Hola ${firstName}, tenés una cuota pendiente
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Tu cuota de <strong>${montoFmt}</strong> venció hace ${payload.daysOverdue} día${payload.daysOverdue === 1 ? "" : "s"}.
                Si ya lo charlaste con tu coach, ignorá este mensaje — si no, escribinos para coordinar el pago.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">Smart Scale</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Hola ${firstName},

Tu cuota de ${montoFmt} venció hace ${payload.daysOverdue} día(s). Si ya lo charlaste con tu coach, ignorá este mensaje.

Smart Scale
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, tenés una cuota pendiente de ${montoFmt}`,
    html,
    text,
  })
}

// ─── Template: renovación de programa ────────────────────────────────────────

export async function sendRenewalEmail(payload: {
  name:  string
  email: string
}): Promise<EmailResult> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.smartscale.co"
  const firstName = payload.name.split(" ")[0]
  const renewalUrl = `${siteUrl}/renovacion`

  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Próximo nivel</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td style="padding-bottom:24px;" align="center">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">Smart</td>
                  <td width="6"></td>
                  <td style="background:#1a1a1a;border-radius:6px;padding:4px 10px;">
                    <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Scale</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;border-radius:16px;border:1px solid #e5e5e5;padding:40px 36px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                Próximo nivel
              </p>
              <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.2;">
                Hola ${firstName}, ¿cómo estás?
              </h1>
              <p style="margin:0 0 16px;font-size:15px;color:#525252;line-height:1.6;">
                Ya estamos entrando en la etapa final de tu recorrido dentro del programa, y queríamos darte la posibilidad de continuar trabajando junto a nosotros.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#525252;line-height:1.6;">
                Sabemos que este proceso te permitió incorporar herramientas, claridad y estructura para seguir creciendo tu negocio, por lo que creemos que puede ser un muy buen momento para evaluar cuál es el próximo paso más adecuado para vos.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${renewalUrl}"
                       style="display:inline-block;background:#1a1a1a;color:#ffde21;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">
                      Ver opciones para continuar →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;color:#525252;line-height:1.6;">
                Cuando tengas oportunidad de verlo, contanos qué te parece y conversamos juntos cuál de las alternativas se adapta mejor a tus objetivos y a la etapa en la que te encontrás actualmente.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;" align="center">
              <p style="margin:0;font-size:12px;color:#a3a3a3;">Smart Scale</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`

  const text = `Hola ${firstName}, ¿cómo estás?

Ya estamos entrando en la etapa final de tu recorrido dentro del programa, y queríamos darte la posibilidad de continuar trabajando junto a nosotros.

Sabemos que este proceso te permitió incorporar herramientas, claridad y estructura para seguir creciendo tu negocio, por lo que creemos que puede ser un muy buen momento para evaluar cuál es el próximo paso más adecuado para vos.

Estas son las opciones para continuar: ${renewalUrl}

Cuando tengas oportunidad de verlo, contanos qué te parece.

Smart Scale
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, tu próximo nivel te espera`,
    html,
    text,
  })
}
