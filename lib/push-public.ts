// Clave VAPID pública (NO secreta) — usada por el cliente para suscribirse.
// Override vía NEXT_PUBLIC_VAPID_PUBLIC_KEY si se quiere rotar.
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
  "BGA2txZRpM2bzxVIAdmeYe1ZDesSOM9b2lXfKswj2M0tWjyx8qllRUxDhQ5LU-DSyqeOaQEatJNqdsWkicGw2e8"
