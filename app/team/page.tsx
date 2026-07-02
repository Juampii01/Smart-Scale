import type { Metadata } from "next"
import { TeamApplicationForm } from "@/components/views/team-application-form"

export const dynamic = "force-dynamic"

const TITLE = "Sumate al equipo de Ann — Smart Scale"
const DESC  = "Aplicá para trabajar directamente con Ann cerrando su oferta de alto ticket en conversaciones 1 a 1."

// Logo al compartir el link: el cuadrado de Smart Scale (smartscale-logo.png).
export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/team",
    images: [{ url: "/smartscale-logo.png", width: 512, height: 512, alt: "Smart Scale" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESC,
    images: ["/smartscale-logo.png"],
  },
}

export default function TeamPage() {
  return <TeamApplicationForm rol="setter" />
}
