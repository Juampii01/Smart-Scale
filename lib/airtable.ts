// ─── Airtable Sync Integration ────────────────────────────────────────────────
// Replicates monthly report data to an Airtable base.
// Requires: AIRTABLE_API_KEY, AIRTABLE_BASE_ID
// Optional: AIRTABLE_TABLE_NAME (default: "Monthly Reports")
// All errors are caught and returned — Supabase is always the source of truth.

export interface AirtableResult {
  ok: boolean
  record_id?: string
  error?: string
}

function getConfig() {
  return {
    apiKey: process.env.AIRTABLE_API_KEY ?? null,
    baseId: process.env.AIRTABLE_BASE_ID ?? null,
    tableName: process.env.AIRTABLE_TABLE_NAME ?? "Monthly Reports",
  }
}

export function isAirtableConfigured(): boolean {
  const { apiKey, baseId } = getConfig()
  return Boolean(apiKey && baseId)
}

// ─── Field name mapper ────────────────────────────────────────────────────────
// Maps Supabase column names → Airtable field names.
// Customize this to match your Airtable schema.

const FIELD_MAP: Record<string, string> = {
  client_id: "Client ID",
  month: "Month",
  total_revenue: "Total Revenue",
  cash_collected: "Cash Collected",
  mrr: "MRR",
  ad_spend: "Ad Spend",
  software_costs: "Software Costs",
  variable_costs: "Variable Costs",
  scheduled_calls: "Scheduled Calls",
  attended_calls: "Attended Calls",
  qualified_calls: "Qualified Calls",
  aplications: "Applications",
  new_clients: "New Clients",
  active_clients: "Active Clients",
  inbound_messages: "Inbound Messages",
  offers_presented: "Offers Presented",
  offer_docs_sent: "Offer Docs Sent",
  offer_docs_responded: "Offer Docs Responded",
  cierres_por_offerdoc: "Cierres por OfferDoc",
  short_followers: "Short-form Followers",
  short_reach: "Short-form Reach",
  short_posts: "Short-form Posts",
  yt_subscribers: "YouTube Subscribers",
  yt_monthly_audience: "YouTube Monthly Audience",
  yt_views: "YouTube Views",
  yt_watch_time: "YouTube Watch Time",
  yt_new_subscribers: "YouTube New Subscribers",
  yt_videos: "YouTube Videos",
  email_subscribers: "Email Subscribers",
  email_new_subscribers: "Email New Subscribers",
  biggest_win: "Biggest Win",
  next_focus: "Next Focus",
  support_needed: "Support Needed",
  improvements: "Improvements",
  feedback: "Feedback",
  report_date: "Report Date",
}

const SKIP_KEYS = new Set(["id", "created_at", "updated_at"])

function toAirtableFields(report: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(report)) {
    if (SKIP_KEYS.has(key)) continue
    if (value === null || value === undefined) continue
    const airtableKey = FIELD_MAP[key] ?? key
    out[airtableKey] = value
  }
  return out
}

// ─── Upsert a monthly report record to Airtable ───────────────────────────────

export async function syncReportToAirtable(
  report: Record<string, unknown>
): Promise<AirtableResult> {
  const { apiKey, baseId, tableName } = getConfig()

  if (!apiKey || !baseId) {
    return { ok: false, error: "Airtable not configured (missing API key or base ID)" }
  }

  const fields = toAirtableFields(report)
  const base = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`

  try {
    // Search for existing record (match on Client ID + Month)
    const clientId = String(report.client_id ?? "")
    const month = String(report.month ?? "").slice(0, 7) // YYYY-MM

    if (clientId && month) {
      const searchRes = await fetch(
        `${base}?filterByFormula=AND({Client ID}="${clientId}",{Month}="${month}")&maxRecords=1`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        }
      )

      if (searchRes.ok) {
        const searchData = await searchRes.json()
        const existingId: string | undefined = searchData?.records?.[0]?.id

        if (existingId) {
          // Patch existing record
          const patchRes = await fetch(`${base}/${existingId}`, {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ fields }),
          })

          if (!patchRes.ok) {
            const errText = await patchRes.text().catch(() => "")
            return { ok: false, error: `Airtable PATCH failed (${patchRes.status}): ${errText}` }
          }

          const patchData = await patchRes.json()
          return { ok: true, record_id: patchData?.id }
        }
      }
    }

    // Create new record
    const createRes = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields }),
    })

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => "")
      return { ok: false, error: `Airtable POST failed (${createRes.status}): ${errText}` }
    }

    const createData = await createRes.json()
    return { ok: true, record_id: createData?.id }
  } catch (err: any) {
    return { ok: false, error: err?.message ?? "Unknown Airtable error" }
  }
}
