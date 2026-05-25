# Migración pendiente — 4 clientes con UUIDs duplicados

## Status
PENDIENTE — diferida a sprint dedicado. NO ejecutar como parte de otro trabajo.

## Caso
Existen 4 clientes activos que tienen dos UUIDs diferentes en la base de datos:
- Uno en `crm_clients` (donde vive el historial financiero y las cuotas)
- Uno en `clients` / `profiles` (donde vive la cuenta del portal y su data)

Los dos registros NO están conectados entre sí.

## Clientes afectados

| Cliente | UUID CRM | UUID Portal | Cuotas | Total | Cobrado |
|---------|----------|-------------|--------|-------|---------|
| Gastón Aldana | c8316d70 | af960fc4 | 3 | $6.900 | $4.600 |
| Alex García | 85e56ebe | a6926b50 | 2 | $6.991 | $3.491 |
| Michel Acevedo | fa455329 | 24d70e3e | 2 | $3.000 | $1.500 |
| Alberto del Castillo | 4a82e29e | 09314097 | 6 | $9.000 | $1.500 |

## Por qué pasó
Cuando Airtable disparaba el webhook → creaba un registro en `clients` con el mismo UUID que el CRM. Funcionaba bien.

Para estos 4 clientes, el usuario del portal fue creado manualmente (por admin) antes o independientemente del webhook → se generó un UUID nuevo para el portal que no matchea el del CRM.

## Fuente del problema — YA CERRADA
Al retirar Airtable de la integración, la fuente del desfase está cerrada. No deberían aparecer nuevos casos como estos.

Igual conviene monitorear con el script de detección incluido más abajo.

## Impacto actual
- ✅ Executive Dashboard: lee de `crm_installments` joinado a `crm_clients`. Números correctos, plata se cuenta bien.
- ✅ Portal del cliente (canal, reportes, playbook): usa el portal UUID. Funciona sin problemas porque no muestra cuotas.
- ⚠️ Único problema silencioso: si en el futuro alguna vista del portal cliente intenta cruzar `profiles.client_id` con datos financieros, no va a encontrar nada para estos 4 clientes.

## Plan para cuando se ejecute la migración

**Trabajo dedicado: 1-2 días enteros. NO meter dentro de otro sprint.**

### Fase 1 — Análisis
1. Mapear TODAS las tablas que referencian el portal UUID
2. Mapear TODAS las tablas que referencian el CRM UUID
3. Identificar foreign keys, cascades, índices
4. Reporte por cliente: "para migrar a X hay que tocar Y tablas, Z filas"

### Fase 2 — Backup
5. Backup completo de la DB (NO NEGOCIABLE)
6. Confirmar que el backup se puede restaurar

### Fase 3 — Migración cliente por cliente (uno a uno, NO en batch)
Para cada uno de los 4:
7. Crear el registro faltante en `clients` con el UUID del CRM
8. Migrar TODA la data del portal del UUID viejo al UUID nuevo (reports, playbook, transcripts, video feed, etc.)
9. Actualizar `profiles.client_id` apuntando al UUID nuevo
10. Validar que el cliente puede loguear y ve todo su historial
11. Eliminar el registro duplicado viejo del portal
12. Commit en transacción — si algo falla, rollback completo

### Fase 4 — Validación
13. Cada cliente puede loguear normalmente
14. Cada cliente ve su data (reportes, playbook, etc.) intacta
15. Admin ve los pagos cruzados con el portal
16. Executive Dashboard sigue contando bien

### Fase 5 — Comunicación
17. Avisar a los 4 clientes que pueden volver a usar normal (les invalidamos sesión)
18. Monitorear 48 hs

## Script de detección — correr mensualmente

```sql
-- Detecta clientes en CRM sin matchear UUID en portal
SELECT 
  cc.id as crm_id, 
  cc.email, 
  cc.name,
  c.id as portal_id
FROM crm_clients cc
LEFT JOIN clients c ON c.email = cc.email
WHERE c.id IS NULL OR c.id != cc.id;
```

Si devuelve filas → hay nuevos casos que investigar.

## Por qué NO se ejecuta ahora

* Requiere sprint dedicado con backup probado
* 4 clientes activos que pagan, no admite errores
* Cada migración requiere validación individual
* Sin urgencia operativa real — sistema funciona hoy
