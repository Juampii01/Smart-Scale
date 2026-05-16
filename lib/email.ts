// ─── Email via Resend ─────────────────────────────────────────────────────────
// Sends transactional emails using Resend's REST API (no npm package needed).
// Requires: RESEND_API_KEY + RESEND_FROM_EMAIL in env vars.
//
// RESEND_FROM_EMAIL must be a verified domain, e.g. "Smart Scale <hola@smartscale.co>"
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
  const from   = process.env.RESEND_FROM_EMAIL ?? "Smart Scale <hola@smartscale.co>"

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
                    <span style="font-size:22px;font-weight:700;color:#ffde21;letter-spacing:-0.5px;">Scale</span>
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
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 28px;">
                    <a href="${payload.magic_link}"
                       style="display:inline-block;background:#ffde21;color:#1a1a1a;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:-0.2px;">
                      Ingresar al dashboard →
                    </a>
                  </td>
                </tr>
              </table>

              <div style="background:#f5f5f4;border-radius:10px;padding:16px 20px;margin-bottom:28px;">
                <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#a3a3a3;text-transform:uppercase;letter-spacing:0.08em;">
                  ⚠️ Importante
                </p>
                <p style="margin:0;font-size:13px;color:#525252;line-height:1.5;">
                  Este link es de un solo uso y expira en 24 horas. Si no podés usarlo ahora, podés solicitar uno nuevo desde la pantalla de login con tu email: <strong>${payload.email}</strong>
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

Ingresá al dashboard haciendo click en este link (un solo uso, expira en 24hs):
${payload.magic_link}

Si no podés usarlo, solicitá uno nuevo desde el login con tu email: ${payload.email}

Smart Scale · ${siteUrl}
`

  return sendEmail({
    to:      payload.email,
    subject: `${firstName}, tu acceso a Smart Scale está listo 🎉`,
    html,
    text,
  })
}
