import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smart Scale",
    short_name: "Smart Scale",
    description: "Portal de analytics y CRM operativo de Smart Scale",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#ffde21",
    icons: [
      { src: "/smartscale-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/smartscale-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/smartscale-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
