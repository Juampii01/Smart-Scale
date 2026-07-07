// Test de aislamiento de buildOmniSystemPrompt — Fase 2 del motor de feedback
// de Omni. Corre contra la función real (no una reimplementación), usando 3
// filas de prueba en omni_client_profiles que se insertan y se borran en el
// mismo run. No requiere ANTHROPIC_API_KEY (buildOmniSystemPrompt no llama
// a Claude, solo arma el string).
//
// Uso: npx tsx lib/omni/_isolation-test.ts

import * as fs from "fs"
import * as path from "path"

const envContent = fs.readFileSync(path.join(__dirname, "../../.env.local"), "utf8")
for (const line of envContent.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
}

import { createServiceClient } from "../supabase-service"
import { buildOmniSystemPrompt, OmniContextError } from "./system-prompt"

const sb = createServiceClient()

let passed = 0
let failed = 0

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✓ ${label}`)
    passed++
  } else {
    console.log(`  ✗ ${label}`)
    failed++
  }
}

const ROW_A = {
  client_id: "__test_a__",
  business_name: "NegocioTestA",
  mentor_name: "MentorTestA",
  principios: ["UNIQUE_PRINCIPLE_A_XYZ123: calificar antes de cotizar"],
  vocabulario: { termino_unico_a: "definicion_a_XYZ123" },
  casos_referencia: [{ situacion: "caso unico A", resultado: "SECRETO_A_XYZ123", leccion: "leccion A" }],
}

const ROW_B = {
  client_id: "__test_b__",
  business_name: "NegocioTestB",
  mentor_name: "MentorTestB",
  principios: ["UNIQUE_PRINCIPLE_B_XYZ789: nunca dar precio en el primer mensaje"],
  vocabulario: { termino_unico_b: "definicion_b_XYZ789" },
  casos_referencia: [{ situacion: "caso unico B", resultado: "SECRETO_B_XYZ789", leccion: "leccion B" }],
}

const ROW_INCOMPLETE = {
  client_id: "__test_incomplete__",
  business_name: "NegocioIncompleto",
  mentor_name: "MentorIncompleto",
  principios: ["algo"],
  vocabulario: { algo: "algo" },
  casos_referencia: [], // capa 3 vacía a propósito
}

const TEST_CLIENT_IDS = [ROW_A.client_id, ROW_B.client_id, ROW_INCOMPLETE.client_id]

async function cleanup() {
  await sb.from("omni_client_profiles").delete().in("client_id", TEST_CLIENT_IDS)
}

async function main() {
  await cleanup() // por si quedó algo de un run anterior interrumpido

  const { error: insErr } = await sb.from("omni_client_profiles").insert([ROW_A, ROW_B, ROW_INCOMPLETE])
  if (insErr) {
    console.error("No se pudieron insertar las filas de prueba:", insErr.message)
    process.exit(1)
  }

  try {
    console.log("\n[Test 1] Aislamiento entre client_id A y B")
    const promptA = await buildOmniSystemPrompt(sb, ROW_A.client_id)
    const promptB = await buildOmniSystemPrompt(sb, ROW_B.client_id)

    check("prompt de A contiene el nombre de negocio A", promptA.includes(ROW_A.business_name))
    check("prompt de A contiene su propio principio único", promptA.includes("XYZ123"))
    check("prompt de A contiene su propio término de vocabulario", promptA.includes("termino_unico_a"))
    check("prompt de A contiene su propio caso de referencia", promptA.includes("SECRETO_A_XYZ123"))

    check("prompt de A NO contiene el nombre de negocio B", !promptA.includes(ROW_B.business_name))
    check("prompt de A NO contiene el principio de B", !promptA.includes("XYZ789"))
    check("prompt de A NO contiene el vocabulario de B", !promptA.includes("termino_unico_b"))
    check("prompt de A NO contiene el caso de referencia de B", !promptA.includes("SECRETO_B_XYZ789"))

    check("prompt de B contiene el nombre de negocio B", promptB.includes(ROW_B.business_name))
    check("prompt de B contiene su propio principio único", promptB.includes("XYZ789"))
    check("prompt de B contiene su propio término de vocabulario", promptB.includes("termino_unico_b"))
    check("prompt de B contiene su propio caso de referencia", promptB.includes("SECRETO_B_XYZ789"))

    check("prompt de B NO contiene el nombre de negocio A", !promptB.includes(ROW_A.business_name))
    check("prompt de B NO contiene el principio de A", !promptB.includes("XYZ123"))
    check("prompt de B NO contiene el vocabulario de A", !promptB.includes("termino_unico_a"))
    check("prompt de B NO contiene el caso de referencia de A", !promptB.includes("SECRETO_A_XYZ123"))

    console.log("\n[Test 2] Falla explícita si falta una capa")
    try {
      await buildOmniSystemPrompt(sb, ROW_INCOMPLETE.client_id)
      check("lanza excepción cuando falta casos_referencia", false)
    } catch (e) {
      check("lanza excepción cuando falta casos_referencia", e instanceof OmniContextError)
      check("el mensaje de error menciona 'casos_referencia'", e instanceof Error && e.message.includes("casos_referencia"))
    }

    try {
      await buildOmniSystemPrompt(sb, "__client_id_que_no_existe__")
      check("lanza excepción cuando el client_id no tiene ninguna fila", false)
    } catch (e) {
      check("lanza excepción cuando el client_id no tiene ninguna fila", e instanceof OmniContextError)
    }

    try {
      await buildOmniSystemPrompt(sb, "")
      check("lanza excepción cuando client_id es vacío (sin default silencioso)", false)
    } catch (e) {
      check("lanza excepción cuando client_id es vacío (sin default silencioso)", e instanceof OmniContextError)
    }
  } finally {
    await cleanup()
  }

  console.log(`\n${passed} pasaron, ${failed} fallaron\n`)
  process.exit(failed > 0 ? 1 : 0)
}

main()
