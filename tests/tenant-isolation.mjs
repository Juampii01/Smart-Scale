// Puerta #2 del CRM interno — aislamiento por cliente verificado a nivel de
// base de datos, no de interfaz. Crea dos cuentas reales (con sesión real,
// no un JWT simulado), confirma que la cuenta B NO puede leer/editar/borrar
// un registro de la cuenta A (ni insertar uno a nombre de A), y que la
// cuenta A sí puede operar sobre lo suyo (control positivo — si todo diera
// "denegado" el test pasaría por accidente).
//
// Corre SIEMPRE contra la rama de pruebas (crm-testing), nunca contra
// producción — lee las credenciales de CRM_TEST_SUPABASE_URL /
// CRM_TEST_SUPABASE_ANON_KEY / CRM_TEST_SUPABASE_SERVICE_ROLE_KEY.
// Localmente: `set -a; source .env.crm-testing; set +a` ya deja esas
// variables listas (ver package.json → script "test:isolation").

import { createClient } from "@supabase/supabase-js"

const URL = process.env.CRM_TEST_SUPABASE_URL ?? process.env.SUPABASE_URL
const ANON_KEY = process.env.CRM_TEST_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.CRM_TEST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!URL || !ANON_KEY || !SERVICE_KEY) {
  console.error("Faltan variables de entorno de la rama de pruebas (CRM_TEST_SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY).")
  process.exit(1)
}
// Cinturón de seguridad: este test borra/crea filas — que jamás corra
// apuntando a la base real de producción por un env mal seteado.
if (/vpjoamvzfdfbprtpwllz/.test(URL)) {
  console.error(`ABORTADO: la URL apunta al proyecto de PRODUCCIÓN (${URL}). Este test solo corre contra la rama de pruebas.`)
  process.exit(1)
}

const admin = createClient(URL, SERVICE_KEY)

let failures = 0
function check(label, cond) {
  if (cond) { console.log(`  ok  — ${label}`) }
  else { console.error(`  FAIL — ${label}`); failures++ }
}

async function makeTestAccount(tag) {
  const email = `isolation-test-${tag}-${Date.now()}@isolation-test.local`
  const password = `Test${Math.random().toString(36).slice(2)}!Aa1`

  const { data: userRes, error: userErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (userErr) throw new Error(`createUser(${tag}): ${userErr.message}`)

  const { data: clientRow, error: clientErr } = await admin
    .from("clients")
    .insert({ name: `Isolation Test Client ${tag}`, nombre: `Cliente prueba ${tag}` })
    .select("id")
    .single()
  if (clientErr) throw new Error(`insert clients(${tag}): ${clientErr.message}`)

  const { error: profileErr } = await admin
    .from("profiles")
    .insert({ id: userRes.user.id, role: "client", client_id: clientRow.id, name: `Prueba ${tag}` })
  if (profileErr) throw new Error(`insert profiles(${tag}): ${profileErr.message}`)

  const anon = createClient(URL, ANON_KEY)
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password })
  if (signInErr) throw new Error(`signIn(${tag}): ${signInErr.message}`)

  const asUser = createClient(URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  })

  return { userId: userRes.user.id, clientId: clientRow.id, client: asUser }
}

async function cleanup(accounts, prospectIds) {
  for (const id of prospectIds) {
    await admin.from("client_prospects").delete().eq("id", id)
  }
  for (const acc of accounts) {
    await admin.from("profiles").delete().eq("id", acc.userId)
    await admin.from("clients").delete().eq("id", acc.clientId)
    await admin.auth.admin.deleteUser(acc.userId)
  }
}

async function main() {
  console.log(`Corriendo contra: ${URL}`)
  const A = await makeTestAccount("a")
  const B = await makeTestAccount("b")
  const prospectIds = []

  try {
    // Fixture: un prospecto que pertenece a A, creado con service role
    // (así el fixture en sí no depende de que el insert de A ya funcione).
    const { data: prospectA, error: insErr } = await admin
      .from("client_prospects")
      .insert({ client_id: A.clientId, name: "Prospecto de A", notes: "dato de prueba, no real" })
      .select("id")
      .single()
    if (insErr) throw new Error(`fixture insert: ${insErr.message}`)
    prospectIds.push(prospectA.id)

    console.log("\n1. Control positivo — A puede ver lo suyo:")
    const { data: ownRead } = await A.client.from("client_prospects").select("id").eq("id", prospectA.id)
    check("A lee su propio prospecto", (ownRead ?? []).length === 1)

    console.log("\n2. B pide a mano el registro de A (SELECT):")
    const { data: crossRead, error: crossReadErr } = await B.client.from("client_prospects").select("id").eq("id", prospectA.id)
    check("la base niega la lectura (0 filas, no error de permiso — RLS filtra silenciosamente)", !crossReadErr && (crossRead ?? []).length === 0)

    console.log("\n3. B intenta editar el registro de A (UPDATE):")
    const { data: crossUpdate } = await B.client.from("client_prospects").update({ name: "hackeado" }).eq("id", prospectA.id).select("id")
    check("la base niega el update (0 filas afectadas)", (crossUpdate ?? []).length === 0)
    const { data: afterUpdate } = await admin.from("client_prospects").select("name").eq("id", prospectA.id).single()
    check("el nombre real de A no cambió", afterUpdate?.name === "Prospecto de A")

    console.log("\n4. B intenta borrar el registro de A (DELETE):")
    const { data: crossDelete } = await B.client.from("client_prospects").delete().eq("id", prospectA.id).select("id")
    check("la base niega el delete (0 filas afectadas)", (crossDelete ?? []).length === 0)
    const { data: stillThere } = await admin.from("client_prospects").select("id").eq("id", prospectA.id).maybeSingle()
    check("el registro de A sigue existiendo", !!stillThere)

    console.log("\n5. B intenta insertar un prospecto a nombre de A (INSERT con client_id ajeno):")
    const { error: fakeInsertErr } = await B.client.from("client_prospects").insert({ client_id: A.clientId, name: "prospecto falso de B" })
    check("la base rechaza el insert (RLS with check)", !!fakeInsertErr)

    console.log("\n6. Control positivo — B puede crear y ver lo propio:")
    const { data: ownProspectB, error: ownInsertErr } = await B.client.from("client_prospects").insert({ client_id: B.clientId, name: "Prospecto de B" }).select("id").single()
    check("B puede insertar su propio prospecto", !ownInsertErr && !!ownProspectB)
    if (ownProspectB) prospectIds.push(ownProspectB.id)
    const { data: aReadsB } = await A.client.from("client_prospects").select("id").eq("client_id", B.clientId)
    check("A no ve nada de la cartera de B", (aReadsB ?? []).length === 0)

  } finally {
    await cleanup([A, B], prospectIds)
  }

  console.log(`\n${failures === 0 ? "PASÓ" : "FALLÓ"} — ${failures} chequeo(s) fallido(s).`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error("Error inesperado:", err)
  process.exit(1)
})
