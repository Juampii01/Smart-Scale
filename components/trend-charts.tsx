"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bar, Line, BarChart, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"

export function TrendCharts() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const supabase = createClient()

        // 1) current user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("No session")

        // 2) client_id
        const { data: profile, error: pErr } = await supabase
          .from("profiles")
          .select("client_id")
          .eq("id", user.id)
          .single()

        if (pErr) throw pErr

        // 3) all monthly reports for charts
        const { data: reports, error: rErr } = await supabase
          .from("monthly_reports")
          .select("month, cash_collected, total_revenue, new_clients, yt_subscribers, short_followers")
          .eq("client_id", profile.client_id)
          .order("month", { ascending: true })

        if (rErr) throw rErr

        if (mounted) setData(reports ?? [])
      } catch (e: any) {
        if (mounted) setError(e.message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [])

  const cashCollectedData = data.map(r => ({ month: r.month, value: r.cash_collected }))
  const totalRevenueData = data.map(r => ({ month: r.month, value: r.total_revenue }))
  const newClientsData = data.map(r => ({ month: r.month, value: r.new_clients }))
  const youtubeSubscribersData = data.map(r => ({ month: r.month, value: r.yt_subscribers }))
  const shortformFollowersData = data.map(r => ({ month: r.month, value: r.short_followers }))

  return (
    <section className="space-y-6">
      {loading && <p className="text-white/60">Cargando métricas…</p>}
      {error && <p className="text-red-400">{error}</p>}

      <h2 className="text-lg font-semibold text-foreground">Trend Analysis</h2>

      <Card className="border-border bg-card transition-all duration-200 hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-primary/5">
        <CardHeader>
          <CardTitle className="text-base font-medium text-white">Cash Collected</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cashCollectedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.2} />
              <XAxis dataKey="month" stroke="#ffffff" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#ffffff"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 700, marginBottom: 8 }}
                itemStyle={{ color: "#111827" }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, "Cash Collected"]}
              />
              <Bar dataKey="value" fill="#ffffff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border bg-card transition-all duration-200 hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-primary/5">
        <CardHeader>
          <CardTitle className="text-base font-medium text-white">Total Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={totalRevenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.2} />
              <XAxis dataKey="month" stroke="#ffffff" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#ffffff"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 700, marginBottom: 8 }}
                itemStyle={{ color: "#111827" }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, "Total Revenue"]}
              />
              <Bar dataKey="value" fill="#ffffff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border bg-card transition-all duration-200 hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-primary/5">
        <CardHeader>
          <CardTitle className="text-base font-medium text-white">Nuevos Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={newClientsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.2} />
              <XAxis dataKey="month" stroke="#ffffff" fontSize={12} tickLine={false} />
              <YAxis stroke="#ffffff" fontSize={12} tickLine={false} />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 700, marginBottom: 8 }}
                itemStyle={{ color: "#111827" }}
                formatter={(value: number) => [value, "New Clients"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#ffffff"
                strokeWidth={3}
                dot={{ fill: "#ffffff", r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border bg-card transition-all duration-200 hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-primary/5">
        <CardHeader>
          <CardTitle className="text-base font-medium text-white">Suscriptores de Youtube</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={youtubeSubscribersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.2} />
              <XAxis dataKey="month" stroke="#ffffff" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#ffffff"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 700, marginBottom: 8 }}
                itemStyle={{ color: "#111827" }}
                formatter={(value: number) => [value.toLocaleString(), "YouTube Subscribers"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#ffffff"
                strokeWidth={3}
                dot={{ fill: "#ffffff", r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border bg-card transition-all duration-200 hover:border-muted-foreground/50 hover:shadow-lg hover:shadow-primary/5">
        <CardHeader>
          <CardTitle className="text-base font-medium text-white">Seguidores de Instagram</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={shortformFollowersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.2} />
              <XAxis dataKey="month" stroke="#ffffff" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#ffffff"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                }}
                labelStyle={{ color: "#111827", fontWeight: 700, marginBottom: 8 }}
                itemStyle={{ color: "#111827" }}
                formatter={(value: number) => [value.toLocaleString(), "Short-form Followers"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#ffffff"
                strokeWidth={3}
                dot={{ fill: "#ffffff", r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </section>
  )
}
