/**
 * GoHighLevel (GHL) Integration
 * Creates and manages contacts in GHL when clients are onboarded
 */

const GHL_API_KEY = process.env.GHL_API_KEY
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID
// v2 API — required for Private Integration Tokens (pit-...)
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
    const payload = {
      firstName:  data.firstName,
      lastName:   data.lastName || "",
      email:      data.email,
      phone:      data.phone || "",
      locationId: GHL_LOCATION_ID,           // required by v2 API
      source:     data.source || "Smart Scale",
      customFields: data.customFields || {},
      tags:       data.tags || ["smart-scale"],
    }

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
      console.error("GHL contact creation failed:", {
        status: response.status,
        error: (result as any).error || (result as any).message,
      })
      return {
        success: false,
        error: (result as any).error || "Unknown error",
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
