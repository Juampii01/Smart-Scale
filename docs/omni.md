# Omni — documentación técnica completa

> **Qué es este documento:** referencia exhaustiva de todo lo construido para Omni en esta sesión, pensada para que se pueda auditar/evaluar (por una IA o por una persona) contrastando cada afirmación contra el código y la base real — no es un resumen de memoria. Todas las rutas de archivo, esquemas y conteos de filas están verificados al momento de escribir esto (**3 de julio de 2026**).
>
> **Qué NO es:** un documento de marketing del feature. Incluye explícitamente lo que no está probado, lo que falta, y lo que puede estar roto.

---

## 1. Qué es Omni

Omni es un **piloto interno**, invisible para todo el equipo excepto el dueño del proyecto (Juampi). Vive dentro del mismo dashboard de Smart Scale (`/admin/omni`) pero ni Ann ni el resto de los admins lo ven ni pueden navegar a él.

La idea de producto (ver conversación completa para el contexto de negocio): un sistema que lee las conversaciones reales del negocio de Ann — Instagram DMs y la comunidad de Slack — y le permite a Juampi (a) ver análisis automáticos de patrones/problemas, y (b) conversar en lenguaje natural sobre esos datos ("¿cómo cerró Andrés?").

### Principio de aislamiento (no negociable)

Todo lo de Omni vive en su propio espacio de nombres, sin tocar ni reusar los flujos compartidos que usan clientes reales:

| Compartido (NO se toca) | Equivalente aislado de Omni |
|---|---|
| `lib/social/oauth.ts`, `app/api/social/[platform]/*`, tabla `social_connections` | `lib/omni/instagram.ts`, `app/api/admin/omni/instagram/*`, tabla `omni_instagram_connections` |
| `lib/slack.ts` (notificaciones, creación de canales) | `lib/omni/slack-oauth.ts` + `lib/omni/slack-read.ts`, tabla `omni_slack_user_connection` |
| `/api/admin/assistant` (asistente del CRM interno), `ann_conversations` | `/api/admin/omni/chat`, tabla `omni_chat_conversations` |
| `app_logs` (compartida, se sigue usando igual) | — |

Razón de este aislamiento: pedirle a Ann un permiso sensible (leer sus DMs) nunca debe ensanchar lo que se le pide a un cliente normal que conecta Instagram para ver insights de contenido.

---

## 2. Control de acceso

- **Frontend:** `lib/omni/owner.ts` exporta `OMNI_OWNER_EMAIL` (hardcodeado, `juampiacosta158@gmail.com`) y `isOmniOwnerEmail(email)`. El botón del sidebar (`components/layout/admin-sidebar.tsx`) y la vista (`components/views/admin-omni-view.tsx`) lo usan para decidir si renderizar algo — si no sos el owner, la vista devuelve `null` y redirige a `/admin/executive-dashboard`.
- **Backend:** `lib/auth/api-guards.ts` exporta `requireOmniOwner(jwt)` — chequea el email real del usuario autenticado, **no el rol** (Ann también es `admin`, por eso no alcanza con chequear rol). Las 12 rutas bajo `app/api/admin/omni/*` lo usan todas.
- **Importante:** esto es seguridad por oscuridad + auth real combinadas. El botón está oculto Y las rutas de API rechazan a cualquiera que no sea el owner exacto, incluso si adivinan la URL.

---

## 3. Mapa de archivos (verificado, 3 jul 2026)

```
lib/omni/
├── owner.ts                 — email del owner + isOmniOwnerEmail()
├── instagram.ts              — OAuth de Omni para Instagram (scope propio, incl. DMs)
├── slack-oauth.ts             — OAuth de Omni para Slack (token de USUARIO, no bot)
├── slack-read.ts              — lectura de Slack (conversations.list/history/users.info)
├── chat-tools.ts               — tools del chat (Slack + Instagram)
└── community-analysis.ts        — lógica compartida del análisis (on-demand + cron)

app/api/admin/omni/
├── briefing/route.ts                      — GET: último briefing diario guardado
├── chat/route.ts                          — GET/POST: chat conversacional
├── instagram/connect/route.ts             — GET: arranca OAuth de Instagram
├── instagram/callback/route.ts            — GET: recibe code, guarda token
├── instagram/status/route.ts              — GET: estado de conexión
├── instagram/sync/route.ts                — POST: trae conversaciones+mensajes
├── slack/connect/route.ts                 — GET: arranca OAuth de usuario de Slack
├── slack/callback/route.ts                — GET: recibe code, guarda token de usuario
├── slack/status/route.ts                  — GET: canales/mensajes sincronizados
├── slack/user-status/route.ts             — GET: si Ann ya autorizó o no
├── slack/sync/route.ts                    — POST: trae canales+historial
└── slack/analyze/route.ts                 — POST: corre el análisis de comunidad

app/api/cron/omni-daily-briefing/route.ts   — cron diario (11:30 UTC)

app/privacy/page.tsx, app/terms/page.tsx, app/data-deletion/page.tsx
                                            — páginas legales para el App Review de Meta

components/views/admin-omni-view.tsx        — toda la UI: conexiones, chat, hallazgos, briefing, módulos
```

