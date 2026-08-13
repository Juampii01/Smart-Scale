-- Reemplaza por completo el tab "Posi" viejo (quiz secuencial con gate,
-- scoring por multiple_choice, nunca usado — 0 filas reales en
-- client_posi_submissions, todo el contenido seguía siendo el placeholder
-- de la migración original 20260803000004_posi_levels.sql).
--
-- Nuevo modelo: 9 niveles (0-8) de formularios de completado, sin
-- scoring ni gate secuencial. Se accede por link directo (fuera del nav),
-- logueado con la sesión real (sin selector de "perfil" — por eso no hay
-- columna para eso), y cada envío dispara un aviso a Slack con las
-- respuestas completas (no solo un score).
--
-- Seguro hacer drop+recreate: confirmado con
-- `select count(*) from client_posi_submissions` = 0 antes de esta migración.

drop table if exists client_posi_submissions;
drop table if exists posi_levels;

create table posi_levels (
  id            uuid primary key default gen_random_uuid(),
  level_number  integer not null unique,   -- 0..8
  title         text not null,
  intro         text,                       -- texto de bienvenida del nivel (puede ser null)
  -- questions: [{ id, label, type: "text" | "yesno" | "multiple_choice", options?: string[] }]
  questions     jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table client_posi_submissions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  level_id      uuid not null references posi_levels(id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb,   -- { question_id: answer }
  submitted_at  timestamptz not null default now(),
  unique (client_id, level_id)
);

create index client_posi_submissions_client_id_idx on client_posi_submissions(client_id);

alter table posi_levels enable row level security;
alter table client_posi_submissions enable row level security;

drop policy if exists "service_role_all" on posi_levels;
create policy "service_role_all" on posi_levels for all to service_role using (true) with check (true);

drop policy if exists "service_role_all" on client_posi_submissions;
create policy "service_role_all" on client_posi_submissions for all to service_role using (true) with check (true);

-- ── Seed: contenido real, traducido fielmente del original en inglés ──────────
-- Fase 1 (pedido explícito del usuario): mismo significado, mismas preguntas,
-- solo en español — sin adaptar todavía terminología propia de Smart Scale.
-- Se sacaron los campos "Select your profile" (la identidad ahora es la
-- sesión logueada) y "Date" (ya está client_posi_submissions.submitted_at) —
-- son metadata técnica del formulario original, no contenido a preservar.

insert into posi_levels (level_number, title, intro, questions) values

(0, 'Nivel 0', 'Buenas campeón, bienvenido a la arena 🤝

Si llegaste hasta esta etapa, ya sos un ganador.

Pero acordate cómo ganamos todos... a partir de este momento tenés que avanzar con una sola intención...

Ser el mejor caso de éxito de la historia de Scale20.

Fe total y nada menos.

A por todo.',
'[
  {"id":"q1","label":"¿Qué obtenés cuando llegás a $100k/mes en Scale20™️?","type":"text"},
  {"id":"q2","label":"¿Qué significa POSI?","type":"text"},
  {"id":"q3","label":"¿Cuántos leads de email nuevos por día estoy buscando conseguir para llegar a $20k/mes?","type":"text"}
]'::jsonb),

(1, 'Nivel 1', 'Buenas campeón, este nivel es simple. Este nivel es donde transformás la trayectoria de tu vida. Este es el nivel más importante de todo Scale20.

Metele con todo al Kit de Herramientas 10.0 Vos, más fuerte que a cualquier otra cosa en la que hayas puesto esfuerzo en tu vida.

Así es como convertís tus sueños en realidad 🤝

¿Estás?',
'[
  {"id":"q1","label":"¿Completaste el Worksheet de Construcción de tu Nueva Identidad?","type":"yesno"},
  {"id":"q2","label":"¿Cuál es tu Ingreso Mensual Objetivo (Número de Libertad)?","type":"text"},
  {"id":"q3","label":"¿Completaste tu Declaración de Identidad?","type":"yesno"},
  {"id":"q4","label":"¿Completaste tu Ejercicio de Visión Futura a 12 Meses?","type":"yesno"},
  {"id":"q5","label":"¿Completaste tu Vision Board a 1-3 años?","type":"yesno"},
  {"id":"q6","label":"¿Tenés objetivos claros y tangibles para el próximo año, trimestre y mes?","type":"yesno"},
  {"id":"q7","label":"¿Cuál es el color de mosquetón de tu próximo hito mensual en Scale20™️?","type":"text"}
]'::jsonb),

(2, 'Nivel 2', 'Buenas campeón, este nivel es importante porque nos ENCANTA complicar todo... quiero que vuelvas seguido a este nivel como referencia para chequear si tenés los componentes y sistemas fundamentales en su lugar.

¿Puedo contar con que te hagas responsable de esta tarea?',
'[
  {"id":"q1","label":"¿Qué significa BTC Offer?","type":"text"},
  {"id":"q2","label":"¿Qué es The Leverage Trap (la Trampa del Apalancamiento)?","type":"text"},
  {"id":"q3","label":"¿Qué es lo más importante al construir tu negocio de creador con un flywheel?","type":"text"},
  {"id":"q4","label":"¿Cuál es el primer sistema que tenés que resolver en tu negocio de creador?","type":"text"},
  {"id":"q5","label":"¿Qué tipo de contenido convierte mejor seguidores en clientes?","type":"text"},
  {"id":"q6","label":"¿Estás dispuesto/a a construir con paciencia tu One Simple Flywheel™️ durante los próximos 4 años?","type":"yesno"}
]'::jsonb),

(3, 'Nivel 3', 'Buenas campeón, este nivel es la LLAVE que desbloquea el resto de tu negocio... esto va a formar la base de tu estrategia de contenido y marca personal....',
'[
  {"id":"q1","label":"¿Cuál es la definición de un \"lead\"?","type":"text"},
  {"id":"q2","label":"¿Qué es una \"oferta\"?","type":"text"},
  {"id":"q3","label":"¿Qué es un \"Número de Libertad\"?","type":"text"},
  {"id":"q4","label":"¿Cuál es más efectivo a la hora de estructurar una oferta?","type":"text"},
  {"id":"q5","label":"¿Por qué diseñamos restricciones (constraints) para nuestro negocio?","type":"text"},
  {"id":"q6","label":"¿Cuál NO es uno de los 4 deseos humanos centrales?","type":"text"},
  {"id":"q7","label":"¿Completaste el Worksheet del Cliente Futuro Perfecto?","type":"yesno"},
  {"id":"q8","label":"¿Completaste tu OSO Blueprint Builder + Access Stack?","type":"yesno"},
  {"id":"q9","label":"¿Completaste tu V1 del Documento de Oferta?","type":"yesno"},
  {"id":"q10","label":"Ahora que tenés una oferta GANADORA para vender, ¿estás listo/a para convertirte en la autoridad de confianza en tu nicho?","type":"yesno"}
]'::jsonb),

(4, 'Nivel 4', null,
'[
  {"id":"q1","label":"¿Creaste tu cuenta de Gmail \"Quemada\" (Burner)?","type":"yesno"},
  {"id":"q2","label":"¿Cuál es tu One Simple Community?","type":"text"},
  {"id":"q3","label":"Seleccioná el camino de ascensión correcto....","type":"text"},
  {"id":"q4","label":"¿Para qué se usa un 9 Word Post (Email)?","type":"text"},
  {"id":"q5","label":"¿Un experto revisó tu DNS y la configuración de tu dominio?","type":"yesno"},
  {"id":"q6","label":"¿Creaste tu Lead Magnet de Mini-Curso por Email?","type":"yesno"}
]'::jsonb),

(5, 'Nivel 5', 'Buenas campeón, empezaste a trabajar conmigo para convertirte en una AUTORIDAD en tu nicho, manos a la obra 🤝',
'[
  {"id":"q1","label":"¿Qué tipo de contenido convierte leads en clientes pagos?","type":"text"},
  {"id":"q2","label":"¿Cuál es el monto de referencia de cash collected para reinvertir en marketing? (Scale Tax)","type":"text"},
  {"id":"q3","label":"¿Para qué niveles de conciencia (awareness) creamos Growth Content?","type":"text"},
  {"id":"q4","label":"¿Qué tipo de marketing nos trae Dream Clients?","type":"text"},
  {"id":"q5","label":"¿Completaste tu Authority Diamond?","type":"yesno"},
  {"id":"q6","label":"¿Completaste tu Cult Brand Blueprint?","type":"yesno"},
  {"id":"q7","label":"¿Completaste el esqueleto de tu Lead Magnet de Mini-Curso por Email?","type":"yesno"},
  {"id":"q8","label":"¿Completaste el checklist de Optimización de Perfil?","type":"yesno"},
  {"id":"q9","label":"¿Delineaste tus Core 4 Conversion Stories?","type":"yesno"},
  {"id":"q10","label":"¿Quiénes son los tres creadores de tu nicho a los que les vas a \"robar\" ideas?","type":"text"},
  {"id":"q11","label":"¿Quiénes son los tres EXPERTOS a los que les podés \"hacer Authority-Jack\" de ideas que cambian creencias?","type":"text"},
  {"id":"q12","label":"¿Listo/a para construir tu tribu de hyper-fans?","type":"yesno"}
]'::jsonb),

(6, 'Nivel 6', 'Buenas campeón, acá es donde convertís seguidores en dólares... la venta es donde tenés que abrazar el RECHAZO, aprender a amarlo, y la 💸 va a llegar más rápido de lo que te imaginás.

Cuantas más ofertas hagas y más te abras al rechazo [tu instinto humano es evitar el rechazo, así que tenés que programarte para amarlo], más dinero vas a hacer.

Acordate, solo hacemos ofertas a gente que está calificada...',
'[
  {"id":"q1","label":"¿Por qué usamos tono y ritmo verbal en las Llamadas de Estrategia?","type":"text"},
  {"id":"q2","label":"¿Cuál NO es una de Las 7 Palancas Más Largas de la Venta?","type":"text"},
  {"id":"q3","label":"¿Cuál NO es uno de los DOS Tipos de Dolor sobre los que los prospectos toman decisiones de compra?","type":"text"},
  {"id":"q4","label":"¿Cuál NO es una de las TRES circunstancias que la gente usa como excusa?","type":"text"},
  {"id":"q5","label":"¿Completaste el Worksheet \"Vendé las Vacaciones\"?","type":"yesno"},
  {"id":"q6","label":"¿Completaste tu Script de Chat-a-Cierre?","type":"yesno"},
  {"id":"q7","label":"¿Agregaste tu Script de Chat-a-Cierre como atajo de teclado en tu teléfono y computadora?","type":"yesno"},
  {"id":"q8","label":"¿Duplicaste el documento de Outreach Tracker + Hot List?","type":"yesno"},
  {"id":"q9","label":"¿Configuraste tus Automatizaciones de Calendly?","type":"yesno"},
  {"id":"q10","label":"¿Completaste el Script de Llamada de Triage?","type":"yesno"},
  {"id":"q11","label":"¿Listo/a para transformar vidas y hacer dinero?!!","type":"yesno"}
]'::jsonb),

(7, 'Nivel 7', 'Buenas campeón, ¡es hora de construir esa Micro-Cult Brand™️!',
'[
  {"id":"q1","label":"¿Quién es el primer creador al que le vas a robar ideas?","type":"text"},
  {"id":"q2","label":"¿Quién es el segundo creador al que le vas a robar ideas?","type":"text"},
  {"id":"q3","label":"¿Quién es el tercer creador al que le vas a robar ideas?","type":"text"},
  {"id":"q4","label":"¿Cuáles son las 5C''s de un Video Viral de YouTube?","type":"multiple_choice","options":["Contenido + Credibilidad + CTA + Comunidad + Core","Click + Credibilidad + Conectar + Core + CTA","Conectar + Credibilidad + Ansiar + Coleccionar + CTA"]},
  {"id":"q5","label":"¿Qué es el Hook Sandwich para los primeros 90 segundos de un video?","type":"multiple_choice","options":["CTA > Historia > Listado","Desafío de Creencia > Credibilidad > Qué Sigue > CTA > Golpe de Valor","Historia > Pregunta > Declaración"]},
  {"id":"q6","label":"El \"empaquetado\" de contenido long-form es =","type":"multiple_choice","options":["Título + Miniatura","Duración de Vista","Analíticas","Tamaño de Audiencia"]},
  {"id":"q7","label":"¿Planificaste tu Mini-Serie basada en tus Painkillers?","type":"multiple_choice","options":["Todavía no","Sí","Ya lo completé, campeón ✅"]},
  {"id":"q8","label":"¿Listo/a para construir tu Micro-Cult Brand™️?","type":"yesno"}
]'::jsonb),

(8, 'Nivel 8', null,
'[
  {"id":"q1","label":"¿Por qué mapeamos los sistemas de nuestro negocio?","type":"multiple_choice","options":["Porque queda cool... posta","Le da claridad a mí, a mi equipo, y nos permite resolver obstáculos antes de que pasen","Para hacer automatizaciones con onda"]},
  {"id":"q2","label":"¿Qué sistema estás mapeando primero?","type":"text"},
  {"id":"q3","label":"¿Qué decisión tomaste a partir de identificar esta restricción (constraint)?","type":"text"},
  {"id":"q4","label":"¿Cómo debería usarse la IA en el día a día?","type":"multiple_choice","options":["Como asistente y colaborador","Como director creativo","Como herramienta todo-en-uno"]},
  {"id":"q5","label":"¿Te sentís con confianza de estar listo/a para implementar IA y automatizaciones en tu negocio?","type":"multiple_choice","options":["¡Sí, vamos con todo!","No, me siento abrumado/a o no tengo claro qué hacer"]}
]'::jsonb);

notify pgrst, 'reload schema';
