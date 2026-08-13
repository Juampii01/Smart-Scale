import { PosiFormView } from "@/components/views/posi-form-view"

export const dynamic = "force-dynamic"

export default async function PosiLevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params
  return <PosiFormView levelNumber={Number(level)} />
}