---

## 4. Modelo de datos (esquema real, verificado por SQL)

9 tablas, todas con RLS habilitada **sin policies** (solo el service role accede — mismo patrón en las 9).

### `omni_oauth_states` — CSRF genérico, compartido entre el OAuth de Instagram y el de Slack
| columna | tipo |
|---|---|
| state (PK) | text |
| expires_at | timestamptz |
| created_at | timestamptz |

### `omni_instagram_connections` — token de Instagram de Omni (una cuenta)
`id, account_id (unique), account_name, account_pic, access_token (cifrado), expires_at, scopes, connected_at, updated_at`

### `omni_conversations` — conversaciones de Instagram DM
`id, ig_conversation_id (unique), participant_username, participant_ig_id, last_message_at, last_message_from ('lead'|'ann'), synced_at`

### `omni_messages` — mensajes de Instagram DM
`id, conversation_id → omni_conversations, ig_message_id (unique), sender ('lead'|'ann'), body, sent_at, synced_at`

### `omni_slack_user_connection` — token de **usuario** de Ann para Slack (reemplaza al bot para lectura)
`id, slack_user_id, slack_team_id, access_token (cifrado), scopes, connected_at, updated_at` — unique en `(slack_user_id, slack_team_id)`

### `omni_slack_channels`
`id, slack_channel_id (unique), name, is_client_channel, client_id → clients (nullable), synced_at`

### `omni_slack_messages`
`id, channel_id → omni_slack_channels, slack_ts, user_name, body, posted_at, synced_at` — unique en `(channel_id, slack_ts)`

### `omni_chat_conversations` — memoria del chat (un solo hilo persistente)
`id, messages (jsonb), created_at, updated_at`

> ⚠️ **Historial de un bug ya arreglado:** esta tabla originalmente se llamaba `omni_conversations` (mismo nombre que la tabla de Instagram, creada antes). El `CREATE TABLE IF NOT EXISTS` no hizo nada al toparse con el nombre repetido, y el chat tiró *"Could not find the 'messages' column"* en producción hasta que se corrigió con el nombre `omni_chat_conversations` (migración `20260703000001`).

### `omni_daily_briefings` — resultado guardado del cron diario
`id, date (unique), findings (jsonb), messages_analyzed, created_at`

---

## 5. Estado real de los datos ahora mismo (snapshot, 3 jul 2026)

| Tabla | Filas | Lectura |
|---|---:|---|
| `omni_instagram_connections` | 1 | Instagram conectado (cuenta de prueba `@juampiiacosta_`) |
| `omni_conversations` | **0** | ⚠️ Nunca se corrió el sync de Instagram, o corrió y no trajo nada |
| `omni_messages` | **0** | ⚠️ Igual que arriba — el chat literalmente no tiene DMs de Instagram para buscar todavía |
| `omni_slack_user_connection` | 1 | Ann conectada vía token de usuario |
| `omni_slack_channels` | 55 | Sync de Slack corrido y funcionando |
| `omni_slack_messages` | 5294 | Sync de Slack corrido y funcionando |
| `omni_chat_conversations` | 1 | El chat ya se usó y persiste memoria |
| `omni_daily_briefings` | **0** | El cron nunca disparó todavía (recién se deployó) |

**Esto importa:** aunque el código para leer/buscar DMs de Instagram ya existe (tools `search_instagram_messages`/`list_instagram_conversations`), **hoy no hay ningún mensaje de Instagram sincronizado para que esas tools encuentren** — hay que correr "Sincronizar" en la tarjeta de Instagram de Omni antes de que el chat pueda responder algo real sobre DMs.

---

## 6. Instagram — flujo completo

1. **Connect** (`GET /api/admin/omni/instagram/connect`) — genera state en `omni_oauth_states`, arma URL de Instagram Business Login con scope `instagram_business_basic,instagram_business_manage_insights,instagram_business_manage_messages`.
2. **Callback** (`GET /api/admin/omni/instagram/callback`) — intercambia code por token de larga duración (60 días), trae perfil, guarda cifrado en `omni_instagram_connections`.
3. **Sync** (`POST /api/admin/omni/instagram/sync`) — trae conversaciones (`/me/conversations`) y hasta 50 mensajes por conversación, upsert en `omni_conversations`/`omni_messages`.

**Requiere App Review de Meta** para el scope `instagram_business_manage_messages` en modo producción (fuera de testers) — ver sección 9.

