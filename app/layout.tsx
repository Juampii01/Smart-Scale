import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Instrument_Serif } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { PwaRegister } from "@/components/pwa-register"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
})

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
})

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  metadataBase: new URL("https://smartscale.space"),
  title: "Smart Scale",
  description: "Client Monthly Analytics Portal",
  icons: {
    icon: [
      { url: "/smartscale-icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/smartscale-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: "/smartscale-icon-512.png",
  },
  openGraph: {
    title: "Smart Scale",
    description: "Client Monthly Analytics Portal",
    type: "website",
    // La imagen de preview la genera app/opengraph-image.tsx (logo Smart Scale)
  },
  twitter: {
    card: "summary_large_image",
    title: "Smart Scale",
    description: "Client Monthly Analytics Portal",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Smart Scale",
  },
}

export const viewport: Viewport = {
  themeColor: "#ffde21",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${instrumentSerif.variable}`}
    >
      <body className={`font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Analytics />
          <PwaRegister />
        </ThemeProvider>
      </body>
    </html>
  )
}
