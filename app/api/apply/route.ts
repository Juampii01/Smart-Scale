import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    let body: any
    try { body = await req.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const {
      first_name, last_name, email, whatsapp, instagram_handle,
      primary_channel, short_content_link, youtube_podcast_link,
      email_list_size, monthly_revenue, paying_clients, client_work_style,
      income_goal, main_blocker, superpowers, contribution, motivation,
      one_year_goal, terms_accepted,
    } = body

    if (!first_name || !last_name || !email || !whatsapp || !instagram_handle) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
    }
    if (!terms_accepted) {
      return NextResponse.json({ error: "Debés aceptar los Términos y Condiciones" }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("applications")
      .insert({
        first_name:           first_name           || null,
        last_name:            last_name            || null,
        email:                email                || null,
        whatsapp:             whatsapp             || null,
        instagram_handle:     instagram_handle     || null,
        primary_channel:      primary_channel      || null,
        short_content_link:   short_content_link   || null,
        youtube_podcast_link: youtube_podcast_link || null,
        email_list_size:      email_list_size      || null,
        monthly_revenue:      monthly_revenue      || null,
        paying_clients:       paying_clients != null ? String(paying_clients) : null,
        client_work_style:    client_work_style    || null,
        income_goal:          income_goal          || null,
        main_blocker:         main_blocker         || null,
        superpowers:          superpowers          || null,
        contribution:         contribution         || null,
        motivation:           motivation           || null,
        one_year_goal:        one_year_goal        || null,
        terms_accepted:       Boolean(terms_accepted),
        status:               "nueva",
      })
      .select("id")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, id: data.id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Error interno" }, { status: 500 })
  }
}
