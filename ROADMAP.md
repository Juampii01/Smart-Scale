# Smart Scale — Roadmap & Ideas

---

## Cambios técnicos pendientes (no urgentes)

### 1. Reemplazar RapidAPI por Apify para scraping de Instagram
- **Dónde**: `lib/instagram-transcript.ts` + `app/api/content-research/route.ts`
- **Por qué**: Apify es más estable, tiene actor oficial para Instagram, menos bloqueos
- **Actor sugerido**: `apify/instagram-scraper`
- **Env var a agregar**: `APIFY_API_TOKEN` (ya existe en content-research para YouTube, reutilizar)
- **Impacto**: Afecta al módulo Competitor Research (scraping de perfil) y al módulo Transcript de Videos (extracción de URL de video de reels)

### 2. Reemplazar AssemblyAI por Deepgram para transcripciones
- **Dónde**: `lib/instagram-transcript.ts` (función `assemblyAITranscript`) + `app/api/transcript/route.ts`
- **Por qué**: Deepgram tiene latencia más baja, mejor soporte para español, modelo `nova-2` muy preciso
- **Env var a agregar**: `DEEPGRAM_API_KEY`
- **Flujo Deepgram**: upload binario → `POST https://api.deepgram.com/v1/listen?model=nova-2&language=es` → respuesta inmediata (no hay polling)
- **Ventaja extra**: Sin polling — respuesta en una sola request, mucho más rápido que AssemblyAI
- **Impacto**: Ambos módulos (Transcript de Videos y Competitor Research) usan `lib/instagram-transcript.ts`, así que el cambio se hace en un solo lugar

---

## Ideas para presentar a Ani

### Análisis de contenido

1. **Comparador de canales** — Poner dos competidores lado a lado y ver métricas en paralelo: views promedio, frecuencia de posteo, temas más virales. Detectar qué hace mejor cada uno.

2. **Detector de patrones virales** — IA que analiza los títulos y descripciones de los videos con más views y extrae patrones: palabras clave recurrentes, longitud ideal de título, formato que funciona mejor (lista, pregunta, historia).

3. **Trending topics del nicho** — Cruzar los temas de los videos de todos los competidores investigados y mostrar qué temas están generando más tracción ahora mismo en el nicho.

4. **Análisis de gancho (hook)** — Para cada video con transcript, IA que identifica y puntúa el gancho de los primeros 30 segundos: claridad, promesa, emoción. Ranking de los mejores ganchos del canal.

5. **Generador de ideas de contenido** — A partir del análisis de competidores, sugerir automáticamente 10 ideas de videos adaptadas al estilo y audiencia del cliente.

6. **Calendario de contenido inteligente** — Ver en qué días y horarios postean los competidores con mejor rendimiento y sugerir el calendario óptimo para el cliente.

---

### Ventas y clientes

7. **Pipeline visual de clientes** — Tablero kanban (tipo Trello) donde cada cliente tiene una tarjeta que avanza por etapas: Lead → Llamada → Propuesta → Cliente → Retencion. Drag and drop.

8. **Historial de deals por cliente** — Ver todo el historial de Cha-Ching de un cliente específico: cuánto pagó, cuándo, qué niveles alcanzó, próximo objetivo. Timeline visual.

9. **Meta mensual de ventas con progress bar** — Dashboard con el objetivo del mes en USD, cuánto se lleva recaudado, y proyección al ritmo actual de si se va a cumplir o no.

10. **Alertas de seguimiento** — Si un cliente no tuvo movimiento (Cha-Ching) en X días, notificación en el dashboard: "Juan Pérez lleva 45 días sin deal. ¿Hacer seguimiento?"

11. **Reporte de retención** — Ver qué porcentaje de clientes renueva, cuántos se van, cuánto tiempo promedio dura cada relación. Gráfico de churn.

12. **Comparador de desempeño de clientes** — Ranking de clientes por: cash collected total, crecimiento en ventas, nivel alcanzado. Útil para detectar los que más traccionan.

---

### Rendimiento y métricas

13. **Score de salud del negocio** — Un número del 1 al 100 que cruza ventas, actividad en redes, asistencia a clases, y te dice si el negocio está bien o hay señales de alerta.

14. **Comparativa mes a mes** — Para cada métrica clave (views, ventas, leads), gráfico que compara el mes actual vs el anterior vs el mismo mes del año pasado.

15. **Métricas de video feed en tiempo real** — Integrar notificaciones cuando un video supera X views o Y likes. "Tu video de ayer ya llegó a 10K views."

16. **Funnel de contenido a ventas** — Conectar cuántas views generó el contenido del mes con cuántas llamadas se agendaron y cuántos deals se cerraron. Ver la conversión en cada etapa.

---

### Auditoría e IA

17. **Auditoría automatizada mensual** — En vez de completar el formulario de auditoría a mano, el sistema cruza los datos que ya tiene (ventas, redes, actividad) y genera un borrador de auditoría con IA que el coach solo revisa y ajusta.

18. **Diagnóstico de "por qué bajaron las ventas"** — IA que analiza el período de baja y cruza variables: ¿bajó el contenido? ¿bajaron las llamadas? ¿el nicho cambió? Sugiere causa raíz y acciones.

19. **Resumen semanal automático** — Cada lunes, el sistema genera un resumen de la semana anterior: mejores videos, deals cerrados, métricas destacadas. Enviado por email o visible en el dashboard.

20. **Análisis de guion con IA** — El coach sube o pega el guion de un video antes de grabarlo y la IA lo evalúa: ¿tiene buen gancho? ¿CTA claro? ¿está bien estructurado? Da una puntuación y sugerencias de mejora.

---

### Agenda y operaciones

21. **Integración con Google Calendar** — Sincronizar las llamadas de la agenda con Google Calendar. Las sesiones aparecen en el calendario del coach automáticamente.

22. **Asistencia a clases con seguimiento** — Marcar qué alumnos asistieron a cada clase y ver el historial de asistencia por alumno. Detectar quién está desenganchado.

23. **Notas de sesión por cliente** — En cada llamada agendada, poder agregar notas rápidas. Historial de notas por cliente accesible desde su perfil.

24. **Recordatorios automáticos** — 24hs antes de una llamada, el sistema envía recordatorio por WhatsApp o email al cliente (via Zapier/Make).

---

### Experiencia general del dashboard

25. **Modo cliente** — Vista limitada del dashboard que el coach puede compartir con un cliente específico para que vea solo sus propias métricas y progreso. Sin acceso a datos de otros clientes.

26. **Notificaciones en tiempo real** — Centro de notificaciones dentro del dashboard: nuevo deal, video viral, cliente sin actividad, etc.

27. **Búsqueda global** — Un buscador que encuentre clientes, deals, transcripts, análisis de competidores, notas — todo desde un solo lugar.

28. **Dashboard personalizable** — El coach elige qué widgets quiere ver en la pantalla principal y en qué orden. Drag and drop de secciones.

29. **Exportar a PDF/Excel** — Cualquier reporte (mensual, de ventas, de competidores) se puede exportar con un botón para compartirlo con inversores, socios o el propio equipo.

30. **Multi-idioma** — Opción de cambiar el dashboard a inglés para coaches que operan en mercados angloparlantes.

---

*Documento creado: 2026-04-08*
*Próxima revisión: a definir con Ani*