---

## 7. Slack — evolución del diseño (bot → token de usuario)

**Versión 1 (descartada):** bot token, `conversations.join` antes de leer cada canal. Problema real encontrado: Slack requiere que el bot sea miembro para leer historial, y no puede auto-unirse a canales **privados** en absoluto.

**Versión actual:** token de **usuario** de Ann (OAuth `user_scope`, no `scope` de bot). Hereda automáticamente todo lo que Ann ya puede ver — público y privado — sin join ni invitación manual.

1. **Connect** (`GET /api/admin/omni/slack/connect`) — arma URL de `slack.com/oauth/v2/authorize` con `user_scope=channels:history,channels:read,groups:history,groups:read,users:read`.
2. **Callback** (`GET /api/admin/omni/slack/callback`) — intercambia code vía `oauth.v2.access`, toma `authed_user.access_token` (no el token de bot), guarda cifrado en `omni_slack_user_connection`.
3. **Sync** (`POST /api/admin/omni/slack/sync`) — lista canales (`public_channel,private_channel`), trae historial de cada uno, resuelve nombres de usuario, guarda en `omni_slack_channels`/`omni_slack_messages`.

`SLACK_BOT_TOKEN` (el token viejo) **sigue existiendo y en uso** — pero solo para las funciones de escritura ya existentes de `lib/slack.ts` (crear canal `#cl-nombre` al onboardear un cliente, notificaciones). Omni ya no lo usa para nada.

---

## 8. Agentes de IA

### 8.1 Análisis de comunidad (on-demand + cron diario)

Lógica compartida en `lib/omni/community-analysis.ts` (`runCommunityAnalysis()`), usada por dos callers:
- `POST /api/admin/omni/slack/analyze` — botón "Analizar" en la UI.
- `app/api/cron/omni-daily-briefing/route.ts` — cron a las 11:30 UTC (~8:30 ART), guarda en `omni_daily_briefings` y manda push a Juampi vía `sendPushToNames`.

Toma hasta 1500 mensajes recientes de Slack, arma un transcript agrupado por canal, y le pide a Claude (`claude-sonnet-4-5`) que devuelva un array de hallazgos: `{titulo, descripcion, canales[], evidencia, severidad}`. Instrucción explícita de no inventar — devolver array vacío si no hay nada real.

### 8.2 Chat conversacional

`POST /api/admin/omni/chat` — mismo patrón de agentic loop que `/api/admin/assistant` (hasta 4 rounds de tool-calling), pero con tools propias:

| Tool | Qué hace |
|---|---|
| `search_slack_messages` | ILIKE sobre `omni_slack_messages.body`, opcionalmente por canal |
| `list_slack_channels` | Lista canales + cantidad de mensajes |
| `search_instagram_messages` | ILIKE sobre `omni_messages.body`, opcionalmente por participante |
| `list_instagram_conversations` | Lista conversaciones de IG + cantidad de mensajes |

Memoria: **un solo hilo persistente** (no hay multi-conversación como `ann_conversations`) — se guarda un historial simplificado (`role`+`content`, sin bloques de tool-calling) en `omni_chat_conversations`, siempre la fila más reciente.

**Verificado en vivo (no solo por código):** se probó con una pregunta sin sustento en los datos ("¿por qué Lorena decidió irse?") y el modelo respondió honestamente que no encontró nada, en vez de inventar — comportamiento correcto confirmado por el usuario.

### 8.3 Alerta de errores (no es un "agente" de IA, pero es parte de la infraestructura de Omni-adjacent)

`instrumentation.ts` (raíz del repo, **archivo compartido, no aislado** — parchea `console.error`/`console.warn` de toda la app) dispara un push a Juampi cuando aparece un error/warning nuevo, con throttle de 10 min por `level:route`. No es exclusivo de Omni, pero se construyó en la misma sesión y Omni es uno de los principales generadores de logs que monitorea.

---

## 9. Variables de entorno requeridas

| Variable | Para qué | Estado conocido |
|---|---|---|
| `SLACK_CLIENT_ID` | OAuth de usuario de Slack (Omni) | Cargada por el usuario en Vercel |
| `SLACK_CLIENT_SECRET` | ídem | Cargada por el usuario en Vercel |
| `OMNI_SLACK_REDIRECT_URI` | Override opcional del callback de Slack; si no está, se calcula de `NEXT_PUBLIC_APP_URL` | No confirmado si está seteada — el fallback calculado ya funcionó en la prueba real |
| `SLACK_BOT_TOKEN` | Funciones de escritura de `lib/slack.ts` (no Omni) | Preexistente |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | Compartidas con el flujo de clientes; Omni las reusa para su propio connect | Preexistentes |
| `OMNI_INSTAGRAM_REDIRECT_URI` | Override opcional del callback de Instagram de Omni | No confirmado si está seteada |
| `ANTHROPIC_API_KEY` | Todos los llamados a Claude (análisis, chat) | Preexistente, en uso |
| `CRON_SECRET` | Autoriza el cron `omni-daily-briefing` (y los demás crons) | Preexistente |
| `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_SUBJECT` | Push notifications (briefing diario, alertas de error) | Preexistentes |
| `OAUTH_TOKEN_ENCRYPTION_KEY` | Cifra los tokens de Instagram/Slack en reposo (`lib/social/crypto.ts`) | Preexistente, reusada |

