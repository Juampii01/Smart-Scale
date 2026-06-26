import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Instrument_Serif, Space_Grotesk } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { PwaRegister } from "@/components/pwa-register"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
})

// Fuente principal del UI — estética Scale20 (grotesca geométrica).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
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
    images: [{ url: "/smartscale-logo.png", width: 512, height: 512, alt: "Smart Scale" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Smart Scale",
    description: "Client Monthly Analytics Portal",
    images: ["/smartscale-logo.png"],
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
      className={`${spaceGrotesk.variable} ${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
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
