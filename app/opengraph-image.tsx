import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const alt = "Smart Scale"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// OG / preview de compartir — lockup del logo Smart Scale (blanco sobre negro).
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 132, fontWeight: 800 }}>
          <span style={{ color: "#ffffff", letterSpacing: "-2px" }}>Smart</span>
          <span
            style={{
              marginLeft: 26,
              background: "#ffffff",
              color: "#000000",
              padding: "6px 34px 14px",
              borderRadius: 22,
              letterSpacing: "-2px",
            }}
          >
            Scale
          </span>
        </div>
        <div style={{ marginTop: 36, fontSize: 30, color: "#ffde21", letterSpacing: "8px", fontWeight: 600 }}>
          CLIENT ANALYTICS PORTAL
        </div>
      </div>
    ),
    { ...size },
  )
}
