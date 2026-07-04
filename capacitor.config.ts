import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "space.smartscale.app",
  appName: "Smart Scale",
  // webDir no se usa porque cargamos el sitio remoto (server.url),
  // pero Capacitor lo exige igual.
  webDir: "public",
  server: {
    // La app nativa carga el sitio de Vercel: cada deploy actualiza la app
    // sin pasar por review de las stores.
    url: "https://smartscale.space",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
}

export default config
