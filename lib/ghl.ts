/**
 * GoHighLevel (GHL) Integration
 * Creates and manages contacts in GHL when clients are onboarded
 */

const GHL_API_KEY = process.env.GHL_API_KEY
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID
// pit- tokens son Private Integration tokens → API v2
const GHL_API_BASE = "https://services.leadconnectorhq.com"

interface GHLContactData {
  firstName: string
  lastName?: string
  email: string
  phone?: string
  source?: string
  customFields?: Record<string, string>
  tags?: string[]
}

interface GHLResponse {
  success: boolean
  contact?: {
    id: string
    [key: string]: any
  }
  error?: string
}

/**
 * Create a contact in GHL
 * Fire-and-forget: logs errors but doesn't throw
 */
export async function createGHLContact(data: GHLContactData): Promise<GHLResponse | null> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    console.warn("GHL credentials not configured")
    return null
  }

  try {
    const payload: Record<string, any> = {
      locationId: GHL_LOCATION_ID,
      firstName:  data.firstName,
      lastName:   data.lastName || "",
      email:      data.email,
      phone:      data.phone || "",
      source:     data.source || "Smart Scale",
      tags:       data.tags || ["smart-scale"],
    }

    // customFields como array de { key, value } para v2
    if (data.customFields && Object.keys(data.customFields).length > 0) {
      payload.customFields = Object.entries(data.customFields).map(([key, value]) => ({ key, value }))
    }

    const response = await fetch(`${GHL_API_BASE}/contacts/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GHL_API_KEY}`,
        "Content-Type": "application/json",
        "Version": "2021-07-28",
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      const errMsg = (result as any).message || (result as any).error || JSON.stringify(result)
      console.error("GHL contact creation failed:", { status: response.status, body: result })
      return {
        success: false,
        error: `${response.status}: ${errMsg}`,
      }
    }

    console.log("GHL contact created successfully:", (result as any).contact?.id)
    return {
      success: true,
      contact: result.contact,
    }
  } catch (err) {
    console.error("GHL contact creation error:", err)
    return {
      success: false,
      error: (err as any).message || "Network error",
    }
  }
}

/**
 * Search a contact in GHL by email, returns contact id or null
 */
export async function findGHLContactByEmail(email: string): Promise<string | null> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) return null
  try {
    const res = await fetch(
      `${GHL_API_BASE}/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(email)}`,
      { headers: { "Authorization": `Bearer ${GHL_API_KEY}`, "Version": "2021-07-28" } }
    )
    const data = await res.json()
    return (data as any)?.contact?.id ?? null
  } catch { return null }
}

/**
 * Create a GHL Invoice and return its payment URL
 */
export async function createGHLInvoice(opts: {
  contactId: string
  name:       string
  amount:     number        // in USD
  description?: string
}): Promise<{ success: boolean; paymentUrl?: string; invoiceId?: string; error?: string }> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) return { success: false, error: "GHL not configured" }

  try {
    const payload = {
      altId:   GHL_LOCATION_ID,
      altType: "location",
      name:    opts.name,
      status:  "sent",
      currency: "USD",
      contactDetails: { id: opts.contactId },
      invoiceItems: [{
        name:      opts.description || opts.name,
        qty:       1,
        unitPrice: opts.amount,
      }],
    }

    const res = await fetch(`${GHL_API_BASE}/invoices/`, {
      method: "POST",
      headers: {
        "Authorization":  `Bearer ${GHL_API_KEY}`,
        "Content-Type":   "application/json",
        "Version":        "2021-07-28",
      },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = (data as any).message || (data as any).error || JSON.stringify(data)
      return { success: false, error: `${res.status}: ${msg}` }
    }

    const invoice = (data as any).invoice ?? data
    return {
      success:    true,
      invoiceId:  invoice.id,
      paymentUrl: invoice.paymentLink ?? invoice._id
        ? `https://invoice.gohighlevel.com/invoice/${invoice.id}`
        : undefined,
    }
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" }
  }
}

/**
 * Parse name into firstName and lastName
 */
export function parseFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(" ")
  const firstName = parts[0] || ""
  const lastName = parts.slice(1).join(" ") || ""
  return { firstName, lastName }
}

/**
 * Format phone number (remove common formatting)
 */
export function formatPhoneForGHL(phone?: string | null): string {
  if (!phone) return ""
  return phone.replace(/\D/g, "") // Remove all non-digits
}
