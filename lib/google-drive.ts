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
//
// El Google Doc que se actualiza tiene que existir de antemano, creado por
// un usuario real (no por la cuenta de servicio) — ver el comment de
// updateDocInFolder más abajo, es un límite real de Google, no un bug.

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
 * Actualiza el CONTENIDO de un Google Doc que ya existe en esa carpeta
 * (buscado por nombre exacto) — nunca lo crea. Las service accounts tienen
 * cuota de almacenamiento propia = 0 bytes, así que un `files.create` hecho
 * por la cuenta de servicio siempre falla con "storageQuotaExceeded",
 * incluso en una carpeta ajena con espacio de sobra — Google exige que el
 * documento ya exista y sea propiedad de un usuario real (con Google
 * Workspace se podría crear en una Unidad compartida, pero no aplica acá).
 * Por eso el doc lo crea el admin a mano una vez, y esta función solo lo
 * mantiene actualizado.
 */
export async function updateDocInFolder(params: {
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
  const fileId: string | undefined = listJson.files?.[0]?.id

  if (!fileId) {
    throw new Error(
      `No existe un Google Doc llamado "${name}" en esa carpeta. Creá uno vacío con ese nombre exacto ` +
      `dentro de la carpeta compartida (Google Docs → Documento en blanco, o desde Drive: Nuevo → ` +
      `Documentos de Google) y volvé a intentar.`
    )
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