---

## 10. Compliance con Meta (estado a hoy)

- ✅ App oficial registrada en Meta for Developers (OAuth real, no scraping) — bajo riesgo de ban de cuenta.
- ✅ Páginas `/privacy`, `/terms`, `/data-deletion` escritas y deployadas (PR #44), con contenido específico de Smart Scale/Omni, no genérico.
- ⏳ **Pendiente, del lado del usuario:** cargar esas 3 URLs + App Domains + Category en el App Dashboard de Meta.
- ⏳ **Pendiente:** la app sigue en modo Development/Unpublished — solo funciona con cuentas agregadas como tester (por eso se está probando con `@juampiiacosta_`, no con la cuenta real de Ann todavía).
- ⏳ **Pendiente, importante:** el caso de uso real ya escaló de "sincronizar y guardar" a "análisis con IA de las conversaciones" (el chat ahora puede leer y razonar sobre los DMs). Si la descripción del App Review no declara esto explícitamente, hay que ampliarla antes de enviar — riesgo de rechazo o revocación del permiso si Meta lo descubre después.
- ⏳ **Pendiente:** falta el screencast y la descripción del caso de uso para el formulario de Review — no se escribieron todavía.
- ⚠️ Las páginas legales son borradores funcionales, no reemplazan asesoría legal formal.

---

## 11. Qué está genuinamente probado vs. lo que no (léase con atención antes de asumir que "todo funciona")

### Probado en producción, con evidencia real
- Slack: conectar como usuario, sincronizar (55 canales, 5294 mensajes), analizar comunidad, chatear sobre esos datos con respuestas honestas cuando no hay información.
- Push de error/warning: mecanismo de throttle revisado en código (no se pudo probar en runtime por el problema de entorno de abajo).

### Construido pero NO verificado en runtime real
- **Instagram DM sync**: 0 filas en `omni_conversations`/`omni_messages`. El código nunca trajo un mensaje real todavía — no se sabe si `fetchOmniIgMessages`/`fetchOmniIgConversations` funcionan correctamente contra la Graph API real hasta que alguien corra "Sincronizar" en la tarjeta de Instagram.
- **Cron diario** (`omni-daily-briefing`): nunca disparó (0 filas en `omni_daily_briefings`). No hay confirmación de que el cron esté registrado correctamente en Vercel ni de que el push llegue.
- **Chat sobre Instagram**: las tools existen y typechecean, pero no hay datos para probarlas de verdad todavía (depende del punto anterior).

### Nunca se pudo verificar visualmente
Durante toda la sesión, el entorno de sandbox tuvo un problema recurrente al levantar el dev server (`node_modules` con `@next/env` roto + restricción de `getcwd`) — **no relacionado con el código**, confirmado idéntico en 3 intentos distintos. Ningún cambio de UI de esta sesión se vio renderizado en un browser controlado por el asistente; toda la verificación visual la hizo el usuario directamente en producción.

### Verificación de código que sí se hizo en cada paso
- `npx tsc --noEmit` después de cada cambio — siempre contra el mismo baseline de errores preexistentes (78-79, ninguno introducido por este trabajo).
- Greps de light/dark mode (gotcha conocida del repo) — limpios en todos los archivos nuevos/tocados.
- Lectura directa de logs reales (`app_logs` vía Supabase) para diagnosticar al menos 2 bugs en vivo durante la sesión (el `not_in_channel` del bot, y el error de schema del chat) — no se asumió nada, se verificó contra evidencia.

---

## 12. Próximos pasos sugeridos (no ejecutados)

1. Correr "Sincronizar" en la tarjeta de Instagram para poblar `omni_conversations`/`omni_messages` y confirmar que el pipeline de DMs funciona de punta a punta.
2. Disparar el cron manualmente (`POST /api/cron/omni-daily-briefing` con header `Authorization: Bearer $CRON_SECRET`) para confirmar que corre y que el push llega.
3. Completar el formulario de App Review de Meta (URLs ya listas; falta descripción de caso de uso + screencast).
4. Decidir si conectar la cuenta real de Ann (hoy se está probando con la cuenta personal de Juampi) una vez que el App Review esté aprobado o mientras siga en modo tester.
