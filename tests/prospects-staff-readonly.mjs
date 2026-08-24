// Verifica la regla de permisos más crítica del CRM interno: el equipo de
// Smart Scale (staff interno) puede LEER cualquier cuenta pero NUNCA
// escribir — ni admin, ni team, ni setter. Corre contra la rama de pruebas,
// nunca contra producción (mismo cinturón de seguridad que tenant-isolation.mjs).

import { createClient } from "@supabase/supabase-js"

const URL = process.env.CRM_TEST_SUPABASE_URL ?? process.env.SUPABASE_URL
const ANON_KEY = process.env.CRM_TEST_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.CRM_TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Faltan variables de entorno de la rama de pruebas.")
  process.exit(1)
}
if (/vpjoamvzfdfbprtpwllz/.test(URL)) {
  console.error(`ABORTADO: la URL apunta a PRODUCCIÓN (${URL}).`)
  process.exit(1)
}

const admin = createClient(URL, SERVICE_KEY)
let failures = 0
function check(label, cond) {
  if (cond) { console.log(`  ok  — ${label}`) }
  else { console.error(`  FAIL — ${label}`); failures++ }
}

async function makeAccount(tag, role, internalTenantId) {
  const email = `crm-readonly-test-${tag}-${Date.now()}@isolation-test.local`
  const password = `Test${Math.random().toString(36).slice(2)}!Aa1`
  const { data: userRes, error: userErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (userErr) throw new Error(`createUser(${tag}): ${userErr.message}`)

  const profile = { id: userRes.user.id, role, name: `Prueba ${tag}` }
  if (role === "client") profile.client_id = internalTenantId
  else profile.internal_tenant_id = internalTenantId
  const { error: profileErr } = await admin.from("profiles").insert(profile)
  if (profileErr) throw new Error(`insert profiles(${tag}): ${profileErr.message}`)

  const anon = createClient(URL, ANON_KEY)
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error(`signIn(${tag}): ${signInErr.message}`)
  const asUser = createClient(URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } } })
  return { userId: userRes.user.id, client: asUser }
}

async function cleanup(accounts, clientId, prospectIds) {
  for (const id of prospectIds) await admin.from("client_prospects").delete().eq("id", id)
  for (const acc of accounts) {
    await admin.from("profiles").delete().eq("id", acc.userId)
    await admin.auth.admin.deleteUser(acc.userId)
  }
  if (clientId) await admin.from("clients").delete().eq("id", clientId)
}

async function main() {
  console.log(`Corriendo contra: ${URL}`)
  const { data: clientRow, error: clientErr } = await admin
    .from("clients").insert({ name: "CRM Readonly Test Client", nombre: "Cliente prueba readonly" }).select("id").single()
  if (clientErr) throw new Error(`insert clients: ${clientErr.message}`)
  const clientId = clientRow.id

  const CLIENT = await makeAccount("owner", "client", clientId)
  const STAFF = await makeAccount("staff", "admin", clientId) // internal_tenant_id apunta al mismo client_id a propósito, para probar que igual no puede escribir
  const prospectIds = []

  try {
    const { data: prospect, error: insErr } = await admin
      .from("client_prospects")
      .insert({ client_id: clientId, name: "Prospecto de prueba", status: "nuevo" })
      .select("id").single()
    if (insErr) throw new Error(`fixture insert: ${insErr.message}`)
    prospectIds.push(prospect.id)

    console.log("\n1. El dueño (cliente) puede ver y editar lo suyo:")
    const { data: ownRead } = await CLIENT.client.from("client_prospects").select("id").eq("id", prospect.id)
    check("cliente lee su propio prospecto", (ownRead ?? []).length === 1)
    const { data: ownUpdate } = await CLIENT.client.from("client_prospects").update({ notes: "actualizado por el dueño" }).eq("id", prospect.id).select("id")
    check("cliente edita su propio prospecto", (ownUpdate ?? []).length === 1)

    console.log("\n2. Staff interno puede LEER (solo lectura):")
    const { data: staffRead, error: staffReadErr } = await STAFF.client.from("client_prospects").select("id").eq("id", prospect.id)
    check("staff lee el prospecto sin error", !staffReadErr && (staffRead ?? []).length === 1)

    console.log("\n3. Staff interno NO puede escribir (ni admin):")
    const { data: staffUpdate } = await STAFF.client.from("client_prospects").update({ notes: "hackeado por staff" }).eq("id", prospect.id).select("id")
    check("la base niega el update de staff (0 filas afectadas)", (staffUpdate ?? []).length === 0)
    const { data: afterStaffUpdate } = await admin.from("client_prospects").select("notes").eq("id", prospect.id).single()
    check("las notas NO cambiaron por el intento de staff", afterStaffUpdate?.notes === "actualizado por el dueño")

    const { data: staffInsert, error: staffInsertErr } = await STAFF.client
      .from("client_prospects").insert({ client_id: clientId, name: "prospecto falso de staff" }).select("id")
    check("la base niega el insert de staff", !!staffInsertErr || (staffInsert ?? []).length === 0)

    const { data: staffDelete } = await STAFF.client.from("client_prospects").delete().eq("id", prospect.id).select("id")
    check("la base niega el delete de staff (0 filas afectadas)", (staffDelete ?? []).length === 0)
    const { data: stillThere } = await admin.from("client_prospects").select("id").eq("id", prospect.id).maybeSingle()
    check("el prospecto sigue existiendo", !!stillThere)

  } finally {
    await cleanup([CLIENT, STAFF], clientId, prospectIds)
  }

  console.log(`\n${failures === 0 ? "PASÓ" : "FALLÓ"} — ${failures} chequeo(s) fallido(s).`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => { console.error("Error inesperado:", err); process.exit(1) })
