import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Solo se permiten dominios CDN de Instagram y YouTube.
// Cualquier otra URL es rechazada para prevenir SSRF.
const ALLOWED_HOSTNAME_SUFFIXES = [
  "cdninstagram.com",
  "fbcdn.net",          // Instagram usa FB CDN también
  "instagram.com",
  "ytimg.com",          // YouTube thumbnails
  "ggpht.com",          // YouTube channel avatars
  "googleusercontent.com",
]

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const { hostname, protocol } = new URL(rawUrl)
    if (protocol !== "https:") return false
    return ALLOWED_HOSTNAME_SUFFIXES.some(suffix =>
      hostname === suffix || hostname.endsWith("." + suffix)
    )
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return new NextResponse("Missing url", { status: 400 })

  if (!isAllowedUrl(url)) {
    return new NextResponse("URL not allowed", { status: 403 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://www.instagram.com/",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return new NextResponse("Image unavailable", { status: 502 })

    const contentType = res.headers.get("content-type") ?? "image/jpeg"
    const buffer = await res.arrayBuffer()

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch {
    return new NextResponse("Image unavailable", { status: 502 })
  }
}
