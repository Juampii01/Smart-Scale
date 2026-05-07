import { redirect } from "next/navigation"

// Prospección ahora vive como tab dentro de /admin/centro-operativo.
// Mantenemos esta ruta como redirect para no romper bookmarks/links viejos.
export default function ProspeccionRedirect() {
  redirect("/admin/centro-operativo")
}
