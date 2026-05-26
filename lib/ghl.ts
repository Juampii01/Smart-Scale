/**
 * GoHighLevel (GHL) Integration
 * Creates and manages contacts in GHL when clients are onboarded
 */

const GHL_API_KEY = process.env.GHL_API_KEY
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID
// v2 API — required for Private Integration Tokens (pit-...)
const GHL_API_BASE = "https://services.leadconnectorhq.com"

// GHL v2 custom field format — accepts key (field key) or id (field UUID)
interface GHLCustomField {
  key: string
  field_value: string | number
}

interface GHLContactData {
  firstName:       string
  lastName?:       string
  email:           string
  phone?:          string
  source?:         string
  tags?:           string[]
  // Program data → mapped to GHL custom fields
  program?:        string | null    // → contact.programa (Dropdown)
  totalAmount?:    number           // → contact.pago_total
  primerPago?:     number           // → contact.pago_entrada
  cuotas?:         Record<string, number | null>  // mes_1…mes_6
  cantidadMeses?:  number           // → contact.cantidad_de_meses
  cantidadPagos?:  number           // → contact.cantidad_de_pagos
  setterName?:     string | null    // → contact.setter
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

    // Build customFields array from program data using GHL field keys
    const customFields: GHLCustomField[] = []

    if (data.program)     customFields.push({ key: "programa",           field_value: data.program })
    if (data.totalAmount) customFields.push({ key: "pago_total",         field_value: data.totalAmount })
    if (data.primerPago)  customFields.push({ key: "pago_entrada",       field_value: data.primerPago })
    if (data.setterName)  customFields.push({ key: "setter",             field_value: data.setterName })
    if (data.cantidadPagos)  customFields.push({ key: "cantidad_de_pagos",  field_value: data.cantidadPagos })
    if (data.cantidadMeses)  customFields.push({ key: "cantidad_de_meses",  field_value: data.cantidadMeses })

    // mes_1 … mes_6
    if (data.cuotas) {
      for (let i = 1; i <= 6; i++) {
        const val = data.cuotas[`cuota_${i}`]
        if (val != null && val > 0) {
          customFields.push({ key: `mes_${i}`, field_value: val })
        }
      }
    }

    if (customFields.length) payload.customFields = customFields

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
