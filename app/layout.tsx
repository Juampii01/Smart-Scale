import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme/theme-provider"
import "./globals.css"

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  metadataBase: new URL("https://smartscale.space"),
  title: "Smart Scale",
  description: "Client Monthly Analytics Portal",
  icons: {
    icon: [
      { url: "/smartscale-icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icon-dark-32x32.png",     sizes: "32x32",   type: "image/png" },
      { url: "/icon.svg",                type: "image/svg+xml" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    shortcut: "/smartscale-icon-512.png",
  },
  openGraph: {
    title: "Smart Scale",
    description: "Client Monthly Analytics Portal",
    images: [{ url: "/og-image-v3.png", width: 1200, height: 630, alt: "Smart Scale" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Smart Scale",
    description: "Client Monthly Analytics Portal",
    images: ["/og-image-v3.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className={`font-sans antialiased`}>
        <ThemeProvider>
          {children}
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
