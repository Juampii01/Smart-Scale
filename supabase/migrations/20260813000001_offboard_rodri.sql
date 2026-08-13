-- Rodri (rodrigo@villegasvrodrigo.com) se dio de baja del portal.
-- No tiene fila en crm_clients (nunca pasó por el CRM de ventas) — el
-- único flag real es profiles.active, que ya usa el resto de la app
-- para filtrar "clientes activos" (ver admin-clients-view, etc.).

update public.profiles
set active = false
where id = '1bc12867-f6b6-4cd7-931a-4a9f1c468b70';
