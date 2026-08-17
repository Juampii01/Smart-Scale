// ─── Google Drive — export del Cerebro de Ann ─────────────────────────────────
// Auth vía Service Account (GOOGLE_SERVICE_ACCOUNT_JSON, JSON completo en una
// sola línea) usando google-auth-library (liviana) + REST directo a la API de
// Drive — se evita el paquete `googleapis` a propósito: sus tipos son tan
// grandes que hacen explotar la memoria de `tsc` e inflarían el bundle de la
// función serverless para nada (solo necesitamos 2-3 endpoints).
//
// La carpeta destino (GOOGLE_DRIVE_FOLDER_ID) tiene que estar compartida con
// el email de esa cuenta de servicio (rol Editor) — si no, cualquier
// operación falla con 404 aunque el ID sea correcto.

import { JWT } from "google-auth-library"

const DRIVE_API = "https://www.googleapis.com/drive/v3"
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3"

function getAuth(): JWT {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no configurada")
  const credentials = JSON.parse(raw)
  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  })
}

async function driveFetch(auth: JWT, url: string, init: RequestInit = {}): Promise<Response> {
  const { token } = await auth.getAccessToken()
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Drive API ${res.status}: ${body}`)
  }
  return res
}

/**
 * Crea (o actualiza si ya existe un archivo con el mismo nombre en esa
 * carpeta) un Google Doc nativo a partir de texto plano — Drive lo convierte
 * automáticamente al subirlo. Idempotente por nombre: reemplaza el contenido
 * en vez de duplicar el archivo en cada corrida, así el link no cambia.
 */
export async function upsertDocInFolder(params: {
  name: string
  content: string
  folderId: string
}): Promise<{ id: string; webViewLink: string }> {
  const { name, content, folderId } = params
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID no configurada")

  const auth = getAuth()

  const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`)
  const listRes = await driveFetch(auth, `${DRIVE_API}/files?q=${q}&fields=files(id,name)&spaces=drive`)
  const listJson = await listRes.json()
  let fileId: string | undefined = listJson.files?.[0]?.id

  if (!fileId) {
    const createRes = await driveFetch(auth, `${DRIVE_API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.document",
        parents: [folderId],
      }),
    })
    const createJson = await createRes.json()
    fileId = createJson.id
  }

  await driveFetch(auth, `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
    body: content,
  })

  const metaRes = await driveFetch(auth, `${DRIVE_API}/files/${fileId}?fields=id,webViewLink`)
  const meta = await metaRes.json()
  return { id: meta.id, webViewLink: meta.webViewLink }
}
