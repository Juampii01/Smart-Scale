import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function ReflectionSection() {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-foreground">Reflection & Feedback</h2>
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Biggest Win</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-foreground">
                Successfully launched the new product tier, resulting in a 28% increase in average deal size. The
                improved onboarding flow also reduced time-to-value for new clients.
              </p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Next Month Focus</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-foreground">
                Expand into the enterprise segment with dedicated support packages. Optimize ad campaigns to improve
                cost per acquisition and scale YouTube content production.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Support Needed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed text-foreground">
              Need assistance with enterprise sales strategy and additional resources for content creation. Would
              benefit from a review of our current tech stack for scaling operations.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-border bg-card lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">NPS Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-5xl font-bold text-chart-1">72</div>
              <p className="mt-2 text-sm text-muted-foreground">Promoters: 78% • Detractors: 6%</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Improvements / Feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-foreground">
                Clients have requested more advanced reporting features and better integration with third-party tools.
                The mobile experience could be enhanced with a dedicated app. Overall satisfaction remains high with
                exceptional feedback on customer support responsiveness.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
