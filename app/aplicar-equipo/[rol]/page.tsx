"use client"

import { useParams } from "next/navigation"
import { TeamApplicationForm } from "@/components/views/team-application-form"

export default function TeamApplyPage() {
  const params = useParams<{ rol: string }>()
  return <TeamApplicationForm rol={params?.rol ?? ""} />
}
