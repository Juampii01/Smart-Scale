/**
 * GoHighLevel (GHL) Integration
 * Creates and manages contacts in GHL when clients are onboarded
 */

const GHL_API_KEY = process.env.GHL_API_KEY
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID
// v2 API — required for Private Integration Tokens (pit-...)
const GHL_API_BASE = "https://services.leadconnectorhq.com"

// GHL v2 custom field format
interface GHLCustomField {
  id: string
  field_value: string
}

interface GHLContactData {
  firstName: string
  lastName?: string
  email: string
  phone?: string
  source?: string
  customFields?: GHLCustomField[]
  tags?: string[]
  // Extra data stored in GHL notes until custom field IDs are configured
  program?: string | null
  totalAmount?: number
  cuotasStr?: string
  programStart?: string
  setterName?: string | null
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
      firstName:  data.firstName,
      lastName:   data.lastName || "",
      email:      data.email,
      locationId: GHL_LOCATION_ID,
      source:     data.source || "Smart Scale",
      tags:       data.tags || ["smart-scale"],
    }

    // Phone: GHL v2 requires E.164 format (+prefix)
    if (data.phone) {
      payload.phone = data.phone.startsWith("+") ? data.phone : `+${data.phone}`
    }

    // customFields: GHL v2 uses array of {id, field_value}, omit if empty
    if (data.customFields && data.customFields.length > 0) {
      payload.customFields = data.customFields
    }

    // Pack program data into the GHL notes field so it's visible in the contact
    // and usable by GHL workflows until custom field IDs are properly configured
    const noteParts: string[] = []
    if (data.program)      noteParts.push(`Programa: ${data.program}`)
    if (data.totalAmount)  noteParts.push(`Total: $${data.totalAmount.toLocaleString("es-AR")}`)
    if (data.cuotasStr)    noteParts.push(`Cuotas: ${data.cuotasStr}`)
    if (data.programStart) noteParts.push(`Inicio: ${data.programStart}`)
    if (data.setterName)   noteParts.push(`Setter: ${data.setterName}`)
    if (noteParts.length)  payload.notes = noteParts.join(" | ")

    const response = await fetch(`${GHL_API_BASE}/contacts/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GHL_API_KEY}`,
        "Content-Type": "application/json",
        "Version": "2021-07-28",             // v2 version header
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      const msg: string = (result as any).message ?? (result as any).error ?? ""
      // GHL rejects duplicate contacts — treat as soft success (contact already exists)
      if (response.status === 400 && msg.toLowerCase().includes("duplicated")) {
        const existingId = (result as any).meta?.contactId ?? "unknown"
        console.log("GHL contact already exists, skipping creation:", existingId)
        return { success: true, contact: { id: existingId } }
      }
      console.error("GHL contact creation failed:", {
        status: response.status,
        error: msg,
        detail: JSON.stringify(result).slice(0, 500),
      })
      return { success: false, error: msg || "Unknown error" }
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
