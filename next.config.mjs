/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  async redirects() {
    return [
      // El form de setter ahora se comparte como /team (link más limpio).
      { source: "/aplicar-equipo/setter", destination: "/team", permanent: false },
    ]
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking — the portal is never embedded in an iframe
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent MIME sniffing (defense-in-depth against upload-based XSS)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Limit Referer to origin only when crossing to external sites
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Disable browser features not used by the app
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Content Security Policy
          // script-src includes 'unsafe-inline' + 'unsafe-eval' because Next.js
          // App Router requires both for its runtime. Tighten if/when nonces are added.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js runtime + inline scripts in RSC
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Tailwind inline styles + shadcn/ui
              "style-src 'self' 'unsafe-inline'",
              // App images + Supabase Storage (avatares, attachments) + proxy-image CDN sources
              "img-src 'self' data: blob: https://*.supabase.co https://cdninstagram.com https://*.cdninstagram.com https://fbcdn.net https://*.fbcdn.net https://ytimg.com https://*.ytimg.com https://ggpht.com https://*.ggpht.com https://googleusercontent.com https://*.googleusercontent.com",
              // API calls: Supabase, Anthropic (server-side only but kept for fetch()),
              // YouTube embeds, Calendly
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://calendly.com",
              // Calendly embed iframe
              "frame-src https://calendly.com",
              // Fonts (none external currently — safe default)
              "font-src 'self' data:",
              // Block object/embed elements entirely
              "object-src 'none'",
              // Disallow embedding this app in any frame (belt-and-suspenders with X-Frame-Options)
              "frame-ancestors 'none'",
              // Upgrade HTTP → HTTPS for any stray mixed-content requests
              "upgrade-insecure-requests",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
